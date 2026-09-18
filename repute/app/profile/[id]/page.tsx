"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  getProfile,
  getReview,
  getProfileCreditBand,
  getReviewIsFresh,
  parsedEvidence,
  BorrowerProfile,
  OperationalReview,
} from "@/lib/contract/profile";
import { getProfileAddress } from "@/lib/contract/addresses";
import { CreditBadge, DimensionBand } from "@/components/ui/CreditBadge";
import { explorerAddress } from "@/lib/genlayer/network";
import type { CreditBand } from "@/lib/contract/profile";

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [review, setReview] = useState<OperationalReview | null>(null);
  const [band, setBand] = useState<CreditBand>("NONE");
  const [fresh, setFresh] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const addr = getProfileAddress();
        const pid = BigInt(id);
        const p = await getProfile(addr, pid);
        setProfile(p);

        const [b, f] = await Promise.all([
          getProfileCreditBand(addr, pid),
          getReviewIsFresh(addr, pid),
        ]);
        setBand(b);
        setFresh(f);

        if (p.has_review) {
          const r = await getReview(addr, BigInt(p.latest_review_id));
          setReview(r);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Profile not found");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "80px auto", padding: "0 24px" }}>
        <p className="mono" style={{ color: "var(--text-secondary)" }}>Loading dossier…</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div style={{ maxWidth: 800, margin: "80px auto", padding: "0 24px" }}>
        <p style={{ color: "var(--gold)" }}>{error ?? "Profile not found"}</p>
      </div>
    );
  }

  const evidence = review ? parsedEvidence(review.evidence_json) : [];

  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 24px" }}>
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", letterSpacing: "0.1em" }}>
          DOSSIER #{profile.profile_id}
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 16, marginBottom: 8 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "2.2rem", color: "var(--navy)", margin: 0 }}>
          {profile.project_name}
        </h1>
        <CreditBadge band={band} />
      </div>

      <p style={{ color: "var(--text-secondary)", fontSize: "0.95rem", lineHeight: 1.6, marginBottom: 32 }}>
        {profile.description}
      </p>

      {/* Meta row */}
      <div
        className="mono"
        style={{
          display: "flex",
          gap: 28,
          flexWrap: "wrap",
          fontSize: "0.75rem",
          color: "var(--text-secondary)",
          borderTop: "1px solid var(--border)",
          borderBottom: "1px solid var(--border)",
          padding: "14px 0",
          marginBottom: 40,
        }}
      >
        <span>
          Operator:{" "}
          <a
            href={explorerAddress(profile.operator)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--cobalt)", textDecoration: "none" }}
          >
            {profile.operator.slice(0, 10)}…
          </a>
        </span>
        <span>Repayments: {profile.repayment_count?.toString()}</span>
        <span style={{ color: Number(profile.default_count) > 0 ? "var(--gold)" : undefined }}>
          Defaults: {profile.default_count?.toString()}
        </span>
        <span>Status: {profile.status}</span>
        <span>Review: {fresh ? <span style={{ color: "var(--emerald)" }}>FRESH</span> : <span style={{ color: "var(--gold)" }}>STALE</span>}</span>
      </div>

      {/* Sources */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: "var(--navy)", marginBottom: 16 }}>
          Evidence Sources
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {profile.sources?.map((src, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "10px 16px",
              }}
            >
              <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-secondary)", minWidth: 20 }}>
                {i + 1}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600, color: "var(--navy)" }}>{src.label}</p>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ fontSize: "0.75rem", color: "var(--cobalt)", textDecoration: "none" }}
                  className="mono"
                >
                  {src.url}
                </a>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Review */}
      {review ? (
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.2rem", color: "var(--navy)", margin: 0 }}>
              Operational Review
            </h2>
            <span className="mono" style={{ fontSize: "0.7rem", color: "var(--text-secondary)" }}>
              Review #{review.review_id}
            </span>
          </div>

          {/* Dimension grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Maintenance Activity", val: review.maintenance },
              { label: "Ownership Attribution", val: review.attribution },
              { label: "Public Continuity", val: review.continuity },
              { label: "Transparency", val: review.transparency },
            ].map(d => (
              <div
                key={d.label}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  padding: "14px 18px",
                  background: "var(--surface)",
                }}
              >
                <p style={{ margin: "0 0 6px", fontSize: "0.78rem", color: "var(--text-secondary)", fontWeight: 500 }}>
                  {d.label}
                </p>
                <DimensionBand value={d.val} />
              </div>
            ))}
          </div>

          {/* Reason */}
          {review.reason && (
            <div
              style={{
                background: "var(--cream)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                padding: "16px 20px",
                marginBottom: 24,
              }}
            >
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--charcoal)", lineHeight: 1.65 }}>
                {review.reason}
              </p>
            </div>
          )}

          {/* Evidence excerpts */}
          {evidence.length > 0 && (
            <div>
              <h3 style={{ fontSize: "0.85rem", color: "var(--text-secondary)", marginBottom: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Evidence Excerpts
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {evidence.map((ev, i) => (
                  <div
                    key={i}
                    style={{
                      borderLeft: "3px solid var(--cobalt)",
                      paddingLeft: 14,
                      background: "var(--surface)",
                      borderRadius: "0 5px 5px 0",
                      padding: "10px 10px 10px 14px",
                    }}
                  >
                    <div style={{ display: "flex", gap: 10, marginBottom: 5 }}>
                      <span className="mono" style={{ fontSize: "0.68rem", color: "var(--text-secondary)" }}>
                        Source {ev.source_id}
                      </span>
                      <DimensionBand value={ev.dimension?.toUpperCase()} />
                    </div>
                    <p
                      style={{ margin: 0, fontSize: "0.82rem", color: "var(--charcoal)", fontStyle: "italic", lineHeight: 1.5 }}
                    >
                      "{ev.excerpt}"
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section style={{ marginBottom: 48 }}>
          <div
            style={{
              border: "1px dashed var(--border)",
              borderRadius: 8,
              padding: "40px 24px",
              textAlign: "center",
            }}
          >
            <p style={{ color: "var(--text-secondary)", margin: 0 }}>No operational review yet.</p>
            <Link
              href={`/profile/${id}/review`}
              style={{
                display: "inline-block",
                marginTop: 16,
                background: "var(--navy)",
                color: "var(--cream)",
                padding: "10px 24px",
                borderRadius: 6,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.875rem",
              }}
            >
              Request Review
            </Link>
          </div>
        </section>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        {profile.has_review && (
          <Link
            href={`/profile/${id}/review`}
            style={{
              border: "1px solid var(--border)",
              color: "var(--navy)",
              padding: "10px 22px",
              borderRadius: 6,
              textDecoration: "none",
              fontWeight: 500,
              fontSize: "0.875rem",
            }}
          >
            Refresh Review
          </Link>
        )}
        <Link
          href="/borrow"
          style={{
            background: "var(--navy)",
            color: "var(--cream)",
            padding: "10px 22px",
            borderRadius: 6,
            textDecoration: "none",
            fontWeight: 600,
            fontSize: "0.875rem",
          }}
        >
          Borrow Against This Profile
        </Link>
      </div>
    </div>
  );
}
