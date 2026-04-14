"use client";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
    { href: "/pattern", label: "Motif", icon: "🎨" },
    { href: "/couleur", label: "Couleur", icon: "🖌️" },
    { href: "/broderie", label: "Broderie", icon: "🧵" },
    { href: "/angles", label: "Angles", icon: "📐" },
    { href: "/ambiance", label: "Ambiance", icon: "📸" },
    { href: "/3d-produit", label: "3D Produit", icon: "🧸" },
    { href: "/pliage", label: "Pliage", icon: "👔" },
    { href: "/labo", label: "Labo", icon: "🧪" },
];

export function NavLinks() {
    const pathname = usePathname();

    return (
        <nav className="flex items-center gap-1">
            {NAV_LINKS.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
                return (
                    <a
                        key={link.href}
                        href={link.href}
                        className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200
                            ${isActive
                                ? "text-primary bg-primary/8 font-semibold"
                                : "text-muted-foreground hover:text-foreground hover:bg-accent/80"
                            }`}
                    >
                        <span className="text-base">{link.icon}</span>
                        <span className="hidden sm:inline">{link.label}</span>
                    </a>
                );
            })}
        </nav>
    );
}
