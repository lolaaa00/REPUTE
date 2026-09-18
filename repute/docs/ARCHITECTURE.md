# Architecture

## System diagram

```
Browser (Next.js 15)
│
├── WalletContext (EIP-1193, MetaMask)
│   └── Validates chain ID == 61999 before every write
│
├── lib/genlayer/
│   ├── network.ts  ← Single source of truth for chain/RPC
│   ├── client.ts   ← Read (unsigned) + Write (EIP-1193) clients
│   └── gen.ts      ← BigInt-safe GEN parser/formatter
│
├── lib/contract/
│   ├── profile.ts  ← View wrappers for ReputeProfile
│   └── vault.ts    ← View wrappers for ReputeVault
│
└── lib/wallet/
    ├── context.tsx ← Wallet state + event listeners
    ├── tx.ts       ← Lifecycle types
    └── useTx.ts    ← Submit → Consensus → Finalized → Reread

GenLayer Studionet (chain 61999)
│
├── ReputeProfile
│   ├── create_profile(name, desc, source_urls[], labels[])
│   ├── request_operational_review(profile_id)  ← CONSENSUS
│   ├── record_repayment(profile_id)  ← Vault only
│   ├── record_default(profile_id)    ← Vault only
│   └── profile_credit_band(profile_id) → NONE|STARTER|ESTABLISHED|TRUSTED
│
└── ReputeVault
    ├── deposit_liquidity()  ← payable
    ├── borrow(profile_id, principal)  ← payable (collateral)
    ├── repay(loan_id)  ← payable (principal)
    └── mark_default(loan_id)  ← permissionless
```

## Key design decisions

### No centralized backend
All state lives in the two Intelligent Contracts on chain 61999.
Next.js is used only for static delivery.

### Consensus controls credit eligibility
The `request_operational_review` function uses `gl.vm.run_nondet_unsafe` with
a leader/validator structure. Both leader and validator independently fetch
all declared sources and evaluate four operational dimensions.
The resulting credit band is then used by the Vault to gate loan amounts.
A centralized operator cannot fake this — validators check independently.

### Vault reads Profile
`ReputeVault` uses `@gl.contract_interface` to call `ReputeProfile` at borrow time:
- Is the review fresh?
- What is the credit band?
- What is the operator's profile ID?

This creates a real composability boundary: the vault has no LLM logic,
and the profile has no value logic.

### Deterministic credit, not LLM-chosen
The credit band multiplier is computed entirely in Python with integer math.
The LLM produces STRONG/MODERATE/WEAK/UNRESOLVED per dimension.
The band formula combines dimensions + repayment history deterministically.
The LLM never outputs a GEN amount.

### Update-before-transfer
In `borrow()` and `repay()`, all state is updated before any `.transfer()`.
This prevents reentrancy attacks.
