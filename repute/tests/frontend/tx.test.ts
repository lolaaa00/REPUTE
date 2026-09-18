import { describe, it, expect } from "vitest";
import { statusLabel, isErrorStatus, isTerminalStatus, INITIAL_TX_STATE } from "@/lib/wallet/tx";

describe("tx lifecycle", () => {
  it("initial state is IDLE", () => {
    expect(INITIAL_TX_STATE.status).toBe("IDLE");
    expect(INITIAL_TX_STATE.hash).toBeNull();
    expect(INITIAL_TX_STATE.error).toBeNull();
  });

  it("USER_REJECTED is error status", () => {
    expect(isErrorStatus("USER_REJECTED")).toBe(true);
  });

  it("WRONG_NETWORK is error status", () => {
    expect(isErrorStatus("WRONG_NETWORK")).toBe(true);
  });

  it("CONSENSUS_RUNNING is not error", () => {
    expect(isErrorStatus("CONSENSUS_RUNNING")).toBe(false);
  });

  it("STATE_REREAD is terminal", () => {
    expect(isTerminalStatus("STATE_REREAD")).toBe(true);
  });

  it("SUBMITTED is not terminal", () => {
    expect(isTerminalStatus("SUBMITTED")).toBe(false);
  });

  it("all error statuses are terminal", () => {
    const errorStatuses = ["USER_REJECTED", "WRONG_NETWORK", "RPC_ERROR", "CONSENSUS_FAILURE", "EXECUTION_ERROR", "STATE_MISMATCH"] as const;
    for (const s of errorStatuses) {
      expect(isTerminalStatus(s)).toBe(true);
    }
  });

  it("statusLabel returns human label", () => {
    expect(statusLabel("CONSENSUS_RUNNING")).toBe("Consensus running…");
    expect(statusLabel("USER_REJECTED")).toBe("Rejected by user");
  });
});
