/**
 * Deployed contract addresses on Studionet (chain 61999).
 * Set via environment variables after deployment.
 */

export function getProfileAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS;
  if (!addr) {
    return "0x0000000000000000000000000000000000000000";
  }
  return addr as `0x${string}`;
}

export function getVaultAddress(): `0x${string}` {
  const addr = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
  if (!addr) {
    return "0x0000000000000000000000000000000000000000";
  }
  return addr as `0x${string}`;
}

export function contractsDeployed(): boolean {
  const p = process.env.NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS;
  const v = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS;
  return !!(
    p && p !== "0x0000000000000000000000000000000000000000" &&
    v && v !== "0x0000000000000000000000000000000000000000"
  );
}
