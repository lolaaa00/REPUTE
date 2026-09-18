# Reviewer Demo

This walkthrough demonstrates the complete Repute lifecycle using the live app on Studionet.

## Prerequisites

- MetaMask (or compatible EIP-1193 wallet) with Studionet added (chain 61999)
- A small GEN balance for gas + collateral (testnet GEN)
- Deployed contracts (addresses in `.env.local`)

## Demo project

For an honest demo, use a real public project with verifiable sources:

**Example: OpenTelemetry**
- Site: `https://opentelemetry.io`
- GitHub: `https://github.com/open-telemetry/opentelemetry-specification`
- Changelog: `https://github.com/open-telemetry/opentelemetry-specification/blob/main/CHANGELOG.md`
- Status page: `https://status.opentelemetry.io`

This project has genuine recent maintenance, clear attribution, public continuity, and transparent history.

---

## Step-by-step walkthrough

### 1. Connect wallet

1. Open the app at `/`
2. Click **Connect Wallet**
3. Approve in MetaMask
4. Confirm network shows "Studionet" (green dot)

If wrong network: click **Switch to Studionet** — app adds chain 61999 automatically.

---

### 2. Create project dossier (`/borrow`)

1. Navigate to `/borrow`
2. The flow detects no existing profile → shows Step 1
3. Fill in:
   - Project name: `OpenTelemetry`
   - Description: "Open-source observability framework for cloud-native software"
   - Source 1: `https://opentelemetry.io` / `Official Site`
   - Source 2: `https://github.com/open-telemetry/opentelemetry-specification` / `Specification Repo`
   - Source 3: `https://github.com/open-telemetry/opentelemetry-specification/blob/main/CHANGELOG.md` / `Changelog`
4. Click **Create Dossier**
5. Approve in MetaMask
6. Watch lifecycle: AWAITING_SIGNATURE → SUBMITTED → CONSENSUS_RUNNING → FINALIZED → STATE_REREAD
7. Note: dossier is now sealed with a SHA-256 hash of sources

---

### 3. Request operational review (`/profile/[id]/review`)

1. Navigate to `/profile/[id]/review` (id from creation)
2. Read what validators will verify
3. Click **Request Operational Review**
4. Approve in MetaMask
5. Watch consensus run (may take 30–120 seconds on Studionet)
6. After STATE_REREAD: redirected to profile page

---

### 4. View dimension bands (`/profile/[id]`)

On the profile page you should see:
- `MAINTENANCE_ACTIVITY`: STRONG (recent commits, releases)
- `OWNERSHIP_ATTRIBUTION`: STRONG (clear org/maintainers)
- `PUBLIC_CONTINUITY`: STRONG (site live, repo active)
- `TRANSPARENCY`: STRONG (public issues, changelog)
- **Credit band: TRUSTED** (if 5+ repayments) or **STARTER** (first time)
- Evidence excerpts with verbatim quotes from fetched sources

---

### 5. Deposit test GEN to vault (`/vault`)

1. Navigate to `/vault`
2. Enter an amount (e.g. `5.0 GEN`)
3. Click **Deposit Liquidity**
4. Approve in MetaMask
5. See vault stats update: total_liquidity increases, available_liquidity increases

---

### 6. Borrow above collateral (`/borrow`)

1. Navigate back to `/borrow`
2. Profile detected → shows Step 3 (Ready to Borrow)
3. Collateral: `2.0 GEN` → Max loan shows `2.5 GEN` (STARTER band = 1.25×)
4. Principal: `2.4 GEN` (above collateral, within limit)
5. Click **Post Collateral & Borrow**
6. Approve two-step in MetaMask (collateral sent as msg.value)
7. After STATE_REREAD: loan created, GEN transferred to wallet
8. Navigate to `/me` to see active loan

**This proves under-collateralization**: you posted 2.0 GEN and received 2.4 GEN.

---

### 7. View loan ledger (`/loan/[id]`)

1. Navigate to `/loan/[id]`
2. See stamped ledger entry:
   - Principal, Collateral, Credit band at issue, Due date
   - Status: **ACTIVE**
3. Notice: repay button visible for the borrower
4. Note: due date is 7 days from issuance

---

### 8. Repay loan

1. On `/loan/[id]`, click **Repay 2.4 GEN**
2. This sends exact principal as msg.value
3. After STATE_REREAD:
   - Loan status → **REPAID**
   - Collateral returned to wallet
   - Profile repayment counter increments

---

### 9. View updated repayment history (`/me`)

1. Navigate to `/me`
2. See: Repayments: 1
3. Profile band remains STARTER until 2 repayments

---

### 10. Prove stale review prevents new loan

1. To simulate staleness, wait 30+ days OR ask a reviewer to manually advance time
2. After review expires: `review_is_fresh()` returns false
3. Navigate to `/borrow`
4. Flow detects stale review → shows Step 2 (Review Needed)
5. New loan is blocked until a fresh review is requested

---

## Default path test

In direct contract tests:
1. Create profile, get review
2. Borrow loan with short due date (test environment)
3. Advance time past due_at
4. Call `mark_default(loan_id)` — any caller, no reward
5. Verify: loan → DEFAULTED, collateral seized into vault, profile default counter = 1
6. Verify: profile now derives NONE band, cannot borrow again

See `tests/contract/test_vault.py::TestDefaultTiming` for timing assertions.
