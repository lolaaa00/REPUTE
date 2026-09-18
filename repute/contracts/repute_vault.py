# v0.2.18
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *

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
# Storage types
# ────────────────────────────────────────────────────────────────────────────

@dataclass
class LoanRecord:
    loan_id: u256
    borrower: Address
    profile_id: u256
    credit_band_snapshot: str
    collateral: u256
    principal: u256
    issued_at: u256
    due_at: u256
    repaid_amount: u256
    status: str  # ACTIVE | REPAID | DEFAULTED | CLOSED


@dataclass
class LiquidityProvider:
    provider: Address
    deposited: u256


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
# ────────────────────────────────────────────────────────────────────────────

class ReputeVault(gl.Contract):
    profile_contract: Address
    next_loan_id: u256
    loans: TreeMap[u256, LoanRecord]
    # profile_id → active loan_id
    active_loan: TreeMap[u256, u256]
    has_active_loan: TreeMap[u256, bool]
    # profile_id → loan_ids list
    loan_history: TreeMap[u256, DynArray[u256]]

    # Vault accounting
    total_liquidity: u256      # total GEN deposited by LPs
    reserved_liquidity: u256   # principal currently lent out
    total_collateral: u256     # collateral currently held
    repaid_principal: u256     # cumulative repaid principal

    # LP deposits
    lp_deposits: TreeMap[Address, u256]
    lp_list: DynArray[Address]

    def __init__(self, profile_contract: Address):
        self.profile_contract = profile_contract
        self.next_loan_id = u256(1)
        self.total_liquidity = u256(0)
        self.reserved_liquidity = u256(0)
        self.total_collateral = u256(0)
        self.repaid_principal = u256(0)

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
        # max_loan = collateral * mult / 100
        return (collateral * mult) // 100

    def _available_liquidity(self) -> int:
        total = int(self.total_liquidity)
        reserved = int(self.reserved_liquidity)
        collat = int(self.total_collateral)
        # Available = total deposited + collateral held - reserved
        return total + collat - reserved

    def _conservation_check(self):
        # outflows (reserved) + available must == total_liquidity + total_collateral
        avail = self._available_liquidity()
        assert avail >= 0, "conservation violated"

    # ── views ───────────────────────────────────────────────────────────────

    @gl.public.view
    def get_loan(self, loan_id: u256) -> LoanRecord:
        assert loan_id in self.loans, "loan not found"
        return self.loans[loan_id]

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
        band = self._profile().profile_credit_band(profile_id)
        return u256(self._max_loan(int(collateral_amount), band))

    # ── LP deposit ──────────────────────────────────────────────────────────

    @gl.public.write
    def deposit_liquidity(self):
        """LP deposits GEN liquidity. Value sent with tx."""
        amount = int(gl.message.value)
        assert amount > 0, "no value sent"
        caller = gl.message.sender

        if int(self.lp_deposits.get(caller, u256(0))) == 0:
            self.lp_list.append(caller)

        current = int(self.lp_deposits.get(caller, u256(0)))
        self.lp_deposits[caller] = u256(current + amount)
        self.total_liquidity = u256(int(self.total_liquidity) + amount)

    @gl.public.view
    def get_lp_balance(self, provider: Address) -> u256:
        return self.lp_deposits.get(provider, u256(0))

    # ── borrow flow ─────────────────────────────────────────────────────────

    @gl.public.write
    def borrow(self, profile_id: u256, principal: u256):
        """
        Borrower sends collateral as msg.value.
        profile_id: the borrower's sealed profile.
        principal: amount to borrow (transferred to caller).
        """
        caller = gl.message.sender
        collateral = int(gl.message.value)
        principal_int = int(principal)

        assert collateral > 0, "collateral required"
        assert principal_int > 0, "principal must be positive"

        # Verify caller owns profile
        operator_pid = self._profile().get_operator_profile_id(caller)
        assert int(operator_pid) == int(profile_id), "not profile owner"

        # Verify review is fresh
        assert self._profile().review_is_fresh(profile_id), "review stale or missing"

        # Read credit band
        band = self._profile().profile_credit_band(profile_id)
        assert band != "NONE", "credit band NONE: not eligible"

        # Compute max loan for this collateral
        max_loan = self._max_loan(collateral, band)
        assert principal_int <= max_loan, "principal exceeds band limit"

        # Per-borrower hard cap
        assert principal_int <= PER_BORROWER_MAX, "exceeds per-borrower cap"

        # No active loan
        if profile_id in self.has_active_loan:
            assert not self.has_active_loan[profile_id], "active loan exists"

        # Liquidity cap
        avail = self._available_liquidity()
        assert principal_int <= avail, "insufficient vault liquidity"

        # Concentration cap: principal <= 30% of (total_liquidity + total_collateral)
        pool = int(self.total_liquidity) + int(self.total_collateral)
        if pool > 0:
            concentration = (principal_int * 10000) // pool
            assert concentration <= CONCENTRATION_BPS, "concentration cap exceeded"

        # Record loan — update storage BEFORE transfer
        now = u256(gl.contract_runner.block_timestamp)
        due = u256(int(now) + LOAN_DURATION)

        loan_id = self.next_loan_id
        self.next_loan_id = u256(int(loan_id) + 1)

        loan = LoanRecord(
            loan_id=loan_id,
            borrower=caller,
            profile_id=profile_id,
            credit_band_snapshot=band,
            collateral=u256(collateral),
            principal=principal,
            issued_at=now,
            due_at=due,
            repaid_amount=u256(0),
            status="ACTIVE",
        )
        self.loans[loan_id] = loan

        # Update accounting
        self.total_collateral = u256(int(self.total_collateral) + collateral)
        self.reserved_liquidity = u256(int(self.reserved_liquidity) + principal_int)
        self.active_loan[profile_id] = loan_id
        self.has_active_loan[profile_id] = True

        if profile_id not in self.loan_history:
            self.loan_history[profile_id] = DynArray()
        hist = self.loan_history[profile_id]
        hist.append(loan_id)
        self.loan_history[profile_id] = hist

        self._conservation_check()

        # Transfer principal to borrower
        gl.message.sender.transfer(principal_int)

    # ── repayment ───────────────────────────────────────────────────────────

    @gl.public.write
    def repay(self, loan_id: u256):
        """Borrower repays principal. Sends exact principal as msg.value."""
        caller = gl.message.sender
        amount = int(gl.message.value)

        assert loan_id in self.loans, "loan not found"
        loan = self.loans[loan_id]
        assert loan.borrower == caller, "not borrower"
        assert loan.status == "ACTIVE", "loan not active"

        principal_int = int(loan.principal)
        assert amount == principal_int, "must repay exact principal"

        profile_id = loan.profile_id

        # Update state BEFORE any transfer
        loan.repaid_amount = u256(amount)
        loan.status = "REPAID"
        self.loans[loan_id] = loan

        self.has_active_loan[profile_id] = False

        collateral_int = int(loan.collateral)
        self.total_collateral = u256(int(self.total_collateral) - collateral_int)
        self.reserved_liquidity = u256(int(self.reserved_liquidity) - principal_int)
        self.repaid_principal = u256(int(self.repaid_principal) + principal_int)

        self._conservation_check()

        # Record repayment on profile
        self._profile().record_repayment(profile_id)

        # Return collateral to borrower
        caller.transfer(collateral_int)

    # ── default ─────────────────────────────────────────────────────────────

    @gl.public.write
    def mark_default(self, loan_id: u256):
        """Permissionless. Anyone may call after due_at passes."""
        assert loan_id in self.loans, "loan not found"
        loan = self.loans[loan_id]
        assert loan.status == "ACTIVE", "loan not active"

        now = int(gl.contract_runner.block_timestamp)
        assert now > int(loan.due_at), "loan not yet due"

        profile_id = loan.profile_id

        # Update state
        loan.status = "DEFAULTED"
        self.loans[loan_id] = loan

        self.has_active_loan[profile_id] = False

        principal_int = int(loan.principal)
        collateral_int = int(loan.collateral)

        # Apply collateral against loss — collateral stays in vault
        # reserved_liquidity decreases by principal (the loss is covered partially by collateral)
        self.reserved_liquidity = u256(int(self.reserved_liquidity) - principal_int)
        # Collateral is now converted to vault liquidity (penalty)
        self.total_collateral = u256(int(self.total_collateral) - collateral_int)
        self.total_liquidity = u256(int(self.total_liquidity) + collateral_int)

        self._conservation_check()

        # Record default on profile
        self._profile().record_default(profile_id)
        # No caller reward
