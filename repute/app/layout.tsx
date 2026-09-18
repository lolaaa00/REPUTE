import type { Metadata } from "next";
import "./globals.css";
import { WalletProvider } from "@/lib/wallet/context";
import { NavBar } from "@/components/ui/NavBar";

export const metadata: Metadata = {
  title: "Repute — Under-Collateralized Credit",
  description:
    "Studionet credit infrastructure. Borrow above your collateral when GenLayer independently verifies your operational track record.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <WalletProvider>
          <NavBar />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
