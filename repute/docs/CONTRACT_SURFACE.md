# Contract Surface

## ReputeProfile

### State
| Variable | Type | Description |
|---|---|---|
| `next_profile_id` | u256 | Auto-increment ID counter |
| `next_review_id` | u256 | Auto-increment review ID counter |
| `profiles` | TreeMap[u256, BorrowerProfile] | All profiles |
| `reviews` | TreeMap[u256, OperationalReview] | All reviews |
| `operator_profile` | TreeMap[Address, u256] | Wallet → profile ID |

### BorrowerProfile fields
| Field | Type |
|---|---|
| `profile_id` | u256 |
| `operator` | Address |
| `project_name` | str (max 128) |
| `description` | str (max 512) |
| `sources` | DynArray[Source] (2–4) |
| `created_at` | u256 (timestamp) |
| `sealed_hash` | str (SHA-256 of definition) |
| `sealed` | bool |
| `latest_review_id` | u256 |
| `has_review` | bool |
| `repayment_count` | u256 |
| `default_count` | u256 |
| `status` | str (ACTIVE/SUSPENDED) |

### OperationalReview fields
| Field | Type |
|---|---|
| `review_id` | u256 |
| `profile_id` | u256 |
| `maintenance` | str (STRONG/MODERATE/WEAK/UNRESOLVED) |
| `attribution` | str |
| `continuity` | str |
| `transparency` | str |
| `evidence_json` | str (bounded JSON) |
| `reason` | str (max 600 chars) |
| `reviewed_at` | u256 (timestamp) |
| `credit_band` | str (NONE/STARTER/ESTABLISHED/TRUSTED) |

### Public methods

| Method | Mutating | Description |
|---|---|---|
| `get_profile(profile_id)` | view | Read a profile |
| `get_review(review_id)` | view | Read a review |
| `get_operator_profile_id(operator)` | view | Wallet → profile ID |
| `profile_credit_band(profile_id)` | view | Current effective credit band |
| `review_is_fresh(profile_id)` | view | Review within 30-day window |
| `get_next_profile_id()` | view | Next auto-increment ID |
| `create_profile(name, desc, urls[], labels[])` | write | Register a new dossier |
| `request_operational_review(profile_id)` | write | Trigger consensus review |
| `record_repayment(profile_id)` | write | Increment repayment counter |
| `record_default(profile_id)` | write | Increment default counter |

---

## ReputeVault

### State
| Variable | Type | Description |
|---|---|---|
| `profile_contract` | Address | Bound Profile contract |
| `next_loan_id` | u256 | Auto-increment |
| `loans` | TreeMap[u256, LoanRecord] | All loans |
| `active_loan` | TreeMap[u256, u256] | profile_id → loan_id |
| `has_active_loan` | TreeMap[u256, bool] | Active loan gate |
| `loan_history` | TreeMap[u256, DynArray[u256]] | All loans per profile |
| `total_liquidity` | u256 | LP deposits |
| `reserved_liquidity` | u256 | Principal currently lent |
| `total_collateral` | u256 | Collateral held |
| `repaid_principal` | u256 | Cumulative repaid |
| `lp_deposits` | TreeMap[Address, u256] | Per-LP deposit |
| `lp_list` | DynArray[Address] | All LPs |

### LoanRecord fields
| Field | Type |
|---|---|
| `loan_id` | u256 |
| `borrower` | Address |
| `profile_id` | u256 |
| `credit_band_snapshot` | str |
| `collateral` | u256 (wei) |
| `principal` | u256 (wei) |
| `issued_at` | u256 (timestamp) |
| `due_at` | u256 (timestamp, issued + 7 days) |
| `repaid_amount` | u256 |
| `status` | str (ACTIVE/REPAID/DEFAULTED/CLOSED) |

### Public methods

| Method | Mutating | Description |
|---|---|---|
| `get_loan(loan_id)` | view | Read loan record |
| `get_active_loan_id(profile_id)` | view | Current active loan |
| `get_vault_stats()` | view | Accounting summary |
| `compute_max_loan(profile_id, collateral)` | view | Max borrowable given collateral |
| `get_lp_balance(provider)` | view | LP deposit balance |
| `deposit_liquidity()` | write, payable | Add LP liquidity |
| `borrow(profile_id, principal)` | write, payable (collateral) | Take loan |
| `repay(loan_id)` | write, payable (principal) | Repay exact principal |
| `mark_default(loan_id)` | write | Permissionless default after due_at |

### Credit band multipliers (integer math)
| Band | Multiplier × 100 | Effective |
|---|---|---|
| NONE | 0 | No borrowing |
| STARTER | 125 | 1.25× collateral |
| ESTABLISHED | 175 | 1.75× collateral |
| TRUSTED | 250 | 2.50× collateral |

### Caps
- Per-borrower hard max: 10 GEN (10¹⁹ wei)
- Concentration cap: 30% of (total_liquidity + total_collateral)
- Loan duration: 7 days
- Review freshness: 30 days (checked at borrow time)
