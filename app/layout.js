import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata = {
  title: "Noukies — Packshot Studio",
  description: "Plateforme IA de génération de packshots produit pour Noukies",
};

const NAV_LINKS = [
  { href: "/pattern", label: "Motif", icon: "🎨" },
  { href: "/couleur", label: "Couleur", icon: "🖌️" },
  { href: "/ambiance", label: "Ambiance", icon: "📸" },
];

export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={outfit.className}>
        <div className="min-h-screen bg-background">
          {/* ── Header ──────────────────────────────── */}
          <header className="border-b border-border/60 bg-card/90 backdrop-blur-md sticky top-0 z-50">
            <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
              {/* Logo */}
              <a href="/" className="flex items-center gap-3 group">
                <span
                  className="text-2xl font-bold tracking-tight"
                  style={{ color: "#2d4a9e", fontFamily: "inherit" }}
                >
                  noukies
                </span>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-secondary px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-noukies-caramel" />
                  Packshot Studio
                </span>
              </a>

              {/* Navigation */}
              <nav className="flex items-center gap-1">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/80 transition-all duration-200"
                  >
                    <span className="text-base">{link.icon}</span>
                    <span className="hidden sm:inline">{link.label}</span>
                  </a>
                ))}
              </nav>
            </div>
          </header>

          {/* ── Main content ────────────────────────── */}
          <main>{children}</main>

          {/* ── Footer ──────────────────────────────── */}
          <footer className="border-t border-border/40 mt-16">
            <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                © {new Date().getFullYear()} Noukies — Packshot Studio
              </p>
              <p className="text-xs text-muted-foreground/60">
                Propulsé par Google Gemini
              </p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
