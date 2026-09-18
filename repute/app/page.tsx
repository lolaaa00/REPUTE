import Link from "next/link";

export default function Home() {
  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px" }}>
      {/* Hero */}
      <section
        style={{
          paddingTop: 100,
          paddingBottom: 80,
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 720 }}>
          <p
            className="mono"
            style={{
              fontSize: "0.7rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              color: "var(--text-secondary)",
              marginBottom: 20,
            }}
          >
            GenLayer Studionet · Chain 61999
          </p>

          <h1
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: "clamp(2.4rem, 6vw, 4rem)",
              color: "var(--navy)",
              lineHeight: 1.1,
              letterSpacing: "-0.02em",
              margin: "0 0 28px",
            }}
          >
            Credit you earn.
            <br />
            <em>Proved on-chain.</em>
          </h1>

          <p
            style={{
              fontSize: "1.1rem",
              color: "var(--text-secondary)",
              lineHeight: 1.7,
              maxWidth: 520,
              marginBottom: 40,
            }}
          >
            Repute gives public software operators access to under-collateralized
            GEN credit — only after GenLayer validators independently verify your
            operational track record. No underwriter. No favoritism.
          </p>

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Link
              href="/borrow"
              style={{
                background: "var(--navy)",
                color: "var(--cream)",
                padding: "14px 32px",
                borderRadius: 7,
                textDecoration: "none",
                fontWeight: 700,
                fontSize: "0.95rem",
              }}
            >
              Apply for Credit
            </Link>
            <Link
              href="/vault"
              style={{
                background: "transparent",
                border: "1px solid var(--navy)",
                color: "var(--navy)",
                padding: "14px 28px",
                borderRadius: 7,
                textDecoration: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
              }}
            >
              Provide Liquidity
            </Link>
            <Link
              href="/projects"
              style={{
                background: "transparent",
                border: "1px solid var(--border)",
                color: "var(--text-secondary)",
                padding: "14px 28px",
                borderRadius: 7,
                textDecoration: "none",
                fontWeight: 500,
                fontSize: "0.95rem",
              }}
            >
              Browse Projects
            </Link>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ paddingTop: 72, paddingBottom: 72 }}>
        <h2
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "1.8rem",
            color: "var(--navy)",
            marginBottom: 48,
          }}
        >
          How it works
        </h2>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
            gap: 32,
          }}
        >
          {STEPS.map((step, i) => (
            <div key={step.title}>
              <span
                className="mono"
                style={{
                  fontSize: "0.65rem",
                  letterSpacing: "0.12em",
                  color: "var(--text-secondary)",
                  textTransform: "uppercase",
                }}
              >
                Step {i + 1}
              </span>
              <h3
                style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: "1.15rem",
                  color: "var(--navy)",
                  margin: "8px 0 10px",
                }}
              >
                {step.title}
              </h3>
              <p style={{ fontSize: "0.9rem", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                {step.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Band table */}
      <section
        style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 64,
          paddingBottom: 80,
        }}
      >
        <h2
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: "1.8rem",
            color: "var(--navy)",
            marginBottom: 32,
          }}
        >
          Credit bands
        </h2>
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "0.82rem",
          }}
        >
          <thead>
            <tr style={{ borderBottom: "2px solid var(--navy)" }}>
              {["Band", "Multiplier", "Requirements"].map(h => (
                <th
                  key={h}
                  style={{
                    textAlign: "left",
                    padding: "8px 16px 8px 0",
                    color: "var(--text-secondary)",
                    fontWeight: 600,
                    letterSpacing: "0.05em",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BANDS.map(row => (
              <tr
                key={row.band}
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <td style={{ padding: "12px 16px 12px 0", color: row.color, fontWeight: 700 }}>
                  {row.band}
                </td>
                <td style={{ padding: "12px 16px 12px 0", color: "var(--navy)" }}>
                  {row.mult}
                </td>
                <td
                  style={{
                    padding: "12px 16px 12px 0",
                    color: "var(--text-secondary)",
                    fontFamily: "Manrope, sans-serif",
                    fontSize: "0.83rem",
                  }}
                >
                  {row.req}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p
          style={{
            marginTop: 16,
            fontSize: "0.8rem",
            color: "var(--text-secondary)",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          * All credit band decisions are computed deterministically on-chain. No LLM controls credit amounts.
        </p>
      </section>
    </div>
  );
}

const STEPS = [
  {
    title: "Create your dossier",
    desc: "Register your project with 2–4 public sources. The definition is sealed and hashed on GenLayer.",
  },
  {
    title: "Validators inspect your evidence",
    desc: "GenLayer validators independently fetch your sources and evaluate maintenance, attribution, continuity, and transparency.",
  },
  {
    title: "Band is derived deterministically",
    desc: "Your credit band — STARTER, ESTABLISHED, or TRUSTED — is computed from consensus results and on-chain repayment history.",
  },
  {
    title: "Borrow above your collateral",
    desc: "Post partial collateral and request principal up to your band multiplier. Repay to build your history.",
  },
];

const BANDS = [
  {
    band: "NONE",
    color: "var(--text-secondary)",
    mult: "0×",
    req: "Any attribution UNRESOLVED/WEAK, or stale review",
  },
  {
    band: "STARTER",
    color: "var(--gold)",
    mult: "1.25×",
    req: "Moderate operational evidence, no repayment history required",
  },
  {
    band: "ESTABLISHED",
    color: "var(--cobalt)",
    mult: "1.75×",
    req: "Moderate evidence + at least 2 repaid loans + no defaults",
  },
  {
    band: "TRUSTED",
    color: "var(--emerald)",
    mult: "2.50×",
    req: "All dimensions STRONG/MODERATE + 5+ repaid loans + no defaults + fresh review",
  },
];
