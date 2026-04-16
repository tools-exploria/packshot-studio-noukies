import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const MODES = [
  {
    title: "Motif / Pattern",
    description: "Appliquez un motif textile sur votre produit. Upload du packshot + pattern, tiling automatique, génération IA, détourage intelligent.",
    href: "/pattern",
    icon: "🎨",
    badge: "5 étapes",
    accent: "border-l-[#b8956a]",
    iconBg: "bg-[#b8956a]/10",
  },
  {
    title: "Couleur / Texture",
    description: "Changez la couleur ou la texture du tissu. Color picker avec presets, upload de texture (velours, jersey, corduroy...).",
    href: "/couleur",
    icon: "🖌️",
    badge: "5 étapes",
    accent: "border-l-[#2d4a9e]",
    iconBg: "bg-[#2d4a9e]/10",
  },
  {
    title: "Broderie",
    description: "Appliquez un motif brodé sur votre produit. Upload packshot + design broderie, choix du placement, rendu réaliste.",
    href: "/broderie",
    icon: "🧵",
    badge: "5 étapes",
    accent: "border-l-[#e8a87c]",
    iconBg: "bg-[#e8a87c]/10",
  },
  {
    title: "Angles alternatifs",
    description: "Générez des vues alternatives de votre packshot validé : face, 3/4, dos, flat-lay, détail macro.",
    href: "/angles",
    icon: "📐",
    badge: "4 étapes",
    accent: "border-l-[#7986cb]",
    iconBg: "bg-[#7986cb]/10",
  },
  {
    title: "Photo d'ambiance",
    description: "Mettez votre produit en situation de vie : bébé, nursery, parent, lifestyle. Templates prédéfinis ou scène personnalisée.",
    href: "/ambiance",
    icon: "📸",
    badge: "4 étapes",
    accent: "border-l-[#a5d6a7]",
    iconBg: "bg-[#a5d6a7]/20",
  },
  {
    title: "Création produit",
    description: "Générez un packshot professionnel à partir d'un croquis, d'une photo smartphone ou de packshots existants. Idéal pour prototyper de nouveaux produits.",
    href: "/creation",
    icon: "🖋️",
    badge: "3 étapes",
    accent: "border-l-[#ce93d8]",
    iconBg: "bg-[#ce93d8]/20",
  },
  {
    title: "Pliage & Disposition",
    description: "Pliez et disposez des vêtements selon un arrangement de référence. Idéal pour les sets, pyjamas et compositions multi-pièces.",
    href: "/pliage",
    icon: "👔",
    badge: "3 étapes",
    accent: "border-l-[#8d6e63]",
    iconBg: "bg-[#8d6e63]/10",
  },
];

export default function Home() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-20">
      {/* Hero */}
      <div className="text-center mb-16 space-y-4">
        <div className="inline-flex items-center gap-2 bg-secondary/80 text-secondary-foreground px-4 py-1.5 rounded-full text-sm font-medium mb-2">
          <span className="w-2 h-2 rounded-full bg-[#a5d6a7] animate-pulse" />
          Plateforme IA
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground">
          Packshot Studio
        </h1>
        <p className="text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed">
          Générez des packshots e-commerce professionnels avec l&apos;intelligence artificielle.
          Choisissez un mode pour commencer.
        </p>
      </div>

      {/* Mode cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {MODES.map((mode) => (
          <a key={mode.href} href={mode.href} className="group">
            <Card className={`h-full noukies-card-hover border-l-4 ${mode.accent} bg-card shadow-sm`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between mb-3">
                  <div className={`w-12 h-12 rounded-xl ${mode.iconBg} flex items-center justify-center text-2xl`}>
                    {mode.icon}
                  </div>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {mode.badge}
                  </Badge>
                </div>
                <CardTitle className="text-lg group-hover:text-primary transition-colors duration-200">
                  {mode.title}
                </CardTitle>
                <CardDescription className="text-sm leading-relaxed">
                  {mode.description}
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                  Commencer
                  <svg className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </CardContent>
            </Card>
          </a>
        ))}
      </div>

      {/* Subtle features row */}
      <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
        {[
          { icon: "⚡", label: "Génération rapide", sub: "Gemini Flash & Pro" },
          { icon: "📐", label: "Multi-résolution", sub: "1K, 2K, 4K" },
          { icon: "📦", label: "Export flexible", sub: "PNG, PDF, détourage" },
        ].map((f) => (
          <div key={f.label} className="flex flex-col items-center gap-1.5 py-4">
            <span className="text-2xl">{f.icon}</span>
            <p className="text-sm font-medium text-foreground">{f.label}</p>
            <p className="text-xs text-muted-foreground">{f.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
