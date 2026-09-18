# Deployment

## Target Network

| Parameter | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | 61999 |
| RPC | https://studio.genlayer.com/api |
| Explorer | https://explorer-studio.genlayer.com |
| Currency | GEN |

## Deployment Steps

1. Set deployer key (never commit):
   ```bash
   export REPUTE_DEPLOYER_PRIVATE_KEY=0x...
   ```

2. Verify network config before deployment:
   ```bash
   python scripts/preflight.py
   ```

3. Deploy Profile contract first, record address.

4. Deploy Vault contract with Profile address as constructor argument.

5. Set addresses in `.env.local`:
   ```
   NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS=0x...
   NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS=0x...
   ```

6. Build and deploy frontend:
   ```bash
   npm run build
   ```

## Deployment Evidence Record

To be filled after funded deployment to chain 61999:

| Field | Value |
|---|---|
| Git SHA | (record after deployment) |
| Profile contract SHA-256 | (run: sha256sum contracts/repute_profile.py) |
| Vault contract SHA-256 | (run: sha256sum contracts/repute_vault.py) |
| Network | GenLayer Studionet (chain 61999) |
| Deployer address (public) | (record — no private key) |
| Profile deployment tx | (explorer link) |
| Profile address | (record) |
| Vault deployment tx | (explorer link) |
| Vault address | (record) |
| Final consensus status | (ACCEPTED/FINALIZED) |
| Actual execution result | (record return value) |
| Final state readbacks | (record get_vault_stats, profile #1) |

## Verification

After deployment, verify on explorer:
- Profile contract: `https://explorer-studio.genlayer.com/address/<profile_address>`
- Vault contract: `https://explorer-studio.genlayer.com/address/<vault_address>`

Read initial state:
```
get_vault_stats() → {total_liquidity: 0, ...}
get_next_profile_id() → 1
```

No fabricated evidence. All fields above are to be filled with actual on-chain data.
