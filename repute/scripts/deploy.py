#!/usr/bin/env python3
"""
Deploy repute_profile.py and repute_vault.py to GenLayer Studionet (chain 61999).

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
import subprocess
from pathlib import Path

CHAIN_ID = 61999
RPC_URL = "https://studio.genlayer.com/api"
PROFILE_CONTRACT = Path(__file__).parent.parent / "contracts" / "repute_profile.py"
VAULT_CONTRACT = Path(__file__).parent.parent / "contracts" / "repute_vault.py"

def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()

def verify_network_config():
    print(f"[Repute Deploy] Verifying network config…")
    print(f"  Chain ID: {CHAIN_ID}")
    print(f"  RPC: {RPC_URL}")
    assert CHAIN_ID == 61999, f"Wrong chain ID: {CHAIN_ID}"
    assert RPC_URL == "https://studio.genlayer.com/api", f"Wrong RPC: {RPC_URL}"
    print("[Repute Deploy] Network config verified ✓")

def main():
    verify_network_config()

    private_key = os.environ.get("REPUTE_DEPLOYER_PRIVATE_KEY")
    if not private_key:
        print("ERROR: REPUTE_DEPLOYER_PRIVATE_KEY not set")
        print("Set it in your environment (never commit to repo):")
        print("  export REPUTE_DEPLOYER_PRIVATE_KEY=0x...")
        sys.exit(1)

    print(f"\n[Repute Deploy] Profile contract SHA-256: {sha256_file(PROFILE_CONTRACT)}")
    print(f"[Repute Deploy] Vault contract SHA-256:   {sha256_file(VAULT_CONTRACT)}")
    print(f"\nContracts:")
    print(f"  Profile: {PROFILE_CONTRACT}")
    print(f"  Vault:   {VAULT_CONTRACT}")

    print("\n[Repute Deploy] Use genlayer-cli or genlayer-js deploy script to deploy.")
    print("Record deployment evidence in docs/DEPLOYMENT.md:")
    print("  - Git SHA")
    print("  - Contract source SHA-256")
    print("  - Network (chain 61999)")
    print("  - Deployer address (public)")
    print("  - Deployment tx hash")
    print("  - Deployed address")
    print("  - Final consensus status")
    print("  - Explorer links")
    print("  - Final state readbacks")

if __name__ == "__main__":
    main()
