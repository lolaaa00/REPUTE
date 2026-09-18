"use client";

import type { CreditBand } from "@/lib/contract/profile";

const BAND_CONFIG: Record<CreditBand, { label: string; color: string; multiplier: string }> = {
  NONE: { label: "NONE", color: "var(--text-secondary)", multiplier: "–" },
  STARTER: { label: "STARTER", color: "var(--gold)", multiplier: "1.25×" },
  ESTABLISHED: { label: "ESTABLISHED", color: "var(--cobalt)", multiplier: "1.75×" },
  TRUSTED: { label: "TRUSTED", color: "var(--emerald)", multiplier: "2.50×" },
};

export function CreditBadge({ band }: { band: CreditBand }) {
  const cfg = BAND_CONFIG[band] ?? BAND_CONFIG.NONE;
  return (
    <span
      className="mono stamp"
      style={{
        color: cfg.color,
        borderColor: cfg.color,
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
      }}
      aria-label={`Credit band: ${cfg.label}`}
    >
      {cfg.label}
      {cfg.multiplier !== "–" && (
        <span style={{ opacity: 0.7 }}>{cfg.multiplier}</span>
      )}
    </span>
  );
}

export function DimensionBand({ value }: { value: string }) {
  const colorMap: Record<string, string> = {
    STRONG: "var(--emerald)",
    MODERATE: "var(--cobalt)",
    WEAK: "var(--gold)",
    UNRESOLVED: "var(--text-secondary)",
  };
  const color = colorMap[value] ?? "var(--text-secondary)";
  return (
    <span className="mono" style={{ color, fontWeight: 600, fontSize: "0.8rem" }}>
      {value}
    </span>
  );
}
