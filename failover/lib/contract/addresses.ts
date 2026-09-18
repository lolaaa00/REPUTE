/**
 * Deployed contract addresses on GenLayer Studionet (chain 61999).
 *
 * These are the live deployment recorded in docs/DEPLOYMENT.md ("Live
 * deployment record") — both transactions reached FINALIZED consensus with a
 * SUCCESS execution result. They are compiled in as defaults so the app runs
 * in live mode out of the box; `NEXT_PUBLIC_FAILOVER_*_ADDRESS` still
 * overrides them for a reviewer pointing at their own deployment.
 *
 * Production routes read these addresses through the adapters in
 * `registryAdapter.ts` / `gateAdapter.ts`. They never fall back to
 * `lib/fixtures/*` on a read failure — fixtures are confined to `/demo`.
 */

/** FailoverRegistry on Studionet (see docs/DEPLOYMENT.md). */
export const DEPLOYED_FAILOVER_REGISTRY_ADDRESS =
  "0x2A858500C75fC3880BB87CCd2C30Fd4c1AdE0A1a" as const;

/** FailoverGate on Studionet, bound to registry + project `failover-demo`. */
export const DEPLOYED_FAILOVER_GATE_ADDRESS =
  "0xD6fAA5b4EfA47393F92eA71787528C86F4bb736f" as const;

/** The project_id the deployed FailoverGate is immutably bound to. */
export const GATE_BOUND_PROJECT_ID = "failover-demo" as const;

function resolve(override: string | undefined, fallback: string): `0x${string}` | "" {
  const value = (override ?? "").trim() || fallback;
  return value as `0x${string}` | "";
}

export const FAILOVER_REGISTRY_ADDRESS = resolve(
  process.env.NEXT_PUBLIC_FAILOVER_REGISTRY_ADDRESS,
  DEPLOYED_FAILOVER_REGISTRY_ADDRESS,
);

export const FAILOVER_GATE_ADDRESS = resolve(
  process.env.NEXT_PUBLIC_FAILOVER_GATE_ADDRESS,
  DEPLOYED_FAILOVER_GATE_ADDRESS,
);

export function isDeployed(address: string): address is `0x${string}` {
  return /^0x[0-9a-fA-F]{40}$/.test(address);
}
