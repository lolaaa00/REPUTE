/**
 * Canonical network module — single source of truth for Studionet config.
 * All chain IDs, RPC URLs, and explorer links must come from here.
 */

export const STUDIONET_CHAIN_ID = 61999;
export const STUDIONET_RPC = "https://studio.genlayer.com/api";
export const STUDIONET_EXPLORER = "https://explorer-studio.genlayer.com";
export const STUDIONET_CURRENCY = "GEN";
export const STUDIONET_NAME = "GenLayer Studionet";

/** Verify production config at startup */
export function assertProductionNetwork() {
  if (STUDIONET_CHAIN_ID !== 61999) {
    throw new Error(`[Repute] Wrong chain ID: expected 61999, got ${STUDIONET_CHAIN_ID}`);
  }
  if (STUDIONET_RPC !== "https://studio.genlayer.com/api") {
    throw new Error(`[Repute] Wrong RPC: expected https://studio.genlayer.com/api, got ${STUDIONET_RPC}`);
  }
}

export function explorerTx(hash: string) {
  return `${STUDIONET_EXPLORER}/tx/${hash}`;
}

export function explorerAddress(address: string) {
  return `${STUDIONET_EXPLORER}/address/${address}`;
}
