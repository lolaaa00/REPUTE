"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getNextProfileId, getProfile, getProfileCreditBand, BorrowerProfile } from "@/lib/contract/profile";
import { getProfileAddress } from "@/lib/contract/addresses";
import { CreditBadge } from "@/components/ui/CreditBadge";
import type { CreditBand } from "@/lib/contract/profile";

interface ProfileWithBand {
  profile: BorrowerProfile;
  band: CreditBand;
}

export default function ProjectsPage() {
  const [profiles, setProfiles] = useState<ProfileWithBand[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const addr = getProfileAddress();
        const nextId = await getNextProfileId(addr);
        const ids = [];
        for (let i = 1; i < Number(nextId); i++) {
          ids.push(BigInt(i));
        }
        const results = await Promise.all(
          ids.map(async id => {
            const profile = await getProfile(addr, id).catch(() => null);
            if (!profile) return null;
            const band = profile.has_review
              ? await getProfileCreditBand(addr, id).catch(() => "NONE" as CreditBand)
              : ("NONE" as CreditBand);
            return { profile, band };
          })
        );
        setProfiles(results.filter(Boolean) as ProfileWithBand[]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 40 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: "2rem", color: "var(--navy)" }}>
          Projects
        </h1>
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
          Register Project
        </Link>
      </div>

      {loading && (
        <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
          Loading profiles…
        </p>
      )}
      {error && (
        <p style={{ color: "var(--gold)" }}>Error: {error}</p>
      )}

      {!loading && !error && profiles.length === 0 && (
        <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-secondary)" }}>
          <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: "1.3rem" }}>
            No projects registered yet.
          </p>
          <p style={{ marginTop: 8, fontSize: "0.9rem" }}>
            Be the first to create a credit dossier.
          </p>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 24 }}>
        {profiles.map(({ profile, band }) => (
          <ProfileCard key={profile.profile_id} profile={profile} band={band} />
        ))}
      </div>
    </div>
  );
}

function ProfileCard({ profile, band }: { profile: BorrowerProfile; band: CreditBand }) {

  return (
    <Link
      href={`/profile/${profile.profile_id}`}
      style={{ textDecoration: "none", display: "block" }}
    >
      <div
        style={{
          border: "1px solid var(--border)",
          borderRadius: 10,
          padding: "24px",
          background: "var(--surface-raised)",
          cursor: "pointer",
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
        onMouseOver={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 20px rgba(19,32,51,0.08)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--navy)";
        }}
        onMouseOut={e => {
          (e.currentTarget as HTMLElement).style.boxShadow = "none";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--border)";
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <h3
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "1.15rem",
              color: "var(--navy)",
              margin: 0,
            }}
          >
            {profile.project_name}
          </h3>
          {profile.has_review && <CreditBadge band={band} />}
        </div>

        <p
          style={{
            fontSize: "0.85rem",
            color: "var(--text-secondary)",
            lineHeight: 1.6,
            margin: "0 0 16px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {profile.description}
        </p>

        <div
          className="mono"
          style={{
            display: "flex",
            gap: 16,
            fontSize: "0.72rem",
            color: "var(--text-secondary)",
            flexWrap: "wrap",
          }}
        >
          <span>#{profile.profile_id}</span>
          <span>{profile.sources?.length ?? 0} sources</span>
          <span>{profile.repayment_count?.toString() ?? "0"} repayments</span>
          {Number(profile.default_count) > 0 && (
            <span style={{ color: "var(--gold)" }}>
              {profile.default_count?.toString()} defaults
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
