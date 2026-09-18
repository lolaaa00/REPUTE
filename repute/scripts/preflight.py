#!/usr/bin/env python3
"""
Static preflight checks for Repute contracts.
Runs in CI without a funded signer.
"""

import sys
import ast
import re
from pathlib import Path

ROOT = Path(__file__).parent.parent
PROFILE = ROOT / "contracts" / "repute_profile.py"
VAULT = ROOT / "contracts" / "repute_vault.py"

ERRORS = []

def fail(msg: str):
    ERRORS.append(msg)
    print(f"FAIL: {msg}")

def ok(msg: str):
    print(f"  OK: {msg}")

def check_file(path: Path):
    if not path.exists():
        fail(f"Contract not found: {path}")
        return
    ok(f"Contract exists: {path.name}")

def check_header(path: Path, expected_version="v0.2.18"):
    text = path.read_text()
    if f"# {expected_version}" not in text:
        fail(f"{path.name}: missing version comment {expected_version}")
    else:
        ok(f"{path.name}: version comment present")
    if "from genlayer import *" not in text:
        fail(f"{path.name}: missing 'from genlayer import *'")
    else:
        ok(f"{path.name}: genlayer import present")

def check_no_private_key(path: Path):
    text = path.read_text().lower()
    bad = ["private_key", "mnemonic", "seed_phrase", "0x" + "0"*62]
    for b in bad:
        if b in text:
            fail(f"{path.name}: potential secret found: {b}")
            return
    ok(f"{path.name}: no secret patterns found")

def check_network_module():
    net = ROOT / "lib" / "genlayer" / "network.ts"
    if not net.exists():
        fail("lib/genlayer/network.ts not found")
        return
    text = net.read_text()
    if "61999" not in text:
        fail("network.ts: chain 61999 not found")
    else:
        ok("network.ts: chain 61999 present")
    if "studio.genlayer.com/api" not in text:
        fail("network.ts: RPC URL not found")
    else:
        ok("network.ts: RPC URL present")

def check_no_v03_syntax(path: Path):
    text = path.read_text()
    forbidden = ["gl.contract.Contract", "@gl.contract.interface", "run_nondet_default"]
    for f in forbidden:
        if f in text:
            fail(f"{path.name}: v0.3 syntax found: {f}")
            return
    ok(f"{path.name}: no v0.3 syntax")

def check_consensus_pattern(path: Path):
    text = path.read_text()
    if "run_nondet_unsafe" in text:
        ok(f"{path.name}: uses run_nondet_unsafe consensus")
    else:
        if path.name == "repute_profile.py":
            fail(f"{path.name}: missing run_nondet_unsafe for consensus")

def check_no_backend_signer(path: Path):
    text = path.read_text()
    if "PRIVATE_KEY" in text or "private_key" in text:
        fail(f"{path.name}: private key reference found")
    else:
        ok(f"{path.name}: no backend signer")

def check_value_safety(path: Path):
    text = path.read_text()
    if "transfer" in text:
        # Verify update-before-transfer pattern
        lines = text.splitlines()
        for i, line in enumerate(lines):
            if ".transfer(" in line:
                # Check if there's a storage update before this transfer
                context = "\n".join(lines[max(0,i-10):i])
                if "self." in context:
                    ok(f"{path.name}: transfer at line {i+1} appears to have prior state update")
                else:
                    print(f"  WARN: {path.name}: transfer at line {i+1} — verify update-before-transfer manually")

def check_env_example():
    env_ex = ROOT / ".env.example"
    if not env_ex.exists():
        fail(".env.example not found")
    else:
        ok(".env.example present")

def main():
    print("=== Repute Contract Preflight ===\n")

    check_file(PROFILE)
    check_file(VAULT)
    check_header(PROFILE)
    check_header(VAULT)
    check_no_private_key(PROFILE)
    check_no_private_key(VAULT)
    check_no_v03_syntax(PROFILE)
    check_no_v03_syntax(VAULT)
    check_consensus_pattern(PROFILE)
    check_consensus_pattern(VAULT)
    check_no_backend_signer(PROFILE)
    check_no_backend_signer(VAULT)
    check_value_safety(VAULT)
    check_network_module()
    check_env_example()

    print(f"\n{'='*40}")
    if ERRORS:
        print(f"FAILED: {len(ERRORS)} error(s)")
        for e in ERRORS:
            print(f"  - {e}")
        sys.exit(1)
    else:
        print("All preflight checks passed ✓")

if __name__ == "__main__":
    main()
