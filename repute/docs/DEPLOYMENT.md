# Deployment

## Target Network

| Parameter | Value |
|---|---|
| Network | GenLayer Studionet |
| Chain ID | 61999 |
| RPC | https://studio.genlayer.com/api |
| Explorer | https://explorer-studio.genlayer.com |
| Currency | GEN |

## Deployment Evidence

| Field | Value |
|---|---|
| Deployed at | 2026-09-20T22:48:04Z |
| Git SHA | `7edf485` |
| Profile contract SHA-256 | `aaabc29b3860fc6c6b7a287e5b2029f4d338632f3b52cf455c3073265c8f758b` |
| Vault contract SHA-256 | `ade85ba60cb972b5664d0542200cfca58da210fd1b5a41910f37b7ea727f3ad5` |
| Deployer address | `0x778D1663f9D5b338aBaD5C62899830AD3520a32F` |
| Profile deployment tx | [0x18485f4a9b3f0f7be10f482d7887d6705274f56f8d78170802bee3245cd5bc7a](https://explorer-studio.genlayer.com/tx/0x18485f4a9b3f0f7be10f482d7887d6705274f56f8d78170802bee3245cd5bc7a) |
| Profile address | `0x2BA9Bc34A17E00f4d5DDD8212e1a7A6A73aBd1E5` |
| Vault deployment tx | [0x4fae2c113bd5173ce5f1e40dae099dadb26eeeb7798c4144d0b6cca817318069](https://explorer-studio.genlayer.com/tx/0x4fae2c113bd5173ce5f1e40dae099dadb26eeeb7798c4144d0b6cca817318069) |
| Vault address | `0xcB9f8D4936443A77C0cf3287A64E3087BdDe6407` |
| set_vault tx | [0xe613bbd69a45ba8eedc6bcf6aeb28f44eeb8d3b6ffcf8858e28ad0cd89a0792d](https://explorer-studio.genlayer.com/tx/0xe613bbd69a45ba8eedc6bcf6aeb28f44eeb8d3b6ffcf8858e28ad0cd89a0792d) |
| Profile consensus | MAJORITY_AGREE |
| Vault consensus | MAJORITY_AGREE |
| set_vault consensus | MAJORITY_AGREE |

## Post-Deployment Readbacks

```json
{
  "vault_stats": {
    "available_liquidity": 0,
    "repaid_principal": 0,
    "reserved_liquidity": 0,
    "total_collateral": 0,
    "total_liquidity": 0
  },
  "next_profile_id": "1",
  "profile.vault_address": "addr#cb9f8d4936443a77c0cf3287a64e3087bdde6407",
  "vault_address_matches": true
}
```

## Verification

- Profile: https://explorer-studio.genlayer.com/address/0x2BA9Bc34A17E00f4d5DDD8212e1a7A6A73aBd1E5
- Vault: https://explorer-studio.genlayer.com/address/0xcB9f8D4936443A77C0cf3287A64E3087BdDe6407
