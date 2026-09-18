/**
 * Integration coverage for the three ways a live Studionet write can fail
 * *after* a transaction hash already exists. A hash is never success on its
 * own, so each of these must land in a distinct, terminal, visible state:
 *
 *   1. the leader/validator round never reaches FINALIZED  -> CONSENSUS_FAILURE
 *   2. it finalizes but the GenVM call reverted            -> EXECUTION_ERROR
 *   3. it finalized and succeeded, but the authoritative
 *      post-write reread does not match the expectation    -> STATE_MISMATCH
 *
 * Driven through the real check-chamber panel and the real useTxLifecycle
 * state machine; only the adapters and the finality step are faked.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

const submitRunSafetyCheck = vi.fn();
const readStatus = vi.fn();
const waitForFinality = vi.fn();
const assertExecutionSucceeded = vi.fn();

vi.mock("@/lib/contract/registryAdapter", () => ({
  submitRunSafetyCheck: (...a: unknown[]) => submitRunSafetyCheck(...a),
  readStatus: (...a: unknown[]) => readStatus(...a),
}));

vi.mock("@/lib/contract/finality", () => ({
  createFinalityStep: () => ({
    waitForFinality: (hash: string) => waitForFinality(hash),
    assertExecutionSucceeded: () => assertExecutionSucceeded(),
  }),
}));

vi.mock("@/lib/wallet/WalletProvider", () => ({
  useWallet: () => ({
    status: "CONNECTED",
    address: "0xchecker0000000000000000000000000000000ab",
    chainId: 61999,
    provider: {},
  }),
  isWriteReady: () => true,
}));

import { CheckChamberPanel } from "@/app/p/[id]/check/page";

function runCheck() {
  render(<CheckChamberPanel projectId="failover-demo" />);
  fireEvent.click(screen.getByRole("button", { name: /run safety check/i }));
}

beforeEach(() => {
  submitRunSafetyCheck.mockReset().mockResolvedValue("0xdeadbeef");
  readStatus.mockReset().mockResolvedValue("SAFE");
  waitForFinality.mockReset().mockResolvedValue({ status: "FINALIZED" });
  assertExecutionSucceeded.mockReset();
});

describe("finalized consensus failure handling", () => {
  it("reports CONSENSUS_FAILURE (not success) when the round never reaches FINALIZED", async () => {
    waitForFinality.mockResolvedValue({
      status: "CONSENSUS_FAILURE",
      error: "transaction settled without reaching FINALIZED (status: UNDETERMINED)",
    });

    runCheck();

    await waitFor(() => expect(screen.getByText(/validator consensus failed/i)).toBeInTheDocument());
    expect(screen.getByText(/without reaching FINALIZED/i)).toBeInTheDocument();
    expect(screen.queryByText(/re-read successfully/i)).toBeNull();
    // Nothing downstream of finality may run on a consensus failure.
    expect(assertExecutionSucceeded).not.toHaveBeenCalled();
    expect(readStatus).not.toHaveBeenCalled();
  });

  it("reports CONSENSUS_FAILURE when waiting for consensus throws (RPC timeout)", async () => {
    waitForFinality.mockRejectedValue(new Error("timed out waiting for leader/validator consensus"));

    runCheck();

    await waitFor(() => expect(screen.getByText(/validator consensus failed/i)).toBeInTheDocument());
    expect(screen.getByText(/timed out waiting for leader\/validator consensus/i)).toBeInTheDocument();
    expect(readStatus).not.toHaveBeenCalled();
  });

  it("still links the transaction on the explorer so a consensus failure is auditable", async () => {
    waitForFinality.mockResolvedValue({ status: "CONSENSUS_FAILURE", error: "consensus failed" });

    runCheck();

    await waitFor(() => expect(screen.getByText(/validator consensus failed/i)).toBeInTheDocument());
    const link = screen.getByRole("link", { name: /view transaction on explorer/i });
    expect(link.getAttribute("href")).toContain("0xdeadbeef");
  });
});

describe("finalized execution revert handling", () => {
  it("reports EXECUTION_ERROR with the contract's own message when a FINALIZED tx reverted", async () => {
    assertExecutionSucceeded.mockImplementation(() => {
      throw new Error("check cooldown has not elapsed for this project");
    });

    runCheck();

    await waitFor(() => expect(screen.getByText(/contract execution error/i)).toBeInTheDocument());
    expect(screen.getByText(/check cooldown has not elapsed/i)).toBeInTheDocument();
    expect(screen.queryByText(/re-read successfully/i)).toBeNull();
  });

  it("does not report success merely because the transaction reached FINALIZED", async () => {
    assertExecutionSucceeded.mockImplementation(() => {
      throw new Error("only the project owner may perform this action");
    });

    runCheck();

    await waitFor(() => expect(screen.getByText(/contract execution error/i)).toBeInTheDocument());
    expect(waitForFinality).toHaveBeenCalledWith("0xdeadbeef");
    expect(screen.queryByLabelText(/Project status:/i)).toBeNull();
  });
});

describe("authoritative post-write reread mismatch handling", () => {
  it("reports STATE_MISMATCH when the reread disagrees with the execution result", async () => {
    // Execution result observed SAFE; the authoritative reread observes
    // RESTRICTED (e.g. a stale RPC replica, or a racing second check).
    readStatus.mockResolvedValueOnce("SAFE").mockResolvedValueOnce("RESTRICTED");

    runCheck();

    await waitFor(() =>
      expect(screen.getByText(/post-write state did not match expected outcome/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText(/re-read successfully/i)).toBeNull();
    expect(readStatus).toHaveBeenCalledTimes(2);
  });

  it("reports STATE_MISMATCH when the authoritative reread itself throws", async () => {
    readStatus.mockResolvedValueOnce("SAFE").mockRejectedValueOnce(new Error("get_status read failed"));

    runCheck();

    await waitFor(() =>
      expect(screen.getByText(/post-write state did not match expected outcome/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/get_status read failed/i)).toBeInTheDocument();
  });

  it("only reports success once the authoritative reread confirms the expected state", async () => {
    readStatus.mockResolvedValue("SAFE");

    runCheck();

    await waitFor(() =>
      expect(screen.getByText(/authoritative contract state re-read successfully/i)).toBeInTheDocument(),
    );
    expect(screen.getByLabelText(/Project status: SAFE/i)).toBeInTheDocument();
    expect(readStatus).toHaveBeenCalledTimes(2);
  });
});
