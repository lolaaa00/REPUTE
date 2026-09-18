/**
 * BigInt-safe GEN parser/formatter utilities.
 * GEN uses 18 decimals like ETH/wei.
 */

export const GEN_DECIMALS = 18n;
export const GEN_UNIT = 10n ** GEN_DECIMALS; // 1 GEN in wei

/** Parse a human-readable GEN string to wei BigInt */
export function parseGen(genStr: string): bigint {
  const trimmed = genStr.trim();
  const dotIndex = trimmed.indexOf(".");
  if (dotIndex === -1) {
    return BigInt(trimmed) * GEN_UNIT;
  }
  const whole = trimmed.slice(0, dotIndex);
  const fracPart = trimmed.slice(dotIndex + 1).padEnd(18, "0").slice(0, 18);
  return BigInt(whole) * GEN_UNIT + BigInt(fracPart);
}

/** Format wei BigInt to human-readable GEN string (up to 6 decimal places) */
export function formatGen(wei: bigint, decimals = 6): string {
  if (wei < 0n) return "-" + formatGen(-wei, decimals);
  const whole = wei / GEN_UNIT;
  const frac = wei % GEN_UNIT;
  if (frac === 0n) return whole.toString();
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals).replace(/0+$/, "");
  return fracStr ? `${whole}.${fracStr}` : whole.toString();
}

/** Format with fixed decimal places */
export function formatGenFixed(wei: bigint, decimals = 4): string {
  const whole = wei / GEN_UNIT;
  const frac = wei % GEN_UNIT;
  const fracStr = frac.toString().padStart(18, "0").slice(0, decimals);
  return `${whole}.${fracStr}`;
}
