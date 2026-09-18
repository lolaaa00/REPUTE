"use client";

import { useWallet } from "@/lib/wallet/context";

interface NetworkGuardProps {
  children: React.ReactNode;
  requireWallet?: boolean;
}

export function NetworkGuard({ children, requireWallet = true }: NetworkGuardProps) {
  const { isConnected, isCorrectNetwork, connect, switchNetwork } = useWallet();

  if (requireWallet && !isConnected) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "var(--navy)" }}>
          Connect your wallet
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: "12px 0 28px" }}>
          This page requires a connected wallet on GenLayer Studionet.
        </p>
        <button
          onClick={connect}
          style={{
            background: "var(--navy)",
            color: "var(--cream)",
            border: "none",
            borderRadius: 6,
            padding: "12px 28px",
            fontSize: "0.95rem",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Connect Wallet
        </button>
      </div>
    );
  }

  if (requireWallet && isConnected && !isCorrectNetwork) {
    return (
      <div style={{ textAlign: "center", padding: "80px 24px" }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.6rem", color: "var(--navy)" }}>
          Wrong Network
        </h2>
        <p style={{ color: "var(--text-secondary)", margin: "12px 0 28px" }}>
          Please switch to GenLayer Studionet (chain ID 61999).
        </p>
        <button
          onClick={switchNetwork}
          style={{
            background: "var(--gold)",
            color: "var(--navy)",
            border: "none",
            borderRadius: 6,
            padding: "12px 28px",
            fontSize: "0.95rem",
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          Switch to Studionet
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
