# Reviewer demo walkthrough

Failover is **live on GenLayer Studionet**. There are two ways to walk the lifecycle, and
this document covers both, in order:

1. **Live walkthrough** (section A) — against the deployed contracts on chain 61999.
   Requires a Studionet wallet with a little GEN for the write steps; all read steps work
   with no wallet at all.
2. **Fixture walkthrough** (section B) — the `/demo` routes, which need no wallet, no
   node, and no live external sites. These are clearly marked **DEMO MODE** and are the
   *only* fixture-backed routes in the app.

## Canonical deployment

```
Network:            GenLayer Studionet
Chain ID:           61999
RPC:                https://studio.genlayer.com/api
Explorer:           https://explorer-studio.genlayer.com
FailoverRegistry:   0x2A858500C75fC3880BB87CCd2C30Fd4c1AdE0A1a
FailoverGate:       0xD6fAA5b4EfA47393F92eA71787528C86F4bb736f  (bound to project failover-demo)
```

Full deployment evidence — transaction hashes, contract source SHA-256s, consensus status
and validator votes — is in `docs/DEPLOYMENT.md`. These same values are the ones
`lib/contract/addresses.ts` resolves to and the ones every live page prints in its header
plate, so the docs, the code, and the UI agree.

Start the app:

```bash
npm install
npm run dev
```

Then open `http://localhost:3000` (or the deployed frontend,
`https://failover-black.vercel.app`).

---

# Section A — Live walkthrough (deployed contracts)

Every route below reads the deployed `FailoverRegistry` / `FailoverGate` directly. None
of them falls back to fixture data: if a live read fails you get a red **"Failed to load
live data"** panel with a **Retry live read** button, never a fabricated SAFE badge. That
behavior is pinned by
`tests/frontend/liveProjects.test.tsx::live project list -> shows an error state and does NOT fall back to fixture data`.

## A1 — Registered projects

```
http://localhost:3000/projects
```

Reads `list_project_ids()` then `get_project(id)` for each. The header plate shows chain
`61999`, the canonical RPC, and the registry address. You should see the deployed
`failover-demo` project with its current on-chain status annunciator.

## A2 — Registration → activation → first check

Register a project at `/new`. Client-side Zod validation mirrors the contract's
`validate_public_url` / length bounds before anything is submitted, so obviously invalid
input never becomes a transaction.

After registration the project's status is `DRAFT`. Open its dossier (`/p/<id>`) and use
**Activate** — `activate_project` moves it to `PENDING_FIRST_CHECK`, **not** `SAFE`. A
brand-new project is not trusted until consensus has actually looked at it, and
`is_safe()` is `false` in the meantime, so the gate already refuses high-risk actions.
This exact sequence is asserted end-to-end by
`tests/contract/test_lifecycle_integration.py::test_registration_activation_first_check_flow`.

Then open the check chamber:

```
http://localhost:3000/p/<id>/check
```

`run_safety_check` is permissionless and pays no bounty. Watch the lifecycle panel walk
`AWAITING_SIGNATURE -> SUBMITTED -> CONSENSUS_RUNNING -> FINALIZED ->
EXECUTION_CONFIRMED -> STATE_REREAD`. A tx hash on its own is never reported as success:
consensus failure, a finalized-but-reverted execution, and a post-write reread that does
not match the expected outcome are all distinct, terminal, visible failure states
(`tests/frontend/liveTxOutcomes.test.tsx`).

On a clean consensus finding the status becomes `SAFE`.

## A3 — RESTRICTED (compromise detected)

When a check's consensus finding is `COMPROMISED` or `IMPERSONATED`, the deterministic
`map_finding_to_status` mapping flips the project to `RESTRICTED`. This is a pure
function, not a judgment call — re-run it yourself against
`tests/contract/test_helpers.py::test_map_finding_to_status_compromised_and_impersonated_restrict`.

Now open the live gate:

```
http://localhost:3000/gate/<id>
```

`is_gate_open()` reads closed, and `execute_high_risk` raises
`"gate refused: project is not currently SAFE/RECOVERED"` — surfaced in the UI as
`EXECUTION_ERROR`, not a false success
(`tests/contract/test_gate_protocol.py::test_restricted_refuses_high_risk_action`,
`tests/frontend/liveGate.test.tsx`). `execute_low_risk` stays callable: this is policy
separation, not a blanket pause
(`test_gate_protocol.py::test_low_risk_action_allowed_while_restricted`).
`try_execute_high_risk_or_record_refusal` writes a durable `REFUSED_NOT_SAFE` receipt
instead of reverting, and replaying an already-used `action_hash` is rejected
(`test_replay_of_action_hash_rejected`).

## A4 — RECOVERY_PENDING

```
http://localhost:3000/p/<id>/recovery
```

`submit_recovery` requires a genuinely new release URL — resubmitting the implicated one
is rejected (`test_recovery_url_reuse_rejected`). `version` increments and status becomes
`RECOVERY_PENDING`. The owner **cannot** self-declare recovery; there is no `force_safe`
or `owner_override_status` method at all
(`test_recovery_cannot_be_owner_self_override`).

## A5 — RECOVERED → SAFE

`run_recovery_check` is again permissionless and needs fresh independent consensus. Only
on a fully-evidenced clean finding does status move to `RECOVERED`; an under-evidenced
"clean" result stays `RECOVERY_PENDING`
(`test_recovery_clean_missing_evidence_stays_pending`). Once `RECOVERED`,
`mark_recovered_safe` promotes to `SAFE` and `is_gate_open()` reads open again. The whole
`RESTRICTED -> RECOVERY_PENDING -> RECOVERED -> SAFE` transition, including the
append-only history records it writes, is covered by
`tests/contract/test_lifecycle_integration.py::test_recovery_submission_check_recovered_safe_flow`.

## A6 — Append-only history

```
http://localhost:3000/incidents
```

Reads `get_history(id)` for every registered project and merges them into one
chronological timeline. Records are never overwritten, even across recovery
(`test_history_is_immutable_append_only`).

---

# Section B — Fixture walkthrough (`/demo`, no wallet needed)

`/demo` and `/demo/gate` are the only fixture-backed routes. Both show a permanent amber
banner reading **"⚠ DEMO MODE — Fixture data only. No live contract interaction. Actions
are simulated."** so fixture content can never be mistaken for on-chain state.

```
http://localhost:3000/demo?stage=SAFE
http://localhost:3000/demo?stage=RESTRICTED
http://localhost:3000/demo?stage=RECOVERY_PENDING
http://localhost:3000/demo?stage=RECOVERED_TO_SAFE
```

The fixtures (`lib/fixtures/demoProject.ts`, project id `orbit-wallet`) walk the same
`SAFE -> RESTRICTED -> RECOVERY_PENDING -> SAFE` lifecycle:

- **SAFE** — `CLEAN_FINDING`: frontend excerpt `"Orbit Wallet v2.3 — official deposit
  contract 0x9f1c...4e2a"`, release tag matching the deployed build, incident channel
  `"All systems operational."`.
- **RESTRICTED** — `COMPROMISED_FINDING`: `frontend_identity: MISMATCH` and
  `expected_address_relation: MISMATCH` because the served deposit address was rewritten
  to `0xATTACKER0000...dead`, and `release_relation: UNRELATED`.
- **RECOVERY_PENDING** — a `RECOVERY_SUBMITTED` record for `v2.4.0-recovery` (rotated
  deploy keys, clean rebuild), `version` 1 → 2, status not yet SAFE.
- **RECOVERED_TO_SAFE** — `RECOVERED_FINDING` restores the expected address,
  `release_relation: CURRENT`, incident `RESOLVED`, and history shows the full
  `CHECK -> CHECK -> RECOVERY_SUBMITTED -> RECOVERY_CHECK -> PROMOTED_SAFE` sequence.

`/demo/gate` simulates the same allow / refuse / replay-rejection behavior the live gate
enforces on-chain.

## Why the fixtures are not a fabrication

Every value in `lib/fixtures/demoProject.ts` is typed against `lib/contract/types.ts`,
which mirrors the contract's real JSON output field-for-field, and the status transitions
match the independently unit-tested pure `map_finding_to_status` function in
`contracts/FailoverRegistry.py`. The fixtures are a faithful stand-in for a reviewer
without a funded wallet — and they are confined to `/demo`. No production page will ever
render them, on error or otherwise.

## Other routes worth a look

- `/` — landing page and the aviation fail-safe hero interlock.
- `/new` — live registration form.
- `/p/<id>` — live dossier, with evaluated-source SHA-256 commitments for the latest
  finding.
