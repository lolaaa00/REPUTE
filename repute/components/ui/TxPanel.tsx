"use client";

import { TxState, statusLabel, isErrorStatus } from "@/lib/wallet/tx";
import { explorerTx } from "@/lib/genlayer/network";

interface TxPanelProps {
  tx: TxState;
  onDismiss?: () => void;
}

const PROGRESS_STATUSES = [
  "AWAITING_SIGNATURE",
  "SUBMITTED",
  "CONSENSUS_RUNNING",
  "FINALIZED",
  "EXECUTION_CONFIRMED",
  "STATE_REREAD",
];

export function TxPanel({ tx, onDismiss }: TxPanelProps) {
  if (tx.status === "IDLE") return null;

  const isError = isErrorStatus(tx.status);
  const isSuccess = tx.status === "STATE_REREAD" || tx.status === "EXECUTION_CONFIRMED";

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: `1px solid ${isError ? "var(--gold)" : isSuccess ? "var(--emerald)" : "var(--border)"}`,
        borderRadius: 8,
        padding: "16px 20px",
        background: isError ? "#fffbf0" : isSuccess ? "#f0faf5" : "var(--surface)",
        marginTop: 16,
      }}
    >
      {/* Status row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {!isError && !isSuccess && (
            <Spinner />
          )}
          {isError && <span style={{ color: "var(--gold)" }}>⚠</span>}
          {isSuccess && <span style={{ color: "var(--emerald)" }}>✓</span>}
          <span
            className="mono"
            style={{ fontSize: "0.8rem", color: isError ? "var(--gold)" : isSuccess ? "var(--emerald)" : "var(--navy)" }}
          >
            {statusLabel(tx.status)}
          </span>
        </span>
        {onDismiss && (
          <button
            onClick={onDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-secondary)", fontSize: "1rem" }}
            aria-label="Dismiss"
          >
            ×
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!isError && (
        <div style={{ marginTop: 12, display: "flex", gap: 4 }}>
          {PROGRESS_STATUSES.map(s => {
            const current = PROGRESS_STATUSES.indexOf(tx.status);
            const idx = PROGRESS_STATUSES.indexOf(s);
            return (
              <div
                key={s}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background: idx <= current ? "var(--emerald)" : "var(--border)",
                  transition: "background 0.3s",
                }}
              />
            );
          })}
        </div>
      )}

      {/* Error */}
      {isError && tx.error && (
        <p style={{ margin: "8px 0 0", fontSize: "0.8rem", color: "var(--charcoal)" }}>
          {tx.error}
        </p>
      )}

      {/* Explorer link */}
      {tx.hash && (
        <p style={{ margin: "8px 0 0", fontSize: "0.75rem" }}>
          <a
            href={explorerTx(tx.hash)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--cobalt)", textDecoration: "underline" }}
            className="mono"
          >
            View on Explorer ↗
          </a>
        </p>
      )}
    </div>
  );
}

function Spinner() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 14,
        height: 14,
        border: "2px solid var(--border)",
        borderTopColor: "var(--cobalt)",
        borderRadius: "50%",
        animation: "spin 0.8s linear infinite",
      }}
    />
  );
}
