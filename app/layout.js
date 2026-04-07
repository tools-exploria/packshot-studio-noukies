import { Outfit } from "next/font/google";
import "./globals.css";
import { AppShell } from "@/components/AppShell";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata = {
  title: "Noukies — Packshot Studio",
  description: "Plateforme IA de génération de packshots produit pour Noukies",
};


export default function RootLayout({ children }) {
  return (
    <html lang="fr">
      <body className={outfit.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
