/**
 * Integration coverage for the LIVE execution gate route /gate/[id]:
 * allow (SAFE), refuse (RESTRICTED), and replay rejection — all driven
 * through the real page component and the real tx lifecycle state machine,
 * with only the contract adapters and the finality step faked.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const readIsGateOpen = vi.fn();
const readGateCounts = vi.fn();
const readGateReceipts = vi.fn();
const submitExecuteHighRisk = vi.fn();
const submitExecuteLowRisk = vi.fn();
const submitTryExecuteHighRiskOrRecordRefusal = vi.fn();
const assertExecutionSucceeded = vi.fn();

vi.mock("@/lib/contract/gateAdapter", () => ({
  readIsGateOpen: (...a: unknown[]) => readIsGateOpen(...a),
  readGateCounts: (...a: unknown[]) => readGateCounts(...a),
  readGateReceipts: (...a: unknown[]) => readGateReceipts(...a),
  submitExecuteHighRisk: (...a: unknown[]) => submitExecuteHighRisk(...a),
  submitExecuteLowRisk: (...a: unknown[]) => submitExecuteLowRisk(...a),
  submitTryExecuteHighRiskOrRecordRefusal: (...a: unknown[]) =>
    submitTryExecuteHighRiskOrRecordRefusal(...a),
}));

vi.mock("@/lib/contract/finality", () => ({
  createFinalityStep: () => ({
    waitForFinality: async () => ({ status: "FINALIZED" as const }),
    assertExecutionSucceeded: () => assertExecutionSucceeded(),
  }),
}));

vi.mock("@/lib/wallet/WalletProvider", () => ({
  useWallet: () => ({
    status: "CONNECTED",
    address: "0xcaller00000000000000000000000000000000ab",
    chainId: 61999,
    provider: {},
  }),
  isWriteReady: () => true,
}));

import { LiveGatePanel, findReceiptOutcome } from "@/app/gate/[id]/page";

const CALLER = "0xcaller00000000000000000000000000000000ab";

function renderGate(id = "failover-demo") {
  return render(<LiveGatePanel projectId={id} />);
}

/** Echoes back a durable receipt for whatever action_hash was submitted, the
 * way the deployed gate does, so rereadAndValidate sees a real postcondition. */
function receiptFor(outcome: "EXECUTED" | "REFUSED_NOT_SAFE", mock: ReturnType<typeof vi.fn>) {
  mock.mockImplementation(async (_addr: string, _p: unknown, actionHash: string) => {
    readGateReceipts.mockResolvedValue([JSON.stringify({ action_hash: actionHash, outcome })]);
    return "0xtxhash";
  });
}

beforeEach(() => {
  readIsGateOpen.mockReset().mockResolvedValue(true);
  readGateCounts.mockReset().mockResolvedValue({ high_risk_executed: 0, low_risk_executed: 0, refused: 0 });
  readGateReceipts.mockReset().mockResolvedValue([]);
  submitExecuteHighRisk.mockReset();
  submitExecuteLowRisk.mockReset();
  submitTryExecuteHighRiskOrRecordRefusal.mockReset();
  assertExecutionSucceeded.mockReset();
});

describe("live gate — allow", () => {
  it("reports the gate OPEN while the bound project is SAFE", async () => {
    readIsGateOpen.mockResolvedValue(true);
    renderGate();
    await waitFor(() => expect(screen.getByText("OPEN")).toBeInTheDocument());
  });

  it("executes a high-risk action and confirms it via a durable on-chain receipt", async () => {
    receiptFor("EXECUTED", submitExecuteHighRisk);
    renderGate();
    await waitFor(() => expect(screen.getByText("OPEN")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^execute_high_risk$/i }));

    await waitFor(() => expect(submitExecuteHighRisk).toHaveBeenCalled());
    expect(submitExecuteHighRisk.mock.calls[0]?.[0]).toBe(CALLER);
    await waitFor(() =>
      expect(screen.getByText(/authoritative contract state re-read successfully/i)).toBeInTheDocument(),
    );
  });

  it("keeps low-risk actions available (policy separation, not a blanket pause)", async () => {
    readIsGateOpen.mockResolvedValue(false);
    receiptFor("EXECUTED", submitExecuteLowRisk);
    renderGate();
    await waitFor(() => expect(screen.getByText(/REFUSING HIGH RISK/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^execute_low_risk$/i }));

    await waitFor(() => expect(submitExecuteLowRisk).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/authoritative contract state re-read successfully/i)).toBeInTheDocument(),
    );
  });
});

describe("live gate — refuse", () => {
  it("reports REFUSING HIGH RISK while the bound project is not SAFE", async () => {
    readIsGateOpen.mockResolvedValue(false);
    renderGate();
    await waitFor(() => expect(screen.getByText(/REFUSING HIGH RISK/i)).toBeInTheDocument());
  });

  it("surfaces a reverted execute_high_risk as EXECUTION_ERROR, never a false success", async () => {
    readIsGateOpen.mockResolvedValue(false);
    submitExecuteHighRisk.mockResolvedValue("0xtxhash");
    assertExecutionSucceeded.mockImplementation(() => {
      throw new Error("gate refused: project is not currently SAFE/RECOVERED");
    });

    renderGate();
    await waitFor(() => expect(screen.getByText(/REFUSING HIGH RISK/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^execute_high_risk$/i }));

    await waitFor(() =>
      expect(screen.getByText(/gate refused: project is not currently SAFE\/RECOVERED/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/contract execution error/i)).toBeInTheDocument();
    expect(screen.queryByText(/re-read successfully/i)).toBeNull();
  });

  it("treats a durable REFUSED_NOT_SAFE receipt as a valid (non-revert) outcome", async () => {
    readIsGateOpen.mockResolvedValue(false);
    receiptFor("REFUSED_NOT_SAFE", submitTryExecuteHighRiskOrRecordRefusal);

    renderGate();
    await waitFor(() => expect(screen.getByText(/REFUSING HIGH RISK/i)).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /try_high_risk_or_record_refusal/i }));

    await waitFor(() => expect(submitTryExecuteHighRiskOrRecordRefusal).toHaveBeenCalled());
    await waitFor(() =>
      expect(screen.getByText(/authoritative contract state re-read successfully/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/REFUSED_NOT_SAFE/)).toBeInTheDocument();
  });

  it("surfaces a live gate read failure instead of guessing the gate is open", async () => {
    readIsGateOpen.mockRejectedValue(new Error("RPC unreachable"));
    renderGate();
    await waitFor(() => expect(screen.getByText(/RPC unreachable/i)).toBeInTheDocument());
    expect(screen.queryByText("OPEN")).toBeNull();
  });
});

describe("live gate — replay", () => {
  it("reports STATE_MISMATCH when no receipt exists for this action_hash (replay rejected on-chain)", async () => {
    // A replayed action_hash is rejected by the contract, so no new receipt
    // keyed to it is ever written. The page must not report success.
    readIsGateOpen.mockResolvedValue(true);
    submitExecuteHighRisk.mockResolvedValue("0xtxhash");
    readGateReceipts.mockResolvedValue([
      JSON.stringify({ action_hash: "0xsomeotherhash", outcome: "EXECUTED" }),
    ]);

    renderGate();
    await waitFor(() => expect(screen.getByText("OPEN")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /^execute_high_risk$/i }));

    await waitFor(() =>
      expect(screen.getByText(/post-write state did not match expected outcome/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/re-read successfully/i)).toBeNull();
  });

  it("findReceiptOutcome matches only the exact action_hash, newest first", () => {
    const receipts = [
      JSON.stringify({ action_hash: "0xaa", outcome: "EXECUTED" }),
      JSON.stringify({ action_hash: "0xbb", outcome: "REFUSED_NOT_SAFE" }),
    ];
    expect(findReceiptOutcome(receipts, "0xaa")).toBe("EXECUTED");
    expect(findReceiptOutcome(receipts, "0xbb")).toBe("REFUSED_NOT_SAFE");
    expect(findReceiptOutcome(receipts, "0xcc")).toBeNull();
  });

  it("generates a distinct action_hash per submission so a replay is never issued accidentally", async () => {
    receiptFor("EXECUTED", submitExecuteHighRisk);
    renderGate();
    await waitFor(() => expect(screen.getByText("OPEN")).toBeInTheDocument());

    const button = screen.getByRole("button", { name: /^execute_high_risk$/i });
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByText(/authoritative contract state re-read successfully/i)).toBeInTheDocument(),
    );
    fireEvent.click(button);
    await waitFor(() => expect(submitExecuteHighRisk).toHaveBeenCalledTimes(2));

    const first = submitExecuteHighRisk.mock.calls[0]?.[2];
    const second = submitExecuteHighRisk.mock.calls[1]?.[2];
    expect(typeof first).toBe("string");
    expect(first).not.toBe(second);
  });
});
