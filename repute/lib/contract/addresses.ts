/**
 * Repute's deployed contracts on GenLayer Studionet (chain 61999).
 *
 * Contract addresses are public, so the recorded deployment is used as the
 * production default. Vercel may override these with environment variables,
 * but an unset or zero address must never reach genlayer-js.
 */
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

// Recorded in docs/DEPLOYMENT.md and verified on Studionet.
export const DEFAULT_PROFILE_ADDRESS =
  "0x2BA9Bc34A17E00f4d5DDD8212e1a7A6A73aBd1E5" as const;
export const DEFAULT_VAULT_ADDRESS =
  "0xcB9f8D4936443A77C0cf3287A64E3087BdDe6407" as const;

function resolveAddress(
  raw: string | undefined,
  fallback: `0x${string}`,
  label: string,
): `0x${string}` {
  const candidate = (raw?.trim() || fallback) as string;
  if (!/^0x[0-9a-fA-F]{40}$/.test(candidate) || candidate.toLowerCase() === ZERO_ADDRESS) {
    throw new Error(
      `${label} is not configured with a valid Studionet contract address. ` +
        `Set NEXT_PUBLIC_${label === "Profile" ? "PROFILE" : "VAULT"}_CONTRACT_ADDRESS.`,
    );
  }
  return candidate as `0x${string}`;
}

export function getProfileAddress(): `0x${string}` {
  return resolveAddress(
    process.env.NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS,
    DEFAULT_PROFILE_ADDRESS,
    "Profile",
  );
}

export function getVaultAddress(): `0x${string}` {
  return resolveAddress(
    process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS,
    DEFAULT_VAULT_ADDRESS,
    "Vault",
  );
}

export function contractsDeployed(): boolean {
  try {
    getProfileAddress();
    getVaultAddress();
    return true;
  } catch {
    return false;
  }
}
