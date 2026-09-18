# Repute

**Under-Collateralized Credit on GenLayer Studionet**

Repute gives public software operators access to GEN credit above their collateral — only after GenLayer validators independently verify their operational track record. No underwriter. No favoritism.

## Network

- **Chain:** GenLayer Studionet
- **Chain ID:** 61999
- **RPC:** `https://studio.genlayer.com/api`
- **Explorer:** `https://explorer-studio.genlayer.com`
- **Currency:** GEN
- **`genlayer-js`:** exactly `1.1.8`

## Quick start

```bash
cd repute
npm install
cp .env.example .env.local
# Set NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS and NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS
npm run dev
```

## Contracts

| Contract | Purpose |
|---|---|
| `contracts/repute_profile.py` | Borrower dossier + consensus operational review |
| `contracts/repute_vault.py` | GEN liquidity pool + loan lifecycle |

## Frontend routes

| Route | Purpose |
|---|---|
| `/` | Landing |
| `/projects` | All project dossiers |
| `/profile/[id]` | Project dossier + review |
| `/profile/[id]/review` | Request consensus review |
| `/borrow` | Create dossier → borrow flow |
| `/loan/[id]` | Loan ledger + repay |
| `/vault` | Liquidity pool + deposit |
| `/me` | Wallet dashboard |

## Credit bands

| Band | Multiplier | Requirements |
|---|---|---|
| NONE | 0× | Any attribution UNRESOLVED/WEAK or stale review |
| STARTER | 1.25× | Moderate evidence, no history required |
| ESTABLISHED | 1.75× | Moderate evidence + 2+ repaid loans + no defaults |
| TRUSTED | 2.50× | All dimensions STRONG/MODERATE + 5+ loans + no defaults + fresh review |

## Tests

```bash
# Python contract tests
pip install pytest
python -m pytest tests/contract/ -v

# Frontend tests
npm test

# Preflight checks
python scripts/preflight.py
```

## CI

GitHub Actions runs on every push:
- Python contract syntax + preflight
- Contract unit tests
- TypeScript typecheck + lint
- Frontend tests
- Production build
- Network config assertions (chain 61999, correct RPC)
- Secret leak check

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- [`docs/CONSENSUS.md`](docs/CONSENSUS.md)
- [`docs/SECURITY.md`](docs/SECURITY.md)
- [`docs/CONTRACT_SURFACE.md`](docs/CONTRACT_SURFACE.md)
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md)
- [`docs/REVIEWER_DEMO.md`](docs/REVIEWER_DEMO.md)
