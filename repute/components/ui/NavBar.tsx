"use client";

import Link from "next/link";
import { useWallet } from "@/lib/wallet/context";
import { WalletButton } from "@/components/wallet/WalletButton";

export function NavBar() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--cream)",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div
        style={{
          maxWidth: 1200,
          margin: "0 auto",
          padding: "0 24px",
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            textDecoration: "none",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
          aria-label="Repute home"
        >
          <span
            style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: "1.4rem",
              color: "var(--navy)",
              letterSpacing: "-0.02em",
            }}
          >
            Repute
          </span>
          <span
            className="mono"
            style={{
              fontSize: "0.65rem",
              color: "var(--text-secondary)",
              letterSpacing: "0.08em",
              marginTop: 2,
              textTransform: "uppercase",
            }}
          >
            Studionet
          </span>
        </Link>

        {/* Nav links */}
        <nav
          style={{ display: "flex", alignItems: "center", gap: 28 }}
          aria-label="Main navigation"
        >
          <NavLink href="/projects">Projects</NavLink>
          <NavLink href="/borrow">Borrow</NavLink>
          <NavLink href="/vault">Vault</NavLink>
          <NavLink href="/me">My Account</NavLink>
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}

function NavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        fontSize: "0.875rem",
        fontWeight: 500,
        color: "var(--text-secondary)",
        transition: "color 0.15s",
      }}
      onMouseOver={e => ((e.target as HTMLElement).style.color = "var(--navy)")}
      onMouseOut={e =>
        ((e.target as HTMLElement).style.color = "var(--text-secondary)")
      }
    >
      {children}
    </Link>
  );
}
