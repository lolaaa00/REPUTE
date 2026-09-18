"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useWallet } from "@/lib/wallet/context";
import { NetworkGuard } from "@/components/ui/NetworkGuard";
import { CreditBadge } from "@/components/ui/CreditBadge";
import {
  getOperatorProfileId,
  getProfile,
  getProfileCreditBand,
  getReviewIsFresh,
  BorrowerProfile,
} from "@/lib/contract/profile";
import {
  getActiveLoanId,
  getLoan,
  LoanRecord,
} from "@/lib/contract/vault";
import { getProfileAddress, getVaultAddress } from "@/lib/contract/addresses";
import { formatGen } from "@/lib/genlayer/gen";
import type { CreditBand } from "@/lib/contract/profile";

export default function MePage() {
  const { address } = useWallet();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [band, setBand] = useState<CreditBand>("NONE");
  const [fresh, setFresh] = useState(false);
  const [activeLoan, setActiveLoan] = useState<LoanRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [noProfile, setNoProfile] = useState(false);

  useEffect(() => {
    if (!address) { setLoading(false); return; }
    async function load() {
      try {
        const profAddr = getProfileAddress();
        const vaultAddr = getVaultAddress();
        const pid = await getOperatorProfileId(profAddr, address!);
        const [p, b, f] = await Promise.all([
          getProfile(profAddr, pid),
          getProfileCreditBand(profAddr, pid),
          getReviewIsFresh(profAddr, pid),
        ]);
        setProfile(p);
        setBand(b);
        setFresh(f);

        // Try to load active loan
        try {
          const loanId = await getActiveLoanId(vaultAddr, pid);
          const loan = await getLoan(vaultAddr, loanId);
          if (loan.status === "ACTIVE") setActiveLoan(loan);
        } catch {
          // No active loan
        }
      } catch {
        setNoProfile(true);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [address]);

  return (
    <NetworkGuard>
      <div style={{ maxWidth: 760, margin: "60px auto", padding: "0 24px" }}>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "2rem",
            color: "var(--navy)",
            marginBottom: 32,
          }}
        >
          My Account
        </h1>

        {loading && (
          <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Loading account…
          </p>
        )}

        {noProfile && !loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem", color: "var(--navy)" }}>
              No profile registered yet.
            </p>
            <Link
              href="/borrow"
              style={{
                display: "inline-block",
                marginTop: 20,
                background: "var(--navy)",
                color: "var(--cream)",
                padding: "12px 28px",
                borderRadius: 6,
                textDecoration: "none",
                fontWeight: 600,
              }}
            >
              Create Your Dossier
            </Link>
          </div>
        )}

        {profile && (
          <>
            {/* Profile card */}
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 10,
                padding: "24px",
                background: "var(--surface-raised)",
                marginBottom: 28,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
                <div>
                  <span className="mono" style={{ fontSize: "0.68rem", color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
                    DOSSIER #{profile.profile_id}
                  </span>
                  <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.4rem", color: "var(--navy)", margin: "4px 0 0" }}>
                    {profile.project_name}
                  </h2>
                </div>
                <CreditBadge band={band} />
              </div>

              <div
                className="mono"
                style={{
                  display: "flex",
                  gap: 20,
                  flexWrap: "wrap",
                  fontSize: "0.75rem",
                  color: "var(--text-secondary)",
                  marginBottom: 20,
                  paddingTop: 12,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span>Repayments: {profile.repayment_count?.toString()}</span>
                <span style={{ color: Number(profile.default_count) > 0 ? "var(--gold)" : undefined }}>
                  Defaults: {profile.default_count?.toString()}
                </span>
                <span>Review: {fresh ? <span style={{ color: "var(--emerald)" }}>FRESH</span> : <span style={{ color: "var(--gold)" }}>STALE</span>}</span>
                <span>Status: {profile.status}</span>
              </div>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link
                  href={`/profile/${profile.profile_id}`}
                  style={outlineLink}
                >
                  View Dossier
                </Link>
                {(!fresh || !profile.has_review) && (
                  <Link
                    href={`/profile/${profile.profile_id}/review`}
                    style={navyLink}
                  >
                    Request Review
                  </Link>
                )}
              </div>
            </div>

            {/* Active loan */}
            {activeLoan && (
              <div
                style={{
                  border: "1px solid var(--cobalt)",
                  borderRadius: 10,
                  padding: "24px",
                  background: "#f8faff",
                  marginBottom: 28,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: "var(--navy)", margin: 0 }}>
                    Active Loan #{activeLoan.loan_id}
                  </h3>
                  <span className="mono stamp" style={{ color: "var(--cobalt)", borderColor: "var(--cobalt)" }}>
                    ACTIVE
                  </span>
                </div>

                <div
                  className="mono"
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 12,
                    fontSize: "0.8rem",
                    marginBottom: 20,
                  }}
                >
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Principal</span>
                    <p style={{ margin: "3px 0 0", color: "var(--navy)", fontWeight: 700 }}>
                      {formatGen(BigInt(activeLoan.principal))} GEN
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Collateral</span>
                    <p style={{ margin: "3px 0 0", color: "var(--navy)", fontWeight: 700 }}>
                      {formatGen(BigInt(activeLoan.collateral))} GEN
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Due</span>
                    <p style={{ margin: "3px 0 0", color: "var(--navy)", fontWeight: 700 }}>
                      {new Date(Number(activeLoan.due_at) * 1000).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: "var(--text-secondary)" }}>Band at issue</span>
                    <p style={{ margin: "3px 0 0", color: "var(--navy)", fontWeight: 700 }}>
                      {activeLoan.credit_band_snapshot}
                    </p>
                  </div>
                </div>

                <Link
                  href={`/loan/${activeLoan.loan_id}`}
                  style={navyLink}
                >
                  Repay Loan →
                </Link>
              </div>
            )}

            {!activeLoan && band !== "NONE" && fresh && (
              <div
                style={{
                  border: "1px dashed var(--border)",
                  borderRadius: 8,
                  padding: "32px",
                  textAlign: "center",
                }}
              >
                <p style={{ color: "var(--text-secondary)", margin: "0 0 16px" }}>
                  No active loan. You&apos;re eligible to borrow.
                </p>
                <Link href="/borrow" style={navyLink}>Borrow Now →</Link>
              </div>
            )}
          </>
        )}
      </div>
    </NetworkGuard>
  );
}

const outlineLink: React.CSSProperties = {
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "9px 20px",
  textDecoration: "none",
  fontSize: "0.875rem",
  fontWeight: 500,
  color: "var(--navy)",
};

const navyLink: React.CSSProperties = {
  background: "var(--navy)",
  color: "var(--cream)",
  borderRadius: 6,
  padding: "9px 20px",
  textDecoration: "none",
  fontSize: "0.875rem",
  fontWeight: 600,
  display: "inline-block",
};
