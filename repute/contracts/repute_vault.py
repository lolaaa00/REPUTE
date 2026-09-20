# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import json
from datetime import datetime, timezone

# ────────────────────────────────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────────────────────────────────

# Credit band multipliers (scaled by 100 to avoid floats)
BAND_MULTIPLIER_NONE        = 0    # no borrowing
BAND_MULTIPLIER_STARTER     = 125  # 1.25x
BAND_MULTIPLIER_ESTABLISHED = 175  # 1.75x
BAND_MULTIPLIER_TRUSTED     = 250  # 2.50x

# Per-borrower hard cap: 10 GEN in wei-equivalent (using integer units)
PER_BORROWER_MAX = 10_000_000_000_000_000_000  # 10 GEN in wei

# Concentration cap: one borrower may not hold > 30% of pool
CONCENTRATION_BPS = 3000  # 30%

# Loan duration: 7 days
LOAN_DURATION = 7 * 24 * 3600

REVIEW_FRESHNESS_WINDOW = 30 * 24 * 3600


# ────────────────────────────────────────────────────────────────────────────
# Profile contract interface
# ────────────────────────────────────────────────────────────────────────────

@gl.contract_interface
class IReputeProfile:
    def get_profile(self, profile_id: u256) -> object: ...
    def get_review(self, review_id: u256) -> object: ...
    def profile_credit_band(self, profile_id: u256) -> str: ...
    def review_is_fresh(self, profile_id: u256) -> bool: ...
    def record_repayment(self, profile_id: u256): ...
    def record_default(self, profile_id: u256): ...
    def get_operator_profile_id(self, operator: Address) -> u256: ...


# ────────────────────────────────────────────────────────────────────────────
# Contract
# All complex storage is JSON strings inside TreeMap[K, str]
# ────────────────────────────────────────────────────────────────────────────

class ReputeVault(gl.Contract):
    profile_contract: Address
    next_loan_id: u256
    # JSON-serialized LoanRecord dicts
    loans: TreeMap[u256, str]
    # profile_id → active loan_id
    active_loan: TreeMap[u256, u256]
    has_active_loan: TreeMap[u256, bool]
    # profile_id → JSON-serialized list of loan_ids
    loan_history: TreeMap[u256, str]

    # Vault accounting
    # total_liquidity: sum of LP deposits, reduced by net default losses
    total_liquidity: u256
    # reserved_liquidity: principal currently lent out
    reserved_liquidity: u256
    # total_collateral: borrower collateral currently held
    total_collateral: u256
    # repaid_principal: cumulative principal repaid
    repaid_principal: u256

    # LP deposits (nominal balance per provider)
    lp_deposits: TreeMap[Address, u256]
    lp_list: DynArray[Address]

    def _tx_time(self) -> int:
        dt = datetime.fromisoformat(gl.message_raw["datetime"])
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())

    def __init__(self, profile_contract: Address):
        self.profile_contract = Address(profile_contract)
        self.next_loan_id = u256(1)
        self.total_liquidity = u256(0)
        self.reserved_liquidity = u256(0)
        self.total_collateral = u256(0)
        self.repaid_principal = u256(0)

    # ── serialization helpers ────────────────────────────────────────────────

    def _save_loan(self, loan_id: u256, loan: dict):
        self.loans[loan_id] = json.dumps({
            "loan_id": int(loan["loan_id"]),
            "borrower": str(loan["borrower"]),
            "profile_id": int(loan["profile_id"]),
            "credit_band_snapshot": loan["credit_band_snapshot"],
            "collateral": int(loan["collateral"]),
            "principal": int(loan["principal"]),
            "issued_at": int(loan["issued_at"]),
            "due_at": int(loan["due_at"]),
            "repaid_amount": int(loan["repaid_amount"]),
            "status": loan["status"],
        })

    def _load_loan(self, loan_id: u256) -> dict:
        return json.loads(self.loans[loan_id])

    def _load_history(self, profile_id: u256) -> list:
        if profile_id not in self.loan_history:
            return []
        return json.loads(self.loan_history[profile_id])

    def _save_history(self, profile_id: u256, hist: list):
        self.loan_history[profile_id] = json.dumps(hist)

    # ── internal helpers ────────────────────────────────────────────────────

    def _profile(self) -> IReputeProfile:
        return IReputeProfile(self.profile_contract)

    def _band_multiplier(self, band: str) -> int:
        if band == "TRUSTED":
            return BAND_MULTIPLIER_TRUSTED
        if band == "ESTABLISHED":
            return BAND_MULTIPLIER_ESTABLISHED
        if band == "STARTER":
            return BAND_MULTIPLIER_STARTER
        return BAND_MULTIPLIER_NONE

    def _max_loan(self, collateral: int, band: str) -> int:
        mult = self._band_multiplier(band)
        if mult == 0:
            return 0
        return (collateral * mult) // 100

    def _available_liquidity(self) -> int:
        total = int(self.total_liquidity)
        reserved = int(self.reserved_liquidity)
        collat = int(self.total_collateral)
        # LP-attributable funds + collateral held - principal lent out
        return total + collat - reserved

    def _conservation_check(self):
        avail = self._available_liquidity()
        assert avail >= 0, "conservation violated"

    # ── views ───────────────────────────────────────────────────────────────

    @gl.public.view
    def get_loan(self, loan_id: u256) -> dict:
        assert loan_id in self.loans, "loan not found"
        return self._load_loan(loan_id)

    @gl.public.view
    def get_active_loan_id(self, profile_id: u256) -> u256:
        assert profile_id in self.has_active_loan, "no active loan"
        assert self.has_active_loan[profile_id], "no active loan"
        return self.active_loan[profile_id]

    @gl.public.view
    def get_vault_stats(self) -> dict:
        return {
            "total_liquidity": int(self.total_liquidity),
            "reserved_liquidity": int(self.reserved_liquidity),
            "total_collateral": int(self.total_collateral),
            "repaid_principal": int(self.repaid_principal),
            "available_liquidity": self._available_liquidity(),
        }

    @gl.public.view
    def compute_max_loan(self, profile_id: u256, collateral_amount: u256) -> u256:
        band = self._profile().profile_credit_band(args=[profile_id])
        return u256(self._max_loan(int(collateral_amount), band))

    # ── LP deposit ──────────────────────────────────────────────────────────

    @gl.public.write
    def deposit_liquidity(self):
        """LP deposits GEN liquidity. Value sent with tx."""
        amount = int(gl.message.value)
        assert amount > 0, "no value sent"
        caller = gl.message.sender_address

        if int(self.lp_deposits.get(caller, u256(0))) == 0:
            self.lp_list.append(caller)

        current = int(self.lp_deposits.get(caller, u256(0)))
        self.lp_deposits[caller] = u256(current + amount)
        self.total_liquidity = u256(int(self.total_liquidity) + amount)

    @gl.public.view
    def get_lp_balance(self, provider: Address) -> u256:
        return self.lp_deposits.get(provider, u256(0))

    # ── LP withdrawal ───────────────────────────────────────────────────────

    @gl.public.write
    def withdraw_liquidity(self, amount: u256):
        """LP withdraws their nominal deposit balance, subject to available liquidity."""
        caller = gl.message.sender_address
        amount_int = int(amount)
        assert amount_int > 0, "amount must be positive"

        current = int(self.lp_deposits.get(caller, u256(0)))
        assert current >= amount_int, "insufficient lp balance"

        avail = self._available_liquidity()
        assert amount_int <= avail, "insufficient vault liquidity"

        # Update-before-transfer
        self.lp_deposits[caller] = u256(current - amount_int)
        self.total_liquidity = u256(int(self.total_liquidity) - amount_int)

        self._conservation_check()

        gl.get_contract_at(caller).emit_transfer(value=u256(amount_int))

    # ── borrow flow ─────────────────────────────────────────────────────────

    @gl.public.write
    def borrow(self, profile_id: u256, principal: u256):
        """
        Borrower sends collateral as msg.value.
        profile_id: the borrower's sealed profile.
        principal: amount to borrow (transferred to caller).
        """
        caller = gl.message.sender_address
        collateral = int(gl.message.value)
        principal_int = int(principal)

        assert collateral > 0, "collateral required"
        assert principal_int > 0, "principal must be positive"

        operator_pid = self._profile().get_operator_profile_id(args=[caller])
        assert int(operator_pid) == int(profile_id), "not profile owner"

        fresh = self._profile().review_is_fresh(args=[profile_id])
        assert fresh, "review stale or missing"

        band = self._profile().profile_credit_band(args=[profile_id])
        assert band != "NONE", "credit band NONE: not eligible"

        max_loan = self._max_loan(collateral, band)
        assert principal_int <= max_loan, "principal exceeds band limit"

        assert principal_int <= PER_BORROWER_MAX, "exceeds per-borrower cap"

        if profile_id in self.has_active_loan:
            assert not self.has_active_loan[profile_id], "active loan exists"

        avail = self._available_liquidity()
        assert principal_int <= avail, "insufficient vault liquidity"

        pool = int(self.total_liquidity) + int(self.total_collateral)
        if pool > 0:
            concentration = (principal_int * 10000) // pool
            assert concentration <= CONCENTRATION_BPS, "concentration cap exceeded"

        now = self._tx_time()
        due = now + LOAN_DURATION

        loan_id = self.next_loan_id
        self.next_loan_id = u256(int(loan_id) + 1)

        loan = {
            "loan_id": int(loan_id),
            "borrower": str(caller),
            "profile_id": int(profile_id),
            "credit_band_snapshot": band,
            "collateral": collateral,
            "principal": principal_int,
            "issued_at": now,
            "due_at": due,
            "repaid_amount": 0,
            "status": "ACTIVE",
        }
        self._save_loan(loan_id, loan)

        self.total_collateral = u256(int(self.total_collateral) + collateral)
        self.reserved_liquidity = u256(int(self.reserved_liquidity) + principal_int)
        self.active_loan[profile_id] = loan_id
        self.has_active_loan[profile_id] = True

        hist = self._load_history(profile_id)
        hist.append(int(loan_id))
        self._save_history(profile_id, hist)

        self._conservation_check()

        gl.get_contract_at(gl.message.sender_address).emit_transfer(value=u256(principal_int))

    # ── repayment ───────────────────────────────────────────────────────────

    @gl.public.write
    def repay(self, loan_id: u256):
        """Borrower repays principal. Sends exact principal as msg.value."""
        caller = gl.message.sender_address
        amount = int(gl.message.value)

        assert loan_id in self.loans, "loan not found"
        loan = self._load_loan(loan_id)
        assert loan["borrower"] == str(caller), "not borrower"
        assert loan["status"] == "ACTIVE", "loan not active"

        principal_int = loan["principal"]
        assert amount == principal_int, "must repay exact principal"

        profile_id = u256(loan["profile_id"])

        loan["repaid_amount"] = amount
        loan["status"] = "REPAID"
        self._save_loan(loan_id, loan)

        self.has_active_loan[profile_id] = False

        collateral_int = loan["collateral"]
        self.total_collateral = u256(int(self.total_collateral) - collateral_int)
        self.reserved_liquidity = u256(int(self.reserved_liquidity) - principal_int)
        self.repaid_principal = u256(int(self.repaid_principal) + principal_int)

        self._conservation_check()

        self._profile().record_repayment(args=[profile_id])

        gl.get_contract_at(caller).emit_transfer(value=u256(collateral_int))

    # ── default ─────────────────────────────────────────────────────────────

    @gl.public.write
    def mark_default(self, loan_id: u256):
        """Permissionless. Anyone may call after due_at passes."""
        assert loan_id in self.loans, "loan not found"
        loan = self._load_loan(loan_id)
        assert loan["status"] == "ACTIVE", "loan not active"

        now = self._tx_time()
        assert now > loan["due_at"], "loan not yet due"

        profile_id = u256(loan["profile_id"])

        loan["status"] = "DEFAULTED"
        self._save_loan(loan_id, loan)

        self.has_active_loan[profile_id] = False

        principal_int = loan["principal"]
        collateral_int = loan["collateral"]

        # Default accounting:
        # - reserved_liquidity decreases by principal (no longer lent out)
        # - total_collateral decreases by collateral (stays in vault)
        # - LP pool absorbs net shortfall: principal - collateral
        net_loss = principal_int - collateral_int
        self.reserved_liquidity = u256(int(self.reserved_liquidity) - principal_int)
        self.total_collateral = u256(int(self.total_collateral) - collateral_int)
        if net_loss > 0:
            liq = int(self.total_liquidity)
            self.total_liquidity = u256(max(0, liq - net_loss))

        self._conservation_check()

        self._profile().record_default(args=[profile_id])
