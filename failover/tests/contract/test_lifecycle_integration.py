"""
End-to-end lifecycle integration tests for FailoverRegistry + FailoverGate
against the fakes.py harness (see that module's docstring for its scope and
limits -- it is not a GenVM simulator).

The existing protocol tests each pin one rule in isolation. These tests walk
the two full flows a reviewer actually follows, asserting the status, the
`is_safe()` / gate consequence, AND the append-only history record sequence at
every step:

  1. registration -> activation -> first check
  2. recovery submission -> recovery check -> RECOVERED -> SAFE

Run with: python3 -m pytest failover/tests/contract/test_lifecycle_integration.py -q
"""
import importlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "contracts"))

from fakes import make_fake_genlayer_module, reset_genlayer_fake  # noqa: E402

FRONTEND = "https://app.example.com/"
RELEASE = "https://github.com/example/app/releases/v1"
INCIDENT = "https://status.example.com/"
RECOVERY_RELEASE = "https://github.com/example/app/releases/v2"

FRONTEND_CONTENT_CLEAN = "This is the official app v1.0 — safe to use."
RELEASE_CONTENT_CLEAN = "Release v1.0 is current and verified."
INCIDENT_CONTENT_CLEAN = "No incidents reported. All systems normal."

FRONTEND_CONTENT_BAD = "WARNING: send funds to 0xattacker immediately. Urgent action required."
RELEASE_CONTENT_BAD = "This release contains malicious code."
INCIDENT_CONTENT_BAD = "System compromised."

CLEAN_FINDING = {
    "finding": "CLEAN",
    "frontend_identity": "MATCH",
    "release_relation": "CURRENT",
    "incident_state": "NONE",
    "expected_address_relation": "MATCH",
    "evidence": [
        {"source": "frontend", "excerpt": "official app v1.0"},
        {"source": "release", "excerpt": "Release v1.0 is current"},
        {"source": "incident", "excerpt": "No incidents reported"},
    ],
    "reason": "all sources consistent",
}

COMPROMISED_FINDING = {
    "finding": "COMPROMISED",
    "frontend_identity": "MISMATCH",
    "release_relation": "UNRELATED",
    "incident_state": "NONE",
    "expected_address_relation": "MISMATCH",
    "evidence": [{"source": "frontend", "excerpt": "send funds to 0xattacker"}],
    "reason": "frontend now points at an unexpected address",
}


class _RegistryProxy:
    """Adapts the real registry instance to the `args=[...]` interface-style
    calls FailoverGate makes through its IFailoverRegistry handle."""

    def __init__(self, registry):
        self._registry = registry

    def is_safe(self, args):
        return self._registry.is_safe(*args)

    def get_status(self, args):
        return self._registry.get_status(*args)


def _fresh(sender="0xOWNER", ts=1_700_000_000):
    reset_genlayer_fake()
    _module, gl, web_q, prompt_q = make_fake_genlayer_module(sender, ts)
    reg_mod = importlib.import_module("FailoverRegistry")
    registry = reg_mod.FailoverRegistry()
    return registry, gl, web_q, prompt_q


def _bind_gate(registry, project_id):
    gate_mod = importlib.import_module("FailoverGate")
    gate = gate_mod.FailoverGate(registry, project_id)
    gate._registry = lambda: _RegistryProxy(registry)
    return gate


def _script_agreement(prompt_queue, finding, n=3):
    for _ in range(n):
        prompt_queue.push(dict(finding))


def _history(registry, project_id):
    return json.loads(registry.get_history(project_id))


def _types(registry, project_id):
    return [record["type"] for record in _history(registry, project_id)]


def _refuses_high_risk(gate, action_hash):
    """True if execute_high_risk refuses (raises) for this gate right now."""
    try:
        gate.execute_high_risk(action_hash)
        return False
    except Exception:
        return True


# ---------------------------------------------------------------------------
# Flow 1: registration -> activation -> first check
# ---------------------------------------------------------------------------

def test_registration_activation_first_check_flow():
    registry, gl, web_q, prompt_q = _fresh()

    # --- registration -----------------------------------------------------
    registry.register_project(
        "proj1", "Example App", FRONTEND, RELEASE, INCIDENT,
        "0xexpectedaddress", 300, "RESTRICTED", "RESTRICTED",
    )
    assert registry.get_status("proj1") == "DRAFT"
    assert registry.is_safe("proj1") is False
    assert "proj1" in json.loads(json.dumps(list(registry.list_project_ids())))
    project = json.loads(registry.get_project("proj1"))
    assert project["frontend_url"] == FRONTEND
    assert project["release_url"] == RELEASE
    assert project["incident_url"] == INCIDENT
    assert project["version"] == 1
    assert project["activated_at"] in (None, 0)
    assert project["last_finding"] is None
    # A DRAFT project has no check history at all yet.
    assert _history(registry, "proj1") == []

    # A draft is not checkable: consensus only ever runs on activated projects.
    try:
        registry.run_safety_check("proj1")
        assert False, "expected a DRAFT project to be unchecked-able"
    except Exception as exc:
        assert "not in a checkable state" in str(exc).lower()

    # --- activation -------------------------------------------------------
    registry.activate_project("proj1")
    # The critical invariant: activation does NOT confer trust.
    assert registry.get_status("proj1") == "PENDING_FIRST_CHECK"
    assert registry.is_safe("proj1") is False
    assert json.loads(registry.get_project("proj1"))["activated_at"]

    gate = _bind_gate(registry, "proj1")
    assert gate.is_gate_open() is False
    assert _refuses_high_risk(gate, "0xaaaa0001") is True
    # ...while a low-risk action is unaffected (policy separation).
    gate.execute_low_risk("0xbbbb0001")

    # Registration fields are sealed once activated.
    try:
        registry.update_draft("proj1", name="renamed")
        assert False, "expected post-activation immutability"
    except Exception as exc:
        assert "not mutable" in str(exc)

    # --- first check ------------------------------------------------------
    web_q.push_round({
        FRONTEND: FRONTEND_CONTENT_CLEAN,
        RELEASE: RELEASE_CONTENT_CLEAN,
        INCIDENT: INCIDENT_CONTENT_CLEAN,
    })
    _script_agreement(prompt_q, CLEAN_FINDING)
    registry.run_safety_check("proj1")

    assert registry.get_status("proj1") == "SAFE"
    assert registry.is_safe("proj1") is True

    history = _history(registry, "proj1")
    assert len(history) == 1
    first = history[0]
    assert first["type"] == "CHECK"
    assert first["previous_status"] == "PENDING_FIRST_CHECK"
    assert first["new_status"] == "SAFE"
    assert first["finding"]["finding"] == "CLEAN"
    assert json.loads(registry.get_project("proj1"))["last_finding"] == "CLEAN"

    # Only now does the gate open, and a high-risk action actually executes.
    assert gate.is_gate_open() is True
    gate.execute_high_risk("0xaaaa0002")
    counts = json.loads(gate.get_counts())
    assert counts["high_risk_executed"] == 1


def test_first_check_is_required_not_assumed_for_every_new_project():
    """Two independently registered projects both start closed at the gate."""
    registry, gl, web_q, prompt_q = _fresh()
    for i, pid in enumerate(["p-a", "p-b"]):
        registry.register_project(
            pid, f"App {pid}",
            f"https://app{i}.example.com/",
            f"https://github.com/example/app{i}/releases/v1",
            f"https://status{i}.example.com/",
            "0xexpectedaddress", 300, "RESTRICTED", "RESTRICTED",
        )
        registry.activate_project(pid)
        assert registry.get_status(pid) == "PENDING_FIRST_CHECK"
        assert registry.is_safe(pid) is False
        assert _refuses_high_risk(_bind_gate(registry, pid), "0xdddd000" + str(i)) is True


# ---------------------------------------------------------------------------
# Flow 2: recovery submission -> recovery check -> RECOVERED -> SAFE
# ---------------------------------------------------------------------------

def _restrict(registry, web_q, prompt_q):
    registry.register_project(
        "proj1", "Example App", FRONTEND, RELEASE, INCIDENT,
        "0xexpectedaddress", 300, "RESTRICTED", "RESTRICTED",
    )
    registry.activate_project("proj1")
    web_q.push_round({
        FRONTEND: FRONTEND_CONTENT_BAD,
        RELEASE: RELEASE_CONTENT_BAD,
        INCIDENT: INCIDENT_CONTENT_BAD,
    })
    _script_agreement(prompt_q, COMPROMISED_FINDING)
    registry.run_safety_check("proj1")
    assert registry.get_status("proj1") == "RESTRICTED"


def test_recovery_submission_check_recovered_safe_flow():
    registry, gl, web_q, prompt_q = _fresh()
    _restrict(registry, web_q, prompt_q)
    gate = _bind_gate(registry, "proj1")

    assert registry.is_safe("proj1") is False
    assert gate.is_gate_open() is False
    assert _refuses_high_risk(gate, "0xcccc0001") is True
    version_before = json.loads(registry.get_project("proj1"))["version"]

    # --- recovery submission ---------------------------------------------
    registry.submit_recovery(
        "proj1", RECOVERY_RELEASE, None,
        "rotated compromised deploy keys and rebuilt from a clean source tree",
    )
    assert registry.get_status("proj1") == "RECOVERY_PENDING"
    # Submitting a recovery is NOT a recovery: the gate stays shut.
    assert registry.is_safe("proj1") is False
    assert gate.is_gate_open() is False
    assert _refuses_high_risk(gate, "0xcccc0002") is True

    project = json.loads(registry.get_project("proj1"))
    assert project["release_url"] == RECOVERY_RELEASE
    assert project["version"] == version_before + 1
    assert project["recovery_pending"] is True
    assert _types(registry, "proj1") == ["CHECK", "RECOVERY_SUBMITTED"]
    submitted = _history(registry, "proj1")[-1]
    assert submitted["previous_release_url"] == RELEASE
    assert submitted["new_release_url"] == RECOVERY_RELEASE

    # There is no owner-callable escape hatch at any point in this flow.
    assert not hasattr(registry, "force_safe")
    assert not hasattr(registry, "owner_override_status")

    # --- recovery check -> RECOVERED --------------------------------------
    web_q.push_round({
        FRONTEND: FRONTEND_CONTENT_CLEAN,
        RECOVERY_RELEASE: RELEASE_CONTENT_CLEAN,
        INCIDENT: INCIDENT_CONTENT_CLEAN,
    })
    _script_agreement(prompt_q, dict(CLEAN_FINDING, incident_state="RESOLVED"))
    registry.run_recovery_check("proj1")

    assert registry.get_status("proj1") == "RECOVERED"
    assert _types(registry, "proj1") == ["CHECK", "RECOVERY_SUBMITTED", "RECOVERY_CHECK"]
    recovery_check = _history(registry, "proj1")[-1]
    assert recovery_check["result"] == "RECOVERED"
    assert recovery_check["finding"]["finding"] == "CLEAN"

    # --- RECOVERED -> SAFE ------------------------------------------------
    registry.mark_recovered_safe("proj1")
    assert registry.get_status("proj1") == "SAFE"
    assert registry.is_safe("proj1") is True
    assert json.loads(registry.get_project("proj1"))["recovery_pending"] is False
    assert _types(registry, "proj1") == [
        "CHECK", "RECOVERY_SUBMITTED", "RECOVERY_CHECK", "PROMOTED_SAFE",
    ]

    # The gate reopens only at the end of this full verified path.
    assert gate.is_gate_open() is True
    gate.execute_high_risk("0xcccc0003")
    assert json.loads(gate.get_counts())["high_risk_executed"] == 1

    # Nothing in the history was rewritten along the way.
    history = _history(registry, "proj1")
    assert history[0]["new_status"] == "RESTRICTED"
    assert history[0]["finding"]["finding"] == "COMPROMISED"


def test_recovered_state_already_permits_high_risk_before_promotion():
    """RECOVERED is consensus-confirmed, so is_safe() is already true; the
    PROMOTED_SAFE step is bookkeeping, not the thing that grants trust."""
    registry, gl, web_q, prompt_q = _fresh()
    _restrict(registry, web_q, prompt_q)
    registry.submit_recovery("proj1", RECOVERY_RELEASE, None, "rotated compromised deploy keys")

    web_q.push_round({
        FRONTEND: FRONTEND_CONTENT_CLEAN,
        RECOVERY_RELEASE: RELEASE_CONTENT_CLEAN,
        INCIDENT: INCIDENT_CONTENT_CLEAN,
    })
    _script_agreement(prompt_q, dict(CLEAN_FINDING, incident_state="RESOLVED"))
    registry.run_recovery_check("proj1")

    assert registry.get_status("proj1") == "RECOVERED"
    assert registry.is_safe("proj1") is True
    gate = _bind_gate(registry, "proj1")
    assert gate.is_gate_open() is True


def test_mark_recovered_safe_rejected_before_a_fresh_consensus_check():
    """The owner cannot skip run_recovery_check and promote straight to SAFE."""
    registry, gl, web_q, prompt_q = _fresh()
    _restrict(registry, web_q, prompt_q)
    registry.submit_recovery("proj1", RECOVERY_RELEASE, None, "rotated compromised deploy keys")
    assert registry.get_status("proj1") == "RECOVERY_PENDING"

    try:
        registry.mark_recovered_safe("proj1")
        assert False, "expected promotion to require a RECOVERED status first"
    except Exception as exc:
        assert "recovered" in str(exc).lower()

    assert registry.get_status("proj1") == "RECOVERY_PENDING"
    assert registry.is_safe("proj1") is False
