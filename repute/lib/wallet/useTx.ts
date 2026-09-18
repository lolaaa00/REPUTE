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
