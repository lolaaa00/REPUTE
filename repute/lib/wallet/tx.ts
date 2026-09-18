/**
 * Transaction lifecycle hook and types.
 * Tracks: AWAITING_SIGNATURE → SUBMITTED → CONSENSUS_RUNNING → FINALIZED →
 *         EXECUTION_CONFIRMED → STATE_REREAD
 */

export type TxStatus =
  | "IDLE"
  | "AWAITING_SIGNATURE"
  | "SUBMITTED"
  | "CONSENSUS_RUNNING"
  | "FINALIZED"
  | "EXECUTION_CONFIRMED"
  | "STATE_REREAD"
  | "USER_REJECTED"
  | "WRONG_NETWORK"
  | "RPC_ERROR"
  | "CONSENSUS_FAILURE"
  | "EXECUTION_ERROR"
  | "STATE_MISMATCH";

export interface TxState {
  status: TxStatus;
  hash: string | null;
  error: string | null;
  result: unknown;
}

export const INITIAL_TX_STATE: TxState = {
  status: "IDLE",
  hash: null,
  error: null,
  result: null,
};

export function isTerminalStatus(status: TxStatus): boolean {
  return [
    "EXECUTION_CONFIRMED",
    "STATE_REREAD",
    "USER_REJECTED",
    "WRONG_NETWORK",
    "RPC_ERROR",
    "CONSENSUS_FAILURE",
    "EXECUTION_ERROR",
    "STATE_MISMATCH",
  ].includes(status);
}

export function isErrorStatus(status: TxStatus): boolean {
  return [
    "USER_REJECTED",
    "WRONG_NETWORK",
    "RPC_ERROR",
    "CONSENSUS_FAILURE",
    "EXECUTION_ERROR",
    "STATE_MISMATCH",
  ].includes(status);
}

export function statusLabel(status: TxStatus): string {
  const labels: Record<TxStatus, string> = {
    IDLE: "Ready",
    AWAITING_SIGNATURE: "Waiting for signature…",
    SUBMITTED: "Transaction submitted",
    CONSENSUS_RUNNING: "Consensus running…",
    FINALIZED: "Finalized",
    EXECUTION_CONFIRMED: "Execution confirmed",
    STATE_REREAD: "State updated",
    USER_REJECTED: "Rejected by user",
    WRONG_NETWORK: "Wrong network",
    RPC_ERROR: "RPC error",
    CONSENSUS_FAILURE: "Consensus failed",
    EXECUTION_ERROR: "Execution error",
    STATE_MISMATCH: "State mismatch",
  };
  return labels[status] ?? status;
}
