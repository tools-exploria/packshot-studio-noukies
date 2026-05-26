"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Sparkles, Undo2, Loader2 } from "lucide-react";
import { ExplorerButton } from "./Explorer";

/**
 * Toolbar partagée : bouton ✨ Reformuler + bouton ↶ Undo persistant.
 * Si enableExplore=true, ajoute aussi un bouton 🎨 Explorer qui ouvre un panel
 * de 5 directions créatives à choisir (modes mood/customPrompt/freePrompt).
 * Placée AU-DESSUS de l'input, alignée à droite.
 */
function ReformulateToolbar({ value, onChange, context, image, enableExplore }) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [previousValue, setPreviousValue] = useState(null);

    // Champ vide / whitespace only → bouton grisé pour économiser des tokens
    // (et éviter que le modèle invente du contenu sans intention utilisateur)
    const isEmpty = !value || !value.trim();
    const disabled = loading || isEmpty;

    const handleClick = async () => {
        if (disabled) return;
        setError(null);
        setLoading(true);
        const before = value;
        try {
            const res = await fetch("/api/reformulate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: value || "", context, image }),
            });
            const data = await res.json();
            if (data.error || !data.result) {
                setError(data.error || "Réponse vide");
                return;
            }
            setPreviousValue(before);
            onChange(data.result);
        } catch (err) {
            setError(err.message || "Erreur réseau");
        } finally {
            setLoading(false);
        }
    };

    const handleUndo = () => {
        if (previousValue === null) return;
        onChange(previousValue);
        setPreviousValue(null);
    };

    const buttonTitle = loading
        ? "Reformulation en cours…"
        : isEmpty
            ? "Écrivez d'abord une intention dans le champ avant de reformuler"
            : "Reformuler avec l'IA (Sonnet 4.6 + recettes NB2)";

    // Wrapper onChange used by Explorer so picking a card also enables Undo
    const handleExplorerApply = (newValue) => {
        setPreviousValue(value);
        onChange(newValue);
    };

    return (
        <div className="flex items-center justify-end gap-1.5 mb-1">
            {previousValue !== null && !loading && (
                <button
                    type="button"
                    onClick={handleUndo}
                    title="Revenir au texte original"
                    className="inline-flex items-center gap-1 text-[11px] font-medium
                               text-muted-foreground hover:text-foreground
                               bg-muted hover:bg-accent border border-input rounded-md
                               px-2 py-1 transition-colors"
                >
                    <Undo2 className="w-3 h-3" />
                    Annuler
                </button>
            )}
            {enableExplore && (
                <ExplorerButton
                    value={value}
                    onChange={handleExplorerApply}
                    context={context}
                    image={image}
                />
            )}
            <button
                type="button"
                onClick={handleClick}
                disabled={disabled}
                title={buttonTitle}
                className="inline-flex items-center gap-1 text-[11px] font-medium
                           text-primary hover:text-primary
                           bg-primary/10 hover:bg-primary/15 border border-primary/30 rounded-md
                           px-2 py-1 transition-colors
                           disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-primary/10"
            >
                {loading
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : <Sparkles className="w-3 h-3" />}
                {loading ? "Reformulation…" : "Reformuler"}
            </button>
            {error && (
                <span className="text-[11px] text-destructive font-medium ml-1">
                    {error}
                </span>
            )}
        </div>
    );
}

/**
 * Hook auto-grow pour textarea : ajuste la hauteur au contenu.
 */
function useAutoGrow(ref, value, minRows = 1) {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        el.style.height = "auto";
        // Compute min height from rows
        const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
        const padding = parseFloat(getComputedStyle(el).paddingTop) + parseFloat(getComputedStyle(el).paddingBottom);
        const minHeight = lineHeight * minRows + padding;
        el.style.height = Math.max(minHeight, el.scrollHeight) + "px";
    }, [value, ref, minRows]);
}

/**
 * Textarea reformulable avec bouton ✨ AU-DESSUS du champ et auto-grow.
 *
 * Drop-in replacement pour une <textarea> existante.
 */
export function ReformulableTextarea({
    value,
    onChange,
    context,
    image,
    disableReformulate = false,
    enableExplore = false,
    className = "",
    rows = 3,
    ...textareaProps
}) {
    const ref = useRef(null);
    useAutoGrow(ref, value, rows);

    const handleChange = useCallback((e) => onChange(e.target.value), [onChange]);

    return (
        <div>
            {!disableReformulate && (
                <ReformulateToolbar
                    value={value}
                    onChange={onChange}
                    context={context}
                    image={image}
                    enableExplore={enableExplore}
                />
            )}
            <textarea
                ref={ref}
                value={value}
                onChange={handleChange}
                rows={rows}
                className={`w-full rounded-md border border-input bg-background px-3 py-2 text-sm
                            placeholder:text-muted-foreground focus-visible:outline-none
                            focus-visible:ring-2 focus-visible:ring-ring resize-none overflow-hidden
                            ${className}`}
                {...textareaProps}
            />
        </div>
    );
}

/**
 * Input ligne unique (basé sur textarea auto-grow pour permettre l'expansion).
 * Submit sur Enter (sans Shift) — Shift+Enter = nouvelle ligne. Comportement passé
 * via props onKeyDown si l'appelant a une logique custom.
 *
 * Le bouton ✨ est AU-DESSUS du champ comme pour ReformulableTextarea.
 */
export function ReformulableInput({
    value,
    onChange,
    context,
    image,
    disableReformulate = false,
    enableExplore = false,
    className = "",
    onKeyDown,
    ...inputProps
}) {
    const ref = useRef(null);
    useAutoGrow(ref, value, 1);

    const handleChange = useCallback((e) => onChange(e.target.value), [onChange]);

    return (
        <div>
            {!disableReformulate && (
                <ReformulateToolbar
                    value={value}
                    onChange={onChange}
                    context={context}
                    image={image}
                    enableExplore={enableExplore}
                />
            )}
            <textarea
                ref={ref}
                value={value}
                onChange={handleChange}
                onKeyDown={onKeyDown}
                rows={1}
                className={`w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm
                            placeholder:text-muted-foreground focus-visible:outline-none
                            focus-visible:ring-1 focus-visible:ring-ring resize-none overflow-hidden
                            leading-snug ${className}`}
                {...inputProps}
            />
        </div>
    );
}

