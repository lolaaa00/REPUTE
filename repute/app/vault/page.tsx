"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@/lib/wallet/context";
import { useTx } from "@/lib/wallet/useTx";
import { TxPanel } from "@/components/ui/TxPanel";
import { getVaultAddress } from "@/lib/contract/addresses";
import { getVaultStats, getLpBalance, VaultStats } from "@/lib/contract/vault";
import { parseGen, formatGen } from "@/lib/genlayer/gen";

export default function VaultPage() {
  const { address } = useWallet();
  const [stats, setStats] = useState<VaultStats | null>(null);
  const [lpBalance, setLpBalance] = useState<bigint>(0n);
  const [depositStr, setDepositStr] = useState("");
  const [depositError, setDepositError] = useState<string | null>(null);
  const [withdrawStr, setWithdrawStr] = useState("");
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const { tx, send, reset } = useTx(address, {
    onSuccess: async () => {
      await loadStats();
    },
  });
  const { tx: wTx, send: sendWithdraw, reset: resetWithdraw } = useTx(address, {
    onSuccess: async () => {
      await loadStats();
    },
  });

  async function loadStats() {
    const vaultAddr = getVaultAddress();
    const [s, lb] = await Promise.all([
      getVaultStats(vaultAddr).catch(() => null),
      address ? getLpBalance(vaultAddr, address).catch(() => 0n) : Promise.resolve(0n),
    ]);
    if (s) setStats(s);
    setLpBalance(lb);
  }

  useEffect(() => {
    setLoading(true);
    loadStats().finally(() => setLoading(false));
  }, [address]);

  async function handleWithdraw() {
    setWithdrawError(null);
    try {
      const amount = parseGen(withdrawStr);
      if (amount <= 0n) {
        setWithdrawError("Enter a positive amount");
        return;
      }
      if (amount > lpBalance) {
        setWithdrawError(`Amount exceeds your deposit: ${formatGen(lpBalance)} GEN`);
        return;
      }
      const balanceBefore = lpBalance;
      await sendWithdraw(async (client, setStatus) => {
        setStatus("SUBMITTED");
        const vaultAddr = getVaultAddress();
        const hash = await client.writeContract({
          address: vaultAddr,
          functionName: "withdraw_liquidity",
          args: [amount],
          value: 0n,
        });
        setStatus("CONSENSUS_RUNNING");
        const receipt = await client.waitForTransactionReceipt({ hash });
        setStatus("FINALIZED");

        // Postcondition: LP balance must have decreased by withdrawn amount
        if (address) {
          const newBalance = await getLpBalance(vaultAddr, address).catch(() => balanceBefore);
          if (BigInt(newBalance) >= BigInt(balanceBefore)) {
            throw new Error("Postcondition failed: LP balance did not decrease after withdrawal");
          }
        }

        return { hash, result: receipt };
      });
    } catch (err) {
      setWithdrawError(err instanceof Error ? err.message : "Invalid amount");
    }
  }

  async function handleDeposit() {
    setDepositError(null);
    try {
      const amount = parseGen(depositStr);
      if (amount <= 0n) {
        setDepositError("Enter a positive amount");
        return;
      }
      const balanceBefore = lpBalance;
      await send(async (client, setStatus) => {
        setStatus("SUBMITTED");
        const vaultAddr = getVaultAddress();
        const hash = await client.writeContract({
          address: vaultAddr,
          functionName: "deposit_liquidity",
          args: [],
          value: amount,
        });
        setStatus("CONSENSUS_RUNNING");
        const receipt = await client.waitForTransactionReceipt({ hash });
        setStatus("FINALIZED");

        // Postcondition: LP balance must have increased
        if (address) {
          const newBalance = await getLpBalance(vaultAddr, address).catch(() => balanceBefore);
          if (BigInt(newBalance) <= BigInt(balanceBefore)) {
            throw new Error("Postcondition failed: LP balance did not increase after deposit");
          }
        }

        return { hash, result: receipt };
      });
    } catch (err) {
      setDepositError(err instanceof Error ? err.message : "Invalid amount");
    }
  }

  const s = stats;
  const total = s ? BigInt(s.total_liquidity) : 0n;
  const reserved = s ? BigInt(s.reserved_liquidity) : 0n;
  const collateral = s ? BigInt(s.total_collateral) : 0n;
  const available = s ? BigInt(Math.max(0, Number(s.available_liquidity))) : 0n;
  const repaid = s ? BigInt(s.repaid_principal) : 0n;

  const utilizationPct =
    total + collateral > 0n
      ? Number((reserved * 100n) / (total + collateral))
      : 0;

  return (
    <div style={{ maxWidth: 880, margin: "0 auto", padding: "60px 24px" }}>
      <h1
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "2rem",
          color: "var(--navy)",
          marginBottom: 8,
        }}
      >
        Liquidity Vault
      </h1>
      <p style={{ color: "var(--text-secondary)", marginBottom: 40 }}>
        Zero-interest testnet liquidity pool. Funds are used for under-collateralized loans to verified projects.
      </p>

      {/* Stats grid */}
      {loading ? (
        <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          Loading vault…
        </p>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: 16,
              marginBottom: 40,
            }}
          >
            {[
              { label: "Total Liquidity", val: formatGen(total) + " GEN" },
              { label: "Available", val: formatGen(available) + " GEN", highlight: true },
              { label: "Reserved (Loans)", val: formatGen(reserved) + " GEN" },
              { label: "Collateral Held", val: formatGen(collateral) + " GEN" },
              { label: "Repaid (cumulative)", val: formatGen(repaid) + " GEN" },
              { label: "Utilization", val: utilizationPct.toFixed(1) + "%" },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "18px 20px",
                  background: item.highlight ? "var(--navy)" : "var(--surface-raised)",
                }}
              >
                <p
                  style={{
                    margin: "0 0 6px",
                    fontSize: "0.72rem",
                    color: item.highlight ? "rgba(239,233,220,0.6)" : "var(--text-secondary)",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    fontWeight: 600,
                  }}
                >
                  {item.label}
                </p>
                <p
                  className="mono"
                  style={{
                    margin: 0,
                    fontSize: "1.1rem",
                    color: item.highlight ? "var(--cream)" : "var(--navy)",
                    fontWeight: 700,
                  }}
                >
                  {item.val}
                </p>
              </div>
            ))}
          </div>

          {/* Utilization bar */}
          <div style={{ marginBottom: 48 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>Utilization</span>
              <span className="mono" style={{ fontSize: "0.72rem", color: "var(--text-secondary)" }}>{utilizationPct.toFixed(1)}%</span>
            </div>
            <div style={{ height: 6, background: "var(--border)", borderRadius: 3 }}>
              <div
                style={{
                  height: "100%",
                  width: `${Math.min(utilizationPct, 100)}%`,
                  background: utilizationPct > 70 ? "var(--gold)" : "var(--cobalt)",
                  borderRadius: 3,
                  transition: "width 0.5s",
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Deposit panel */}
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "28px",
          background: "var(--surface-raised)",
          maxWidth: 440,
        }}
      >
        <h2
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "1.3rem",
            color: "var(--navy)",
            marginBottom: 6,
          }}
        >
          Deposit Liquidity
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 20 }}>
          Add GEN to the shared testnet pool. No yield. Funds used for verified-project loans.
        </p>

        {address && lpBalance > 0n && (
          <p className="mono" style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginBottom: 12 }}>
            Your deposit: {formatGen(lpBalance)} GEN
          </p>
        )}

        <label
          style={{
            display: "block",
            fontSize: "0.8rem",
            fontWeight: 600,
            color: "var(--charcoal)",
            marginBottom: 6,
          }}
        >
          Amount (GEN)
        </label>
        <input
          style={{
            width: "100%",
            border: "1px solid var(--border)",
            borderRadius: 6,
            padding: "10px 14px",
            fontSize: "0.9rem",
            color: "var(--navy)",
            fontFamily: "inherit",
            background: "var(--surface)",
            outline: "none",
            boxSizing: "border-box",
          }}
          value={depositStr}
          onChange={e => setDepositStr(e.target.value)}
          placeholder="e.g. 5.0"
          aria-label="Deposit amount in GEN"
        />

        {depositError && <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 6 }}>{depositError}</p>}

        {!address ? (
          <p style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Connect your wallet to deposit.
          </p>
        ) : (
          <button
            onClick={handleDeposit}
            disabled={tx.status !== "IDLE"}
            style={{
              width: "100%",
              marginTop: 16,
              background: "var(--navy)",
              color: "var(--cream)",
              border: "none",
              borderRadius: 7,
              padding: "13px",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Deposit Liquidity
          </button>
        )}

        <TxPanel tx={tx} onDismiss={reset} />
      </div>

      {/* Withdrawal panel — only show if LP has a balance */}
      {address && lpBalance > 0n && (
        <div
          style={{
            border: "1px solid var(--border)",
            borderRadius: 10,
            padding: "28px",
            background: "var(--surface-raised)",
            maxWidth: 440,
            marginTop: 24,
          }}
        >
          <h2
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.3rem",
              color: "var(--navy)",
              marginBottom: 6,
            }}
          >
            Withdraw Liquidity
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 12 }}>
            Your deposit: <strong>{formatGen(lpBalance)} GEN</strong>. Withdrawal limited to available vault liquidity.
          </p>

          <label
            style={{
              display: "block",
              fontSize: "0.8rem",
              fontWeight: 600,
              color: "var(--charcoal)",
              marginBottom: 6,
            }}
          >
            Amount (GEN)
          </label>
          <input
            style={{
              width: "100%",
              border: "1px solid var(--border)",
              borderRadius: 6,
              padding: "10px 14px",
              fontSize: "0.9rem",
              color: "var(--navy)",
              fontFamily: "inherit",
              background: "var(--surface)",
              outline: "none",
              boxSizing: "border-box",
            }}
            value={withdrawStr}
            onChange={e => setWithdrawStr(e.target.value)}
            placeholder={`Max ${formatGen(lpBalance)}`}
            aria-label="Withdrawal amount in GEN"
          />

          {withdrawError && (
            <p style={{ color: "var(--gold)", fontSize: "0.82rem", marginTop: 6 }}>{withdrawError}</p>
          )}

          <button
            onClick={handleWithdraw}
            disabled={wTx.status !== "IDLE"}
            style={{
              width: "100%",
              marginTop: 16,
              background: "var(--surface)",
              color: "var(--navy)",
              border: "1.5px solid var(--navy)",
              borderRadius: 7,
              padding: "13px",
              fontSize: "0.95rem",
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Withdraw
          </button>
          <TxPanel tx={wTx} onDismiss={resetWithdraw} />
        </div>
      )}
    </div>
  );
}
