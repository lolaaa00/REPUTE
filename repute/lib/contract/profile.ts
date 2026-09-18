import { readContract } from "@/lib/genlayer/client";

export interface Source {
  url: string;
  label: string;
}

export interface BorrowerProfile {
  profile_id: string;
  operator: string;
  project_name: string;
  description: string;
  sources: Source[];
  created_at: string;
  sealed_hash: string;
  sealed: boolean;
  latest_review_id: string;
  has_review: boolean;
  repayment_count: string;
  default_count: string;
  status: string;
}

export interface OperationalReview {
  review_id: string;
  profile_id: string;
  maintenance: string;
  attribution: string;
  continuity: string;
  transparency: string;
  evidence_json: string;
  reason: string;
  reviewed_at: string;
  credit_band: string;
}

export type CreditBand = "NONE" | "STARTER" | "ESTABLISHED" | "TRUSTED";
export type DimensionBand = "STRONG" | "MODERATE" | "WEAK" | "UNRESOLVED";

export async function getProfile(
  contractAddress: `0x${string}`,
  profileId: bigint
): Promise<BorrowerProfile> {
  return readContract<BorrowerProfile>(contractAddress, "get_profile", [profileId]);
}

export async function getReview(
  contractAddress: `0x${string}`,
  reviewId: bigint
): Promise<OperationalReview> {
  return readContract<OperationalReview>(contractAddress, "get_review", [reviewId]);
}

export async function getOperatorProfileId(
  contractAddress: `0x${string}`,
  operator: `0x${string}`
): Promise<bigint> {
  return readContract<bigint>(contractAddress, "get_operator_profile_id", [operator]);
}

export async function getProfileCreditBand(
  contractAddress: `0x${string}`,
  profileId: bigint
): Promise<CreditBand> {
  return readContract<CreditBand>(contractAddress, "profile_credit_band", [profileId]);
}

export async function getReviewIsFresh(
  contractAddress: `0x${string}`,
  profileId: bigint
): Promise<boolean> {
  return readContract<boolean>(contractAddress, "review_is_fresh", [profileId]);
}

export async function getNextProfileId(
  contractAddress: `0x${string}`
): Promise<bigint> {
  return readContract<bigint>(contractAddress, "get_next_profile_id", []);
}

export function parsedEvidence(evidenceJson: string) {
  try {
    return JSON.parse(evidenceJson) as Array<{
      source_id: number;
      dimension: string;
      excerpt: string;
    }>;
  } catch {
    return [];
  }
}
