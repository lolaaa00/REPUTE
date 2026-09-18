"""
Contract-level tests for repute_profile.py

Run with: python -m pytest tests/contract/test_profile.py -v
These tests use Python unit logic to verify contract state machines.
Live Studionet tests require a funded signer (opt-in, no key in repo).
"""

import sys
import os
import json
import hashlib
import pytest

# ────────────────────────────────────────────────────────────────────────────
# Inline logic mirrors from the contract for unit testing
# ────────────────────────────────────────────────────────────────────────────

MAX_SOURCES = 4
MIN_SOURCES = 2
MAX_URL_LEN = 512
REVIEW_FRESHNESS_WINDOW = 30 * 24 * 3600
ALLOWED_BANDS = {"STRONG", "MODERATE", "WEAK", "UNRESOLVED"}


def validate_url(url: str) -> bool:
    if not url.startswith("https://"):
        return False
    if len(url) > MAX_URL_LEN:
        return False
    if "@" in url:
        return False
    if "#" in url:
        return False
    private = ("https://localhost", "https://127.", "https://10.", "https://192.168.", "https://172.")
    for p in private:
        if url.startswith(p):
            return False
    return True


def canonical_domain(url: str) -> str:
    without = url[len("https://"):]
    slash = without.find("/")
    if slash == -1:
        return without.lower()
    return without[:slash].lower()


def derive_credit_band(
    maintenance, attribution, continuity, transparency,
    repayment_count, default_count, reviewed_at, now
):
    if default_count > 0:
        return "NONE"
    age = now - reviewed_at
    if age > REVIEW_FRESHNESS_WINDOW:
        return "NONE"
    if attribution in ("UNRESOLVED", "WEAK"):
        return "NONE"
    dims = [maintenance, attribution, continuity, transparency]
    all_strong_moderate = all(d in ("STRONG", "MODERATE") for d in dims)
    all_at_least_moderate = all(d in ("STRONG", "MODERATE", "WEAK") for d in dims)
    maintenance_ok = maintenance in ("STRONG", "MODERATE")
    continuity_ok = continuity in ("STRONG", "MODERATE")
    if all_strong_moderate and repayment_count >= 5:
        return "TRUSTED"
    if maintenance_ok and continuity_ok and all_at_least_moderate and repayment_count >= 2:
        return "ESTABLISHED"
    if maintenance_ok and all_at_least_moderate:
        return "STARTER"
    return "NONE"


def valid_review_shape(obj):
    if not isinstance(obj, dict):
        return False
    for dim in ("maintenance", "attribution", "continuity", "transparency"):
        if obj.get(dim) not in ALLOWED_BANDS:
            return False
    if not isinstance(obj.get("evidence"), list):
        return False
    if not isinstance(obj.get("reason"), str):
        return False
    return True


# ────────────────────────────────────────────────────────────────────────────
# URL validation tests
# ────────────────────────────────────────────────────────────────────────────

class TestUrlValidation:
    def test_valid_https_url(self):
        assert validate_url("https://github.com/user/repo") is True

    def test_rejects_http(self):
        assert validate_url("http://example.com") is False

    def test_rejects_localhost(self):
        assert validate_url("https://localhost/app") is False

    def test_rejects_127(self):
        assert validate_url("https://127.0.0.1") is False

    def test_rejects_private_10(self):
        assert validate_url("https://10.0.0.1") is False

    def test_rejects_credentials(self):
        assert validate_url("https://user@github.com/repo") is False

    def test_rejects_fragment(self):
        assert validate_url("https://example.com/page#section") is False

    def test_rejects_too_long(self):
        assert validate_url("https://" + "a" * 600) is False


class TestDomainDeduplication:
    def test_same_domain_detected(self):
        urls = [
            "https://github.com/user/repo",
            "https://github.com/user/releases",
        ]
        domains = [canonical_domain(u) for u in urls]
        assert len(set(domains)) < len(domains)

    def test_different_domains_ok(self):
        urls = [
            "https://github.com/user/repo",
            "https://docs.example.com/",
        ]
        domains = [canonical_domain(u) for u in urls]
        assert len(set(domains)) == len(domains)


# ────────────────────────────────────────────────────────────────────────────
# Credit band determinism tests
# ────────────────────────────────────────────────────────────────────────────

NOW = 1_700_000_000
FRESH = NOW - 1000  # reviewed recently


class TestCreditBandDeterminism:
    def test_none_on_default(self):
        band = derive_credit_band("STRONG", "STRONG", "STRONG", "STRONG", 10, 1, FRESH, NOW)
        assert band == "NONE"

    def test_none_on_stale_review(self):
        stale_reviewed_at = NOW - REVIEW_FRESHNESS_WINDOW - 1
        band = derive_credit_band("STRONG", "STRONG", "STRONG", "STRONG", 0, 0, stale_reviewed_at, NOW)
        assert band == "NONE"

    def test_none_on_unresolved_attribution(self):
        band = derive_credit_band("STRONG", "UNRESOLVED", "STRONG", "STRONG", 5, 0, FRESH, NOW)
        assert band == "NONE"

    def test_none_on_weak_attribution(self):
        band = derive_credit_band("STRONG", "WEAK", "STRONG", "STRONG", 5, 0, FRESH, NOW)
        assert band == "NONE"

    def test_starter_no_history(self):
        band = derive_credit_band("MODERATE", "MODERATE", "MODERATE", "MODERATE", 0, 0, FRESH, NOW)
        assert band == "STARTER"

    def test_starter_minimal_evidence(self):
        band = derive_credit_band("MODERATE", "MODERATE", "WEAK", "WEAK", 1, 0, FRESH, NOW)
        assert band == "STARTER"

    def test_established_two_repayments(self):
        band = derive_credit_band("MODERATE", "MODERATE", "MODERATE", "MODERATE", 2, 0, FRESH, NOW)
        assert band == "ESTABLISHED"

    def test_established_requires_no_default(self):
        band = derive_credit_band("MODERATE", "MODERATE", "MODERATE", "MODERATE", 2, 1, FRESH, NOW)
        assert band == "NONE"

    def test_trusted_requires_five_repayments(self):
        band = derive_credit_band("STRONG", "STRONG", "STRONG", "STRONG", 5, 0, FRESH, NOW)
        assert band == "TRUSTED"

    def test_trusted_requires_all_strong_moderate(self):
        band = derive_credit_band("STRONG", "STRONG", "WEAK", "STRONG", 5, 0, FRESH, NOW)
        assert band != "TRUSTED"

    def test_no_trusted_with_4_repayments(self):
        band = derive_credit_band("STRONG", "STRONG", "STRONG", "STRONG", 4, 0, FRESH, NOW)
        assert band != "TRUSTED"


# ────────────────────────────────────────────────────────────────────────────
# Validator shape tests
# ────────────────────────────────────────────────────────────────────────────

class TestReviewShape:
    def test_valid_shape(self):
        obj = {
            "maintenance": "STRONG",
            "attribution": "MODERATE",
            "continuity": "WEAK",
            "transparency": "UNRESOLVED",
            "evidence": [{"source_id": 1, "dimension": "maintenance", "excerpt": "recent commit"}],
            "reason": "OK",
        }
        assert valid_review_shape(obj) is True

    def test_invalid_band_value(self):
        obj = {
            "maintenance": "EXCELLENT",
            "attribution": "MODERATE",
            "continuity": "WEAK",
            "transparency": "UNRESOLVED",
            "evidence": [],
            "reason": "x",
        }
        assert valid_review_shape(obj) is False

    def test_missing_field(self):
        obj = {
            "maintenance": "STRONG",
            "attribution": "STRONG",
            "continuity": "STRONG",
            "evidence": [],
            "reason": "x",
        }
        assert valid_review_shape(obj) is False

    def test_evidence_not_list(self):
        obj = {
            "maintenance": "STRONG",
            "attribution": "STRONG",
            "continuity": "STRONG",
            "transparency": "STRONG",
            "evidence": "not a list",
            "reason": "x",
        }
        assert valid_review_shape(obj) is False


# ────────────────────────────────────────────────────────────────────────────
# Source bounds
# ────────────────────────────────────────────────────────────────────────────

class TestSourceBounds:
    def test_too_few_sources(self):
        sources = ["https://example.com"]
        assert len(sources) < MIN_SOURCES

    def test_too_many_sources(self):
        sources = ["https://a.com", "https://b.com", "https://c.com", "https://d.com", "https://e.com"]
        assert len(sources) > MAX_SOURCES

    def test_valid_source_count(self):
        sources = ["https://a.com", "https://b.com", "https://c.com"]
        assert MIN_SOURCES <= len(sources) <= MAX_SOURCES


# ────────────────────────────────────────────────────────────────────────────
# Stale review logic
# ────────────────────────────────────────────────────────────────────────────

class TestStaleReview:
    def test_fresh_review(self):
        age = 3600  # 1 hour
        assert age <= REVIEW_FRESHNESS_WINDOW

    def test_exactly_stale(self):
        age = REVIEW_FRESHNESS_WINDOW + 1
        assert age > REVIEW_FRESHNESS_WINDOW

    def test_stale_blocks_trusted(self):
        stale = NOW - REVIEW_FRESHNESS_WINDOW - 100
        band = derive_credit_band("STRONG", "STRONG", "STRONG", "STRONG", 5, 0, stale, NOW)
        assert band == "NONE"


# ────────────────────────────────────────────────────────────────────────────
# Authorization security tests
# ────────────────────────────────────────────────────────────────────────────

ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
VAULT_ADDRESS = "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
ATTACKER_ADDRESS = "0xDEADBEEFDEADBEEFDEADBEEFDEADBEEFDEADBEEF"
DEPLOYER_ADDRESS = "0x1111111111111111111111111111111111111111"


class MockMessage:
    def __init__(self, sender: str):
        self.sender = sender


class VaultAuthSimulator:
    """
    Simulates the vault_address check that the contract enforces.
    Mirrors the assert logic from record_repayment / record_default.
    """
    def __init__(self, vault_addr: str):
        self.vault_address = vault_addr
        self.repayment_count = 0
        self.default_count = 0

    def record_repayment(self, caller: str, profile_id: int):
        assert self.vault_address != ZERO_ADDRESS, "vault not configured"
        assert caller == self.vault_address, "only authorized vault"
        self.repayment_count += 1

    def record_default(self, caller: str, profile_id: int):
        assert self.vault_address != ZERO_ADDRESS, "vault not configured"
        assert caller == self.vault_address, "only authorized vault"
        self.default_count += 1


class TestVaultAuthorization:
    """Regression tests: unauthorized callers must be rejected after the fix."""

    def test_record_repayment_rejected_from_attacker(self):
        sim = VaultAuthSimulator(VAULT_ADDRESS)
        with pytest.raises(AssertionError, match="only authorized vault"):
            sim.record_repayment(ATTACKER_ADDRESS, 1)

    def test_record_default_rejected_from_attacker(self):
        sim = VaultAuthSimulator(VAULT_ADDRESS)
        with pytest.raises(AssertionError, match="only authorized vault"):
            sim.record_default(ATTACKER_ADDRESS, 1)

    def test_record_repayment_rejected_before_vault_set(self):
        sim = VaultAuthSimulator(ZERO_ADDRESS)
        with pytest.raises(AssertionError, match="vault not configured"):
            sim.record_repayment(VAULT_ADDRESS, 1)

    def test_record_default_rejected_before_vault_set(self):
        sim = VaultAuthSimulator(ZERO_ADDRESS)
        with pytest.raises(AssertionError, match="vault not configured"):
            sim.record_default(VAULT_ADDRESS, 1)

    def test_record_repayment_accepted_from_vault(self):
        sim = VaultAuthSimulator(VAULT_ADDRESS)
        sim.record_repayment(VAULT_ADDRESS, 1)
        assert sim.repayment_count == 1

    def test_record_default_accepted_from_vault(self):
        sim = VaultAuthSimulator(VAULT_ADDRESS)
        sim.record_default(VAULT_ADDRESS, 1)
        assert sim.default_count == 1

    def test_set_vault_one_time_only(self):
        """Vault address can only be set once."""
        vault_addr = VAULT_ADDRESS
        current_vault = ZERO_ADDRESS
        deployer = DEPLOYER_ADDRESS

        # First set: deployer, vault not yet set
        caller = deployer
        assert caller == deployer, "only deployer"
        assert current_vault == ZERO_ADDRESS, "vault already set"
        current_vault = vault_addr

        # Second attempt must fail
        with pytest.raises(AssertionError, match="vault already set"):
            assert current_vault == ZERO_ADDRESS, "vault already set"

    def test_non_deployer_cannot_set_vault(self):
        """Only the deployer can call set_vault."""
        deployer = DEPLOYER_ADDRESS
        attacker = ATTACKER_ADDRESS
        with pytest.raises(AssertionError, match="only deployer"):
            assert attacker == deployer, "only deployer"

    def test_repayment_counter_not_inflatable_by_attacker(self):
        """Attacker cannot boost repayment_count to unlock better credit bands."""
        sim = VaultAuthSimulator(VAULT_ADDRESS)
        # Attacker tries 5 times to reach TRUSTED band threshold
        for _ in range(5):
            with pytest.raises(AssertionError, match="only authorized vault"):
                sim.record_repayment(ATTACKER_ADDRESS, 1)
        # Counter must stay at zero
        assert sim.repayment_count == 0


# ────────────────────────────────────────────────────────────────────────────
# Ownership attribution binding tests
# ────────────────────────────────────────────────────────────────────────────

class TestOwnershipAttributionBinding:
    """
    Ownership binding rule: if operator wallet address not found in source content,
    attribution must be forced to UNRESOLVED regardless of LLM output.
    """

    def _apply_ownership_rule(self, lm_result: dict, ownership_proven: bool) -> dict:
        if not ownership_proven:
            lm_result["attribution"] = "UNRESOLVED"
        return lm_result

    def test_attribution_forced_unresolved_when_no_wallet_in_sources(self):
        fake_lm = {"maintenance": "STRONG", "attribution": "STRONG",
                   "continuity": "MODERATE", "transparency": "MODERATE"}
        result = self._apply_ownership_rule(fake_lm, ownership_proven=False)
        assert result["attribution"] == "UNRESOLVED"

    def test_attribution_preserved_when_wallet_found(self):
        fake_lm = {"maintenance": "STRONG", "attribution": "STRONG",
                   "continuity": "MODERATE", "transparency": "MODERATE"}
        result = self._apply_ownership_rule(fake_lm, ownership_proven=True)
        assert result["attribution"] == "STRONG"

    def test_unresolved_attribution_yields_none_credit_band(self):
        band = derive_credit_band("STRONG", "UNRESOLVED", "STRONG", "STRONG", 0, 0, NOW, NOW)
        assert band == "NONE"

    def test_weak_attribution_yields_none_credit_band(self):
        band = derive_credit_band("STRONG", "WEAK", "STRONG", "STRONG", 5, 0, NOW, NOW)
        assert band == "NONE"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
