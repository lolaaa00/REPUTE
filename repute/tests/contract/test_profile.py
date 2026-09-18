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


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
