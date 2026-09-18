"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@/lib/wallet/context";
import { useTx } from "@/lib/wallet/useTx";
import { TxPanel } from "@/components/ui/TxPanel";
import { NetworkGuard } from "@/components/ui/NetworkGuard";
import { CreditBadge } from "@/components/ui/CreditBadge";
import {
  getProfileAddress,
  getVaultAddress,
} from "@/lib/contract/addresses";
import {
  getOperatorProfileId,
  getProfile,
  getProfileCreditBand,
  getReviewIsFresh,
  BorrowerProfile,
} from "@/lib/contract/profile";
import { computeMaxLoan } from "@/lib/contract/vault";
import { parseGen, formatGen } from "@/lib/genlayer/gen";
import { CreateProfileSchema } from "@/lib/validation/schemas";
import type { CreditBand } from "@/lib/contract/profile";

type Step = "CREATE_PROFILE" | "REVIEW_NEEDED" | "READY_TO_BORROW";

export default function BorrowPage() {
  const router = useRouter();
  const { address } = useWallet();
  const [profile, setProfile] = useState<BorrowerProfile | null>(null);
  const [band, setBand] = useState<CreditBand>("NONE");
  const [fresh, setFresh] = useState(false);
  const [step, setStep] = useState<Step | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const { tx: createTx, send: sendCreate, reset: resetCreate } = useTx(address);
  const { tx: borrowTx, send: sendBorrow, reset: resetBorrow } = useTx(address, {
    onSuccess: (hash) => {
      router.push(`/me`);
    },
  });

  // Profile form state
  const [projectName, setProjectName] = useState("");
  const [description, setDescription] = useState("");
  const [sources, setSources] = useState([
    { url: "", label: "" },
    { url: "", label: "" },
  ]);

  // Borrow form state
  const [collateralStr, setCollateralStr] = useState("");
  const [principalStr, setPrincipalStr] = useState("");
  const [maxLoanWei, setMaxLoanWei] = useState<bigint>(0n);
  const [formError, setFormError] = useState<string | null>(null);

  // Load existing profile
  useEffect(() => {
    if (!address) { setLoadingProfile(false); return; }
    async function load() {
      try {
        const profAddr = getProfileAddress();
        const pid = await getOperatorProfileId(profAddr, address!);
        const p = await getProfile(profAddr, pid);
        setProfile(p);
        const [b, f] = await Promise.all([
          getProfileCreditBand(profAddr, pid),
          getReviewIsFresh(profAddr, pid),
        ]);
        setBand(b);
        setFresh(f);
        if (!p.has_review || !f) {
          setStep("REVIEW_NEEDED");
        } else {
          setStep("READY_TO_BORROW");
        }
      } catch {
        setStep("CREATE_PROFILE");
      } finally {
        setLoadingProfile(false);
      }
    }
    load();
  }, [address]);

  // Compute max loan when collateral changes
  useEffect(() => {
    if (!address || !profile || !collateralStr) { setMaxLoanWei(0n); return; }
    try {
      const collateral = parseGen(collateralStr);
      computeMaxLoan(getVaultAddress(), BigInt(profile.profile_id), collateral)
        .then(setMaxLoanWei)
        .catch(() => setMaxLoanWei(0n));
    } catch {
      setMaxLoanWei(0n);
    }
  }, [collateralStr, address, profile]);

  async function handleCreateProfile() {
    setFormError(null);
    const parsed = CreateProfileSchema.safeParse({
      project_name: projectName,
      description,
      sources: sources.filter(s => s.url),
    });
    if (!parsed.success) {
      setFormError(parsed.error.errors[0]?.message ?? "Validation error");
      return;
    }
    await sendCreate(async (client, setStatus) => {
      setStatus("SUBMITTED");
      const profAddr = getProfileAddress();
      const hash = await client.writeContract({
        address: profAddr,
        functionName: "create_profile",
        args: [
          projectName,
          description,
          sources.filter(s => s.url).map(s => s.url),
          sources.filter(s => s.url).map(s => s.label),
        ],
        value: 0n,
      });
      setStatus("CONSENSUS_RUNNING");
      const receipt = await client.waitForTransactionReceipt({ hash });
      setStatus("FINALIZED");
      return { hash, result: receipt };
    });
  }

  async function handleBorrow() {
    setFormError(null);
    if (!profile) return;
    try {
      const collateral = parseGen(collateralStr);
      const principal = parseGen(principalStr);
      if (principal > maxLoanWei) {
        setFormError(`Principal exceeds max allowed: ${formatGen(maxLoanWei)} GEN`);
        return;
      }
      await sendBorrow(async (client, setStatus) => {
        setStatus("SUBMITTED");
        const vaultAddr = getVaultAddress();
        const hash = await client.writeContract({
          address: vaultAddr,
          functionName: "borrow",
          args: [BigInt(profile.profile_id), principal],
          value: collateral,
        });
        setStatus("CONSENSUS_RUNNING");
        const receipt = await client.waitForTransactionReceipt({ hash });
        setStatus("FINALIZED");
        return { hash, result: receipt };
      });
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Invalid amount");
    }
  }

  return (
    <NetworkGuard>
      <div style={{ maxWidth: 680, margin: "60px auto", padding: "0 24px" }}>
        <h1
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "2rem",
            color: "var(--navy)",
            marginBottom: 8,
          }}
        >
          Borrow
        </h1>
        <p style={{ color: "var(--text-secondary)", marginBottom: 40 }}>
          Register your project dossier, get it reviewed, then borrow above your collateral.
        </p>

        {loadingProfile && (
          <p className="mono" style={{ color: "var(--text-secondary)", fontSize: "0.85rem" }}>
            Checking profile…
          </p>
        )}

        {/* STEP: CREATE PROFILE */}
        {step === "CREATE_PROFILE" && (
          <div>
            <StepHeading n={1} label="Register your project dossier" />
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 28 }}>
              Provide 2–4 public HTTPS sources. They will be fetched by validators.
            </p>

            <Label>Project name</Label>
            <input
              style={inputStyle}
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
              placeholder="e.g. OpenMetrics"
              maxLength={128}
              aria-label="Project name"
            />

            <Label>Description</Label>
            <textarea
              style={{ ...inputStyle, height: 90, resize: "vertical" }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What does this project do?"
              maxLength={512}
              aria-label="Project description"
            />

            <Label>Sources (2–4, HTTPS, independent domains)</Label>
            {sources.map((src, i) => (
              <div key={i} style={{ display: "flex", gap: 10, marginBottom: 10 }}>
                <input
                  style={{ ...inputStyle, flex: 2 }}
                  value={src.url}
                  onChange={e => setSources(s => s.map((x, j) => j === i ? { ...x, url: e.target.value } : x))}
                  placeholder="https://…"
                  aria-label={`Source ${i + 1} URL`}
                />
                <input
                  style={{ ...inputStyle, flex: 1 }}
                  value={src.label}
                  onChange={e => setSources(s => s.map((x, j) => j === i ? { ...x, label: e.target.value } : x))}
                  placeholder="Label"
                  aria-label={`Source ${i + 1} label`}
                />
              </div>
            ))}
            {sources.length < 4 && (
              <button
                onClick={() => setSources(s => [...s, { url: "", label: "" }])}
                style={ghostBtn}
                type="button"
              >
                + Add source
              </button>
            )}

            {formError && <p style={{ color: "var(--gold)", marginTop: 10, fontSize: "0.85rem" }}>{formError}</p>}

            <button
              onClick={handleCreateProfile}
              disabled={createTx.status !== "IDLE"}
              style={primaryBtn}
            >
              Create Dossier
            </button>
            <TxPanel tx={createTx} onDismiss={resetCreate} />
          </div>
        )}

        {/* STEP: REVIEW NEEDED */}
        {step === "REVIEW_NEEDED" && profile && (
          <div>
            <StepHeading n={2} label="Get your project reviewed" />
            <p style={{ color: "var(--text-secondary)", fontSize: "0.875rem", marginBottom: 24 }}>
              {!profile.has_review
                ? "Your dossier needs an operational review before you can borrow."
                : "Your review has expired. A new review is required before borrowing."}
            </p>
            <div
              style={{
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "20px",
                background: "var(--surface)",
                marginBottom: 28,
              }}
            >
              <p style={{ margin: 0, fontFamily: "'DM Serif Display', serif", fontSize: "1.1rem", color: "var(--navy)" }}>
                {profile.project_name}
              </p>
              <p className="mono" style={{ margin: "6px 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                Profile #{profile.profile_id} · {profile.sources?.length} sources
              </p>
            </div>
            <a
              href={`/profile/${profile.profile_id}/review`}
              style={primaryBtn}
            >
              Request Operational Review →
            </a>
          </div>
        )}

        {/* STEP: READY TO BORROW */}
        {step === "READY_TO_BORROW" && profile && (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                marginBottom: 28,
                padding: "16px 20px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: 8,
              }}
            >
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontFamily: "'DM Serif Display', serif", color: "var(--navy)" }}>
                  {profile.project_name}
                </p>
                <p className="mono" style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--text-secondary)" }}>
                  Profile #{profile.profile_id} · {profile.repayment_count?.toString()} repayments
                </p>
              </div>
              <CreditBadge band={band} />
            </div>

            <StepHeading n={3} label="Request a loan" />

            <Label>Collateral (GEN)</Label>
            <input
              style={inputStyle}
              value={collateralStr}
              onChange={e => setCollateralStr(e.target.value)}
              placeholder="e.g. 2.0"
              aria-label="Collateral amount in GEN"
            />
            {maxLoanWei > 0n && (
              <p className="mono" style={{ fontSize: "0.75rem", color: "var(--emerald)", marginTop: 4 }}>
                Max loan: {formatGen(maxLoanWei)} GEN
              </p>
            )}

            <Label>Principal to borrow (GEN)</Label>
            <input
              style={inputStyle}
              value={principalStr}
              onChange={e => setPrincipalStr(e.target.value)}
              placeholder="e.g. 2.5"
              aria-label="Principal amount in GEN"
            />

            {formError && <p style={{ color: "var(--gold)", marginTop: 8, fontSize: "0.85rem" }}>{formError}</p>}

            <button
              onClick={handleBorrow}
              disabled={borrowTx.status !== "IDLE"}
              style={primaryBtn}
            >
              Post Collateral &amp; Borrow
            </button>
            <TxPanel tx={borrowTx} onDismiss={resetBorrow} />
          </div>
        )}
      </div>
    </NetworkGuard>
  );
}

function StepHeading({ n, label }: { n: number; label: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <span className="mono" style={{ fontSize: "0.68rem", color: "var(--cobalt)", letterSpacing: "0.12em", textTransform: "uppercase" }}>
        Step {n}
      </span>
      <h2
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: "1.4rem",
          color: "var(--navy)",
          margin: "6px 0 0",
        }}
      >
        {label}
      </h2>
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: "0.8rem",
        fontWeight: 600,
        color: "var(--charcoal)",
        marginBottom: 6,
        marginTop: 16,
      }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--surface-raised)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "10px 14px",
  fontSize: "0.9rem",
  color: "var(--navy)",
  fontFamily: "inherit",
  outline: "none",
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  display: "inline-block",
  marginTop: 20,
  background: "var(--navy)",
  color: "var(--cream)",
  border: "none",
  borderRadius: 7,
  padding: "14px 32px",
  fontSize: "0.95rem",
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  textDecoration: "none",
  width: "100%",
  textAlign: "center",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  border: "1px solid var(--border)",
  borderRadius: 5,
  padding: "7px 14px",
  fontSize: "0.82rem",
  cursor: "pointer",
  color: "var(--text-secondary)",
  fontFamily: "inherit",
  marginTop: 4,
};
