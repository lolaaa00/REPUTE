import { readContract } from "@/lib/genlayer/client";

export interface LoanRecord {
  loan_id: string;
  borrower: string;
  profile_id: string;
  credit_band_snapshot: string;
  collateral: string;
  principal: string;
  issued_at: string;
  due_at: string;
  repaid_amount: string;
  status: string; // ACTIVE | REPAID | DEFAULTED | CLOSED
}

export interface VaultStats {
  total_liquidity: string;
  reserved_liquidity: string;
  total_collateral: string;
  repaid_principal: string;
  available_liquidity: string;
}

export async function getLoan(
  contractAddress: `0x${string}`,
  loanId: bigint
): Promise<LoanRecord> {
  return readContract<LoanRecord>(contractAddress, "get_loan", [loanId]);
}

export async function getActiveLoanId(
  contractAddress: `0x${string}`,
  profileId: bigint
): Promise<bigint> {
  return readContract<bigint>(contractAddress, "get_active_loan_id", [profileId]);
}

export async function getVaultStats(
  contractAddress: `0x${string}`
): Promise<VaultStats> {
  return readContract<VaultStats>(contractAddress, "get_vault_stats", []);
}

export async function computeMaxLoan(
  contractAddress: `0x${string}`,
  profileId: bigint,
  collateralAmount: bigint
): Promise<bigint> {
  return readContract<bigint>(contractAddress, "compute_max_loan", [profileId, collateralAmount]);
}

export async function getLpBalance(
  contractAddress: `0x${string}`,
  provider: `0x${string}`
): Promise<bigint> {
  return readContract<bigint>(contractAddress, "get_lp_balance", [provider]);
}
