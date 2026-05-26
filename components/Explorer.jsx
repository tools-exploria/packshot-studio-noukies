"use client";

import { useState, useCallback } from "react";
import { Wand2, X, Loader2 } from "lucide-react";

/**
 * Bouton "Explorer" + modal qui affiche 5 directions créatives.
 * Chaque carte = { title, recipe, anchor, prompt }. Cliquer → applique le prompt
 * au champ via onChange().
 *
 * Drop-in à coté du bouton ✨ Reformuler dans la toolbar Reformulable.
 */
export function ExplorerButton({ value, onChange, context, image, onApplied }) {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [cards, setCards] = useState([]);
    const [error, setError] = useState(null);

    const handleClick = async () => {
        setOpen(true);
        setLoading(true);
        setError(null);
        setCards([]);
        try {
            const res = await fetch("/api/explore", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: value || "", context, image }),
            });
            const data = await res.json();
            if (data.error || !data.cards) {
                setError(data.error || "Réponse vide");
                return;
            }
            setCards(data.cards);
        } catch (err) {
            setError(err.message || "Erreur réseau");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = useCallback(() => {
        setOpen(false);
        setCards([]);
        setError(null);
    }, []);

    const handlePick = useCallback(
        (card) => {
            onChange(card.prompt);
            onApplied?.(card);
            handleClose();
        },
        [onChange, onApplied, handleClose],
    );

    return (
        <>
            <button
                type="button"
                onClick={handleClick}
                title="Explorer 5 directions créatives en 1 clic"
                className="inline-flex items-center gap-1 text-[11px] font-medium
                           text-primary hover:text-primary
                           bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-md
                           px-2 py-1 transition-colors"
            >
                <Wand2 className="w-3 h-3" />
                Explorer
            </button>

            {open && (
                <ExplorerPanel
                    loading={loading}
                    cards={cards}
                    error={error}
                    onPick={handlePick}
                    onClose={handleClose}
                />
            )}
        </>
    );
}

/**
 * Modal plein écran (overlay) avec une grille de cartes cliquables.
 */
function ExplorerPanel({ loading, cards, error, onPick, onClose }) {
    return (
        <div
            className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
        >
            <div
                className="bg-card border rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex items-center justify-between px-6 py-4 border-b shrink-0">
                    <div>
                        <h2 className="font-semibold flex items-center gap-2">
                            <Wand2 className="w-4 h-4 text-primary" />
                            Directions créatives
                        </h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Cliquez sur une direction pour l'appliquer au champ.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="hover:bg-accent rounded-md p-1.5 transition-colors"
                        title="Fermer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </header>

                <div className="overflow-y-auto p-6 grow">
                    {loading && (
                        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            <span className="text-sm">Création de 5 directions à partir de votre produit…</span>
                            <span className="text-[11px] text-muted-foreground/70">~10-20 secondes</span>
                        </div>
                    )}

                    {error && !loading && (
                        <div className="bg-destructive/10 text-destructive rounded-lg p-4 text-sm">
                            <p className="font-medium mb-1">Erreur</p>
                            <p>{error}</p>
                        </div>
                    )}

                    {!loading && !error && cards.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {cards.map((card, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    onClick={() => onPick(card)}
                                    className="text-left p-4 rounded-lg border bg-card hover:bg-accent/40 hover:border-primary
                                               transition-all group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <div className="flex items-center gap-2 mb-2">
                                        {card.recipe && (
                                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                                                {card.recipe}
                                            </span>
                                        )}
                                        <h3 className="font-semibold text-sm">{card.title}</h3>
                                    </div>
                                    {card.anchor && (
                                        <p className="text-[11px] text-muted-foreground italic mb-2">
                                            Ancrage&nbsp;: {card.anchor}
                                        </p>
                                    )}
                                    <p className="text-xs text-muted-foreground line-clamp-5 leading-relaxed">
                                        {card.prompt}
                                    </p>
                                    <div className="mt-3 text-[10px] font-medium text-primary opacity-60 group-hover:opacity-100 transition-opacity">
                                        Cliquer pour appliquer →
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
