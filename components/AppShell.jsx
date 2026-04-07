"use client";

import { usePathname } from "next/navigation";
import { NavLinks } from "@/components/NavLinks";

export function AppShell({ children }) {
  const pathname = usePathname();

  // Login page renders without header/footer
  if (pathname === "/login") {
    return children;
  }

  return (
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

          {/* Navigation — active state managed by NavLinks client component */}
          <NavLinks />
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
            Propulse par Google Gemini
          </p>
        </div>
      </footer>
    </div>
  );
}
