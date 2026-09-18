"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useWallet } from "@/lib/wallet/context";
import { useTx } from "@/lib/wallet/useTx";
import { TxPanel } from "@/components/ui/TxPanel";
import { NetworkGuard } from "@/components/ui/NetworkGuard";
import { getProfileAddress } from "@/lib/contract/addresses";

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { address } = useWallet();
  const { tx, send, reset } = useTx(address, {
    onSuccess: () => {
      router.push(`/profile/${id}`);
    },
  });
  const [submitting, setSubmitting] = useState(false);

  async function handleRequestReview() {
    setSubmitting(true);
    await send(async (client, setStatus) => {
      setStatus("SUBMITTED");
      const profileAddr = getProfileAddress();
      const profileId = BigInt(id);

      const hash = await client.writeContract({
        address: profileAddr,
        functionName: "request_operational_review",
        args: [profileId],
        value: 0n,
      });

      setStatus("CONSENSUS_RUNNING");

      const receipt = await client.waitForTransactionReceipt({ hash });
      setStatus("FINALIZED");

      return { hash, result: receipt };
    });
    setSubmitting(false);
  }

  return (
    <NetworkGuard>
      <div style={{ maxWidth: 640, margin: "80px auto", padding: "0 24px" }}>
        <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
          DOSSIER #{id} · OPERATIONAL REVIEW
        </span>

        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "2rem",
            color: "var(--navy)",
            margin: "10px 0 16px",
          }}
        >
          Request Consensus Review
        </h1>

        <p style={{ color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: 32 }}>
          GenLayer validators will independently fetch your declared sources and evaluate
          four operational dimensions: Maintenance Activity, Ownership Attribution,
          Public Continuity, and Transparency.
        </p>

        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 8,
            padding: "20px 24px",
            background: "var(--surface)",
            marginBottom: 24,
          }}
        >
          <h3
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1rem",
              color: "var(--navy)",
              marginBottom: 12,
            }}
          >
            What validators verify
          </h3>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: "0.875rem",
              color: "var(--text-secondary)",
              lineHeight: 1.8,
            }}
          >
            <li>Recent maintenance activity (commits, releases, dates)</li>
            <li>Clear, verifiable ownership attribution</li>
            <li>Current public operational continuity</li>
            <li>Openness about project state and history</li>
          </ul>
          <p
            style={{
              marginTop: 14,
              fontSize: "0.78rem",
              color: "var(--text-secondary)",
              fontStyle: "italic",
            }}
          >
            Validators independently fetch your sources. Reason text may differ.
            Dimension bands must agree within one level.
          </p>
        </div>

        <button
          onClick={handleRequestReview}
          disabled={submitting || tx.status !== "IDLE"}
          style={{
            width: "100%",
            background: "var(--navy)",
            color: "var(--cream)",
            border: "none",
            borderRadius: 7,
            padding: "15px",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: submitting ? "not-allowed" : "pointer",
            opacity: submitting ? 0.7 : 1,
            fontFamily: "inherit",
          }}
          aria-label="Request operational review"
        >
          {submitting ? "Submitting…" : "Request Operational Review"}
        </button>

        <TxPanel tx={tx} onDismiss={reset} />
      </div>
    </NetworkGuard>
  );
}
