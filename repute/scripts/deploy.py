#!/usr/bin/env python3
"""
Deploy repute_profile.py and repute_vault.py to GenLayer Studionet (chain 61999).
Then calls set_vault on Profile so the Vault is the sole authorized caller.

Usage:
    python scripts/deploy.py

Requires environment variable:
    REPUTE_DEPLOYER_PRIVATE_KEY=0x...

NEVER commit your private key. Use environment variables or a secrets manager.
"""

import os
import sys
import hashlib
import json
import datetime
from pathlib import Path

CHAIN_ID = 61999
RPC_URL = "https://studio.genlayer.com/api"
PROFILE_CONTRACT = Path(__file__).parent.parent / "contracts" / "repute_profile.py"
VAULT_CONTRACT = Path(__file__).parent.parent / "contracts" / "repute_vault.py"
DEPLOYMENT_MD = Path(__file__).parent.parent / "docs" / "DEPLOYMENT.md"
GIT_SHA_CMD = "git rev-parse HEAD"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def git_sha() -> str:
    import subprocess
    try:
        return subprocess.check_output(GIT_SHA_CMD.split(), text=True).strip()
    except Exception:
        return "unknown"


def verify_network_config():
    assert CHAIN_ID == 61999, f"Wrong chain ID: {CHAIN_ID}"
    assert RPC_URL == "https://studio.genlayer.com/api", f"Wrong RPC: {RPC_URL}"
    print(f"  Chain ID : {CHAIN_ID} ✓")
    print(f"  RPC      : {RPC_URL} ✓")


def write_deployment_md(evidence: dict):
    content = f"""# Deployment

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
| Deployed at | {evidence['deployed_at']} |
| Git SHA | `{evidence['git_sha']}` |
| Profile contract SHA-256 | `{evidence['profile_sha256']}` |
| Vault contract SHA-256 | `{evidence['vault_sha256']}` |
| Deployer address | `{evidence['deployer_address']}` |
| Profile deployment tx | [{evidence['profile_tx']}](https://explorer-studio.genlayer.com/tx/{evidence['profile_tx']}) |
| Profile address | `{evidence['profile_address']}` |
| Vault deployment tx | [{evidence['vault_tx']}](https://explorer-studio.genlayer.com/tx/{evidence['vault_tx']}) |
| Vault address | `{evidence['vault_address']}` |
| set_vault tx | [{evidence['set_vault_tx']}](https://explorer-studio.genlayer.com/tx/{evidence['set_vault_tx']}) |
| Profile consensus | {evidence['profile_result']} |
| Vault consensus | {evidence['vault_result']} |
| set_vault consensus | {evidence['set_vault_result']} |

## Post-Deployment Readbacks

```json
{json.dumps(evidence['readbacks'], indent=2)}
```

## Verification

- Profile: https://explorer-studio.genlayer.com/address/{evidence['profile_address']}
- Vault: https://explorer-studio.genlayer.com/address/{evidence['vault_address']}
"""
    DEPLOYMENT_MD.write_text(content)
    print(f"\n[Deploy] DEPLOYMENT.md written ✓")


def main():
    print("[Repute Deploy] Verifying network config…")
    verify_network_config()

    private_key = os.environ.get("REPUTE_DEPLOYER_PRIVATE_KEY")
    if not private_key:
        print("\nERROR: REPUTE_DEPLOYER_PRIVATE_KEY not set")
        print("  export REPUTE_DEPLOYER_PRIVATE_KEY=0x...")
        sys.exit(1)

    try:
        from genlayer_py.client import GenLayerClient
        from eth_account import Account
    except ImportError:
        print("\nERROR: genlayer-py not installed. Run: pip install genlayer-py")
        sys.exit(1)

    account = Account.from_key(private_key)
    deployer_address = account.address
    print(f"\n[Deploy] Deployer: {deployer_address}")

    profile_sha = sha256_file(PROFILE_CONTRACT)
    vault_sha = sha256_file(VAULT_CONTRACT)
    print(f"[Deploy] Profile SHA-256 : {profile_sha}")
    print(f"[Deploy] Vault SHA-256   : {vault_sha}")

    client = GenLayerClient(endpoint=RPC_URL)

    # ── 1. Deploy Profile ────────────────────────────────────────────────────
    print("\n[Deploy] Deploying ReputeProfile…")
    profile_code = PROFILE_CONTRACT.read_bytes()
    profile_tx_hash = client.deploy_contract(
        code=profile_code,
        account=account,
        args=[],
    )
    print(f"  tx: {profile_tx_hash}")
    profile_receipt = client.wait_for_transaction_receipt(
        profile_tx_hash, retries=20, interval=5000
    )
    profile_address = profile_receipt.get("to_address") or profile_receipt.get("recipient")
    if not profile_address:
        # Some SDK versions return the address differently
        profile_address = client.get_transaction(profile_tx_hash).get("to_address")
    profile_result = profile_receipt.get("result_name", profile_receipt.get("status_name", "?"))
    print(f"  address : {profile_address}")
    print(f"  result  : {profile_result}")
    if str(profile_result) not in ("AGREE", "MAJORITY_AGREE", "ACCEPTED", "FINALIZED"):
        print(f"ERROR: Profile deployment did not reach consensus: {profile_result}")
        sys.exit(1)

    # ── 2. Deploy Vault ──────────────────────────────────────────────────────
    print("\n[Deploy] Deploying ReputeVault…")
    vault_code = VAULT_CONTRACT.read_bytes()
    vault_tx_hash = client.deploy_contract(
        code=vault_code,
        account=account,
        args=[profile_address],
    )
    print(f"  tx: {vault_tx_hash}")
    vault_receipt = client.wait_for_transaction_receipt(
        vault_tx_hash, retries=20, interval=5000
    )
    vault_address = vault_receipt.get("to_address") or vault_receipt.get("recipient")
    if not vault_address:
        vault_address = client.get_transaction(vault_tx_hash).get("to_address")
    vault_result = vault_receipt.get("result_name", vault_receipt.get("status_name", "?"))
    print(f"  address : {vault_address}")
    print(f"  result  : {vault_result}")
    if str(vault_result) not in ("AGREE", "MAJORITY_AGREE", "ACCEPTED", "FINALIZED"):
        print(f"ERROR: Vault deployment did not reach consensus: {vault_result}")
        sys.exit(1)

    # ── 3. Bind vault in Profile (set_vault) ─────────────────────────────────
    print(f"\n[Deploy] Calling set_vault({vault_address}) on Profile…")
    set_vault_tx = client.write_contract(
        address=profile_address,
        function_name="set_vault",
        account=account,
        args=[vault_address],
    )
    print(f"  tx: {set_vault_tx}")
    set_vault_receipt = client.wait_for_transaction_receipt(
        set_vault_tx, retries=20, interval=5000
    )
    set_vault_result = set_vault_receipt.get("result_name", set_vault_receipt.get("status_name", "?"))
    print(f"  result: {set_vault_result}")
    if str(set_vault_result) not in ("AGREE", "MAJORITY_AGREE", "ACCEPTED", "FINALIZED"):
        print(f"ERROR: set_vault did not reach consensus: {set_vault_result}")
        sys.exit(1)

    # ── 4. Readbacks ─────────────────────────────────────────────────────────
    print("\n[Deploy] Reading back initial state…")
    vault_stats = client.read_contract(
        address=vault_address,
        function_name="get_vault_stats",
        args=[],
    )
    next_profile_id = client.read_contract(
        address=profile_address,
        function_name="get_next_profile_id",
        args=[],
    )
    vault_addr_readback = client.read_contract(
        address=profile_address,
        function_name="get_vault_address",
        args=[],
    )
    readbacks = {
        "vault_stats": vault_stats,
        "next_profile_id": str(next_profile_id),
        "profile.vault_address": str(vault_addr_readback),
        "vault_address_matches": str(vault_addr_readback).lower() == str(vault_address).lower(),
    }
    print(json.dumps(readbacks, indent=2))

    if not readbacks["vault_address_matches"]:
        print("ERROR: vault_address readback does not match deployed vault!")
        sys.exit(1)

    # ── 5. Write env file hint ────────────────────────────────────────────────
    print(f"\n[Deploy] Add to .env.local:")
    print(f"  NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS={profile_address}")
    print(f"  NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS={vault_address}")

    # ── 6. Write DEPLOYMENT.md ────────────────────────────────────────────────
    evidence = {
        "deployed_at": datetime.datetime.utcnow().isoformat() + "Z",
        "git_sha": git_sha(),
        "profile_sha256": profile_sha,
        "vault_sha256": vault_sha,
        "deployer_address": deployer_address,
        "profile_tx": str(profile_tx_hash),
        "profile_address": str(profile_address),
        "vault_tx": str(vault_tx_hash),
        "vault_address": str(vault_address),
        "set_vault_tx": str(set_vault_tx),
        "profile_result": str(profile_result),
        "vault_result": str(vault_result),
        "set_vault_result": str(set_vault_result),
        "readbacks": readbacks,
    }
    write_deployment_md(evidence)

    print("\n[Deploy] Done ✓")
    print(f"  Profile : {profile_address}")
    print(f"  Vault   : {vault_address}")


if __name__ == "__main__":
    main()
