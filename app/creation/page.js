"use client";
import { useState } from "react";
import SketchTab from "./SketchTab";
import ProduitTab from "./ProduitTab";

const TABS = [
    { key: "sketch", label: "Croquis → Packshot" },
    { key: "produit", label: "3D Produit" },
];

export default function CreationPage() {
    const [tab, setTab] = useState("sketch");

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Création produit</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    {tab === "sketch"
                        ? "Genere un packshot professionnel a partir d'un croquis, d'une photo smartphone ou d'un packshot existant."
                        : "Genere un packshot 3D a partir d'une fiche technique et d'une matiere."}
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
