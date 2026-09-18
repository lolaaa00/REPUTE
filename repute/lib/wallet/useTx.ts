"use client";

import { useCallback, useState } from "react";
import { createWriteClient, validateChain } from "@/lib/genlayer/client";
import { INITIAL_TX_STATE, TxState, TxStatus } from "./tx";

type SendFn = (
  client: ReturnType<typeof createWriteClient>,
  setStatus: (s: TxStatus) => void
) => Promise<{ hash: string; result: unknown }>;

interface UseTxOptions {
  onSuccess?: (hash: string, result: unknown) => void | Promise<void>;
  onError?: (err: string) => void;
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

        // Verify consensus outcome before declaring success
        const receipt = result as Record<string, unknown> | null | undefined;
        const consensusData = receipt?.consensus_data as Record<string, unknown> | undefined;
        const finalResult = consensusData?.final_result as Record<string, unknown> | undefined;
        const execResult = finalResult?.result as Record<string, unknown> | undefined;

        // Check execution success: look for error indicators in the receipt
        const hasError =
          execResult?.error != null ||
          execResult?.execution_error != null ||
          (typeof execResult?.message === "string" && execResult.message.toLowerCase().includes("revert"));

        if (hasError) {
          const errMsg =
            (execResult?.error as string) ||
            (execResult?.execution_error as string) ||
            (execResult?.message as string) ||
            "Transaction reverted on-chain";
          setTx({ ...INITIAL_TX_STATE, status: "EXECUTION_ERROR", error: errMsg });
          opts?.onError?.(errMsg);
          return;
        }

        setTx(s => ({ ...s, status: "EXECUTION_CONFIRMED", hash, result }));

        // Re-read state
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
