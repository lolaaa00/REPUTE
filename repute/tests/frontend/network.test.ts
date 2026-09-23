import { describe, it, expect, vi, afterEach } from "vitest";
import {
  STUDIONET_CHAIN_ID,
  STUDIONET_RPC,
  assertProductionNetwork,
  explorerTx,
  explorerAddress,
} from "@/lib/genlayer/network";
import {
  DEFAULT_PROFILE_ADDRESS,
  DEFAULT_VAULT_ADDRESS,
  getProfileAddress,
  getVaultAddress,
} from "@/lib/contract/addresses";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("network constants", () => {
  it("chain ID is 61999", () => {
    expect(STUDIONET_CHAIN_ID).toBe(61999);
  });

  it("RPC is studio.genlayer.com", () => {
    expect(STUDIONET_RPC).toBe("https://studio.genlayer.com/api");
  });

  it("assertProductionNetwork does not throw", () => {
    expect(() => assertProductionNetwork()).not.toThrow();
  });

  it("explorerTx returns correct URL", () => {
    const url = explorerTx("0xabc");
    expect(url).toContain("explorer-studio.genlayer.com");
    expect(url).toContain("0xabc");
  });

  it("explorerAddress returns correct URL", () => {
    const url = explorerAddress("0x1234");
    expect(url).toContain("explorer-studio.genlayer.com");
    expect(url).toContain("0x1234");
  });

  it("never resolves an unset or zero address", () => {
    vi.stubEnv("NEXT_PUBLIC_PROFILE_CONTRACT_ADDRESS", "0x0000000000000000000000000000000000000000");
    vi.stubEnv("NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS", "");
    expect(getProfileAddress()).toBe(DEFAULT_PROFILE_ADDRESS);
    expect(getVaultAddress()).toBe(DEFAULT_VAULT_ADDRESS);
  });
});
