"use client";

import { useCallback, useState } from "react";
import { createWriteClient, validateChain } from "@/lib/genlayer/client";
import { INITIAL_TX_STATE, TxState, TxStatus } from "./tx";

// Shape of genlayer-js 1.1.8 GenLayerTransaction receipt
interface LeaderReceipt {
  execution_result: string; // "SUCCESS" | "ERROR"
  error: string | null;
  calldata: string;
}

interface ConsensusData {
  final: boolean;
  leader_receipt?: LeaderReceipt[];
}

interface GlReceipt {
  resultName?: string; // "AGREE" | "DISAGREE" | "TIMEOUT" | etc.
  consensus_data?: ConsensusData;
}

type SendFn = (
  client: ReturnType<typeof createWriteClient>,
  setStatus: (s: TxStatus) => void
) => Promise<{ hash: string; result: unknown }>;

interface UseTxOptions {
  onSuccess?: (hash: string, result: unknown) => void | Promise<void>;
  onError?: (err: string) => void;
}

function checkReceiptForError(result: unknown): string | null {
  const receipt = result as GlReceipt | null | undefined;
  if (!receipt) return null;

  // Consensus-level failure: validators disagreed or timed out
  const resultName = receipt.resultName;
  if (
    resultName === "DISAGREE" ||
    resultName === "TIMEOUT" ||
    resultName === "DETERMINISTIC_VIOLATION" ||
    resultName === "NO_MAJORITY"
  ) {
    return `Consensus failed: ${resultName}`;
  }

  // Execution-level failure: leader receipt says ERROR
  const leaderReceipt = receipt.consensus_data?.leader_receipt;
  if (Array.isArray(leaderReceipt) && leaderReceipt.length > 0) {
    const lr = leaderReceipt[0];
    if (lr.execution_result === "ERROR") {
      return lr.error || "Transaction reverted on-chain";
    }
  }

  return null;
}

export function useTx(address: `0x${string}` | null, opts?: UseTxOptions) {
  const [tx, setTx] = useState<TxState>(INITIAL_TX_STATE);

  const setStatus = useCallback((status: TxStatus, extra?: Partial<TxState>) => {
    setTx(s => ({ ...s, status, ...extra }));
  }, []);

  const send = useCallback(
    async (fn: SendFn) => {
      if (!address) {
        setTx({ ...INITIAL_TX_STATE, status: "WRONG_NETWORK", error: "Wallet not connected" });
        return;
      }

      setTx({ ...INITIAL_TX_STATE, status: "AWAITING_SIGNATURE" });

      try {
        await validateChain();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Wrong network";
        setTx({ ...INITIAL_TX_STATE, status: "WRONG_NETWORK", error: msg });
        opts?.onError?.(msg);
        return;
      }

      try {
        const client = createWriteClient(address);
        await client.connect("studionet");

        const { hash, result } = await fn(client, setStatus);

        // Check receipt for consensus or execution failure before declaring success
        const errMsg = checkReceiptForError(result);
        if (errMsg) {
          const status: TxStatus = errMsg.startsWith("Consensus")
            ? "CONSENSUS_FAILURE"
            : "EXECUTION_ERROR";
          setTx({ ...INITIAL_TX_STATE, status, error: errMsg });
          opts?.onError?.(errMsg);
          return;
        }

        setTx(s => ({ ...s, status: "EXECUTION_CONFIRMED", hash, result }));

        setStatus("STATE_REREAD");
        await opts?.onSuccess?.(hash, result);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        let status: TxStatus = "RPC_ERROR";
        if (msg.includes("rejected") || msg.includes("denied") || msg.includes("4001")) {
          status = "USER_REJECTED";
        } else if (msg.includes("consensus") || msg.includes("validator")) {
          status = "CONSENSUS_FAILURE";
        } else if (msg.includes("execution") || msg.includes("revert")) {
          status = "EXECUTION_ERROR";
        }
        setTx({ ...INITIAL_TX_STATE, status, error: msg });
        opts?.onError?.(msg);
      }
    },
    [address, opts, setStatus]
  );

  const reset = useCallback(() => setTx(INITIAL_TX_STATE), []);

  return { tx, send, reset };
}
