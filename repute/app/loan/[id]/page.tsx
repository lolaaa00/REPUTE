"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet/context";
import { useTx } from "@/lib/wallet/useTx";
import { TxPanel } from "@/components/ui/TxPanel";
import { NetworkGuard } from "@/components/ui/NetworkGuard";
import { getLoan, LoanRecord } from "@/lib/contract/vault";
import { getVaultAddress } from "@/lib/contract/addresses";
import { formatGen } from "@/lib/genlayer/gen";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "var(--cobalt)",
  REPAID: "var(--emerald)",
  DEFAULTED: "var(--gold)",
  CLOSED: "var(--text-secondary)",
};

export default function LoanPage() {
  const { id } = useParams<{ id: string }>();
  const { address } = useWallet();
  const [loan, setLoan] = useState<LoanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { tx, send, reset } = useTx(address, {
    onSuccess: async () => {
      const updated = await getLoan(getVaultAddress(), BigInt(id));
      setLoan(updated);
    },
  });

  useEffect(() => {
    getLoan(getVaultAddress(), BigInt(id))
      .then(setLoan)
      .catch(err => setError(err instanceof Error ? err.message : "Loan not found"))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleRepay() {
    if (!loan) return;
    await send(async (client, setStatus) => {
      setStatus("SUBMITTED");
      const vaultAddr = getVaultAddress();
      const hash = await client.writeContract({
        address: vaultAddr,
        functionName: "repay",
        args: [BigInt(loan.loan_id)],
        value: BigInt(loan.principal) as bigint,
      });
      setStatus("CONSENSUS_RUNNING");
      const receipt = await client.waitForTransactionReceipt({ hash });
      setStatus("FINALIZED");
      return { hash, result: receipt };
    });
  }

  async function handleMarkDefault() {
    if (!loan) return;
    await send(async (client, setStatus) => {
      setStatus("SUBMITTED");
      const vaultAddr = getVaultAddress();
      const hash = await client.writeContract({
        address: vaultAddr,
        functionName: "mark_default",
        args: [BigInt(loan.loan_id)],
        value: 0n,
      });
      setStatus("CONSENSUS_RUNNING");
      const receipt = await client.waitForTransactionReceipt({ hash });
      setStatus("FINALIZED");
      return { hash, result: receipt };
    });
  }

  if (loading) return <div style={{ padding: "80px 24px", textAlign: "center" }}><p className="mono" style={{ color: "var(--text-secondary)" }}>Loading ledger…</p></div>;
  if (error || !loan) return <div style={{ padding: "80px 24px", textAlign: "center" }}><p style={{ color: "var(--gold)" }}>{error ?? "Loan not found"}</p></div>;

  const dueDate = new Date(Number(loan.due_at) * 1000);
  const isOverdue = loan.status === "ACTIVE" && Date.now() > Number(loan.due_at) * 1000;
  const statusColor = STATUS_COLORS[loan.status] ?? "var(--text-secondary)";

  return (
    <NetworkGuard requireWallet={false}>
      <div style={{ maxWidth: 680, margin: "60px auto", padding: "0 24px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 8 }}>
          <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
            LOAN LEDGER · #{loan.loan_id}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 32 }}>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.8rem",
              color: "var(--navy)",
              margin: 0,
            }}
          >
            Loan #{loan.loan_id}
          </h1>
          <span
            className="mono stamp"
            style={{ color: statusColor, borderColor: statusColor }}
          >
            {loan.status}
          </span>
        </div>

        {/* Ledger grid */}
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            overflow: "hidden",
            marginBottom: 28,
          }}
        >
          {[
            { label: "Principal", val: `${formatGen(BigInt(loan.principal))} GEN` },
            { label: "Collateral", val: `${formatGen(BigInt(loan.collateral))} GEN` },
            { label: "Repaid", val: `${formatGen(BigInt(loan.repaid_amount))} GEN` },
            { label: "Credit band (at issue)", val: loan.credit_band_snapshot },
            { label: "Profile", val: `#${loan.profile_id}` },
            { label: "Borrower", val: `${loan.borrower.slice(0, 10)}…` },
            { label: "Issued", val: new Date(Number(loan.issued_at) * 1000).toLocaleDateString() },
            {
              label: "Due",
              val: dueDate.toLocaleDateString(),
              alert: isOverdue,
            },
          ].map(row => (
            <div
              key={row.label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "12px 20px",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-raised)",
              }}
            >
              <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                {row.label}
              </span>
              <span
                className="mono"
                style={{
                  fontSize: "0.82rem",
                  color: row.alert ? "var(--gold)" : "var(--navy)",
                  fontWeight: 600,
                }}
              >
                {row.val}
                {row.alert && " ⚠ OVERDUE"}
              </span>
            </div>
          ))}
        </div>

        {/* Actions */}
        {loan.status === "ACTIVE" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {loan.borrower === address && (
              <button
                onClick={handleRepay}
                disabled={tx.status !== "IDLE"}
                style={{
                  background: "var(--emerald)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 7,
                  padding: "14px",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Repay {formatGen(BigInt(loan.principal))} GEN
              </button>
            )}
            {isOverdue && (
              <button
                onClick={handleMarkDefault}
                disabled={tx.status !== "IDLE"}
                style={{
                  background: "transparent",
                  border: "1px solid var(--gold)",
                  color: "var(--gold)",
                  borderRadius: 7,
                  padding: "12px",
                  fontSize: "0.88rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Mark as Defaulted (permissionless)
              </button>
            )}
          </div>
        )}

        <TxPanel tx={tx} onDismiss={reset} />
      </div>
    </NetworkGuard>
  );
}
