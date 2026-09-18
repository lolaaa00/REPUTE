"use client";

import { useWallet } from "@/lib/wallet/context";

export function WalletButton() {
  const { address, isConnected, isCorrectNetwork, isConnecting, connect, disconnect, switchNetwork } =
    useWallet();

  const short = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : null;

  if (!isConnected) {
    return (
      <button
        onClick={connect}
        disabled={isConnecting}
        style={{
          background: "var(--navy)",
          color: "var(--cream)",
          border: "none",
          borderRadius: 6,
          padding: "8px 18px",
          fontSize: "0.875rem",
          fontWeight: 600,
          cursor: isConnecting ? "not-allowed" : "pointer",
          opacity: isConnecting ? 0.7 : 1,
          fontFamily: "inherit",
          transition: "opacity 0.15s",
        }}
        aria-label="Connect wallet"
      >
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  if (!isCorrectNetwork) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={switchNetwork}
          style={{
            background: "var(--gold)",
            color: "var(--navy)",
            border: "none",
            borderRadius: 6,
            padding: "8px 14px",
            fontSize: "0.8rem",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
          aria-label="Switch to Studionet"
        >
          Switch to Studionet
        </button>
        <button
          onClick={disconnect}
          style={ghostBtn}
          aria-label="Disconnect wallet"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span
        className="mono"
        style={{
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: 4,
          padding: "4px 10px",
        }}
      >
        {short}
      </span>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          background: "var(--emerald)",
          display: "inline-block",
        }}
        aria-label="Connected"
        title="Connected to Studionet"
      />
      <button onClick={disconnect} style={ghostBtn} aria-label="Disconnect wallet">
        Disconnect
      </button>
    </div>
  );
}

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "5px 12px",
  fontSize: "0.8rem",
  fontWeight: 500,
  cursor: "pointer",
  color: "var(--text-secondary)",
  fontFamily: "inherit",
};
