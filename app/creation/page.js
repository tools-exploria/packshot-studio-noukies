"use client";
import { useState } from "react";
import SketchTab from "./SketchTab";
import ProduitTab from "./ProduitTab";

const TABS = [
    // NOTE: tab key "sketch" historiquement = onglet Produit -> Packshot.
    // Le renaming UI ne change pas la clef pour eviter les casses de routes/etat.
    { key: "sketch", label: "Produit → Packshot" },
    { key: "produit", label: "Croquis → Packshot" },
];

export default function CreationPage() {
    const [tab, setTab] = useState("sketch");

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Packshot</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {tab === "sketch"
                        ? "Genere un packshot professionnel a partir d'une photo smartphone, d'un packshot existant ou d'un croquis."
                        : "Genere un packshot 3D flat-lay a partir d'une fiche technique (croquis du produit) et d'une matiere."}
                </p>
            </div>

            {/* Tab switcher */}
            <div className="flex items-center gap-2 mb-6 border-b">
                {TABS.map((t) => (
                    <button
                        key={t.key}
                        onClick={() => setTab(t.key)}
                        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
                            tab === t.key
                                ? "border-primary text-primary"
                                : "border-transparent text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {t.label}
                    </button>
                ))}
            </div>

            {tab === "sketch" && <SketchTab />}
            {tab === "produit" && <ProduitTab />}
        </div>
    );
}
