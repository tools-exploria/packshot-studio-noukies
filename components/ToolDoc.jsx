"use client";
import { useState } from "react";
import { TOOL_DOCS } from "@/lib/docs";

/**
 * Documentation block rendered at the top of each tool page.
 * Reads from lib/docs.js using the tool key.
 *
 * Collapsible by default (<details>) — keeps the main UI uncluttered for
 * familiar users, but available 1-click away for newcomers.
 *
 * Images (before/after) are loaded with graceful fallback : if the file is
 * missing in /public/examples/, a soft placeholder appears instead of a
 * broken image icon. Lets us ship the doc text without waiting for assets.
 *
 * @param {string} tool - key in TOOL_DOCS (e.g., "creation-sketch")
 * @param {boolean} [defaultOpen=false]
 */
export function ToolDoc({ tool, defaultOpen = false }) {
    const doc = TOOL_DOCS[tool];
    if (!doc) return null;

    return (
        <details open={defaultOpen} className="mb-6 group">
            <summary className="cursor-pointer list-none inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 hover:bg-muted text-sm font-medium text-muted-foreground hover:text-foreground transition-colors border">
                <span aria-hidden>📖</span>
                <span>Comment utiliser cet outil ?</span>
                <span className="text-xs opacity-60 group-open:hidden">— cliquez pour ouvrir</span>
                <span className="text-xs opacity-60 hidden group-open:inline">— cliquez pour fermer</span>
            </summary>

            <div className="mt-4 p-5 rounded-lg bg-card border space-y-5 text-sm">
                {/* Summary */}
                <DocSection icon="🎯" title="À quoi ça sert">
                    <p className="text-muted-foreground leading-relaxed">{doc.summary}</p>
                </DocSection>

                {/* Use cases */}
                {doc.useCases?.length > 0 && (
                    <DocSection icon="📋" title="Quand l'utiliser">
                        <BulletList items={doc.useCases} />
                    </DocSection>
                )}

                {/* Requirements */}
                {doc.requirements?.length > 0 && (
                    <DocSection icon="📥" title="Ce qu'il vous faut">
                        <BulletList items={doc.requirements} />
                    </DocSection>
                )}

                {/* Examples */}
                {doc.examples?.map((ex, i) => (
                    <DocSection key={i} icon="▶️" title={ex.title}>
                        {(ex.before || ex.after) && (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                                {ex.before && <BeforeAfterImage label="Avant" {...ex.before} />}
                                {ex.after && <BeforeAfterImage label="Après" {...ex.after} />}
                            </div>
                        )}
                        {ex.steps?.length > 0 && (
                            <ol className="list-decimal list-inside text-muted-foreground space-y-1.5 leading-relaxed marker:text-foreground marker:font-semibold">
                                {ex.steps.map((s, j) => <li key={j}>{s}</li>)}
                            </ol>
                        )}
                    </DocSection>
                ))}

                {/* Pitfalls */}
                {doc.pitfalls?.length > 0 && (
                    <DocSection icon="⚠️" title="Pièges courants" tone="warning">
                        <BulletList items={doc.pitfalls} />
                    </DocSection>
                )}

                {/* Tips */}
                {doc.tips?.length > 0 && (
                    <DocSection icon="💡" title="Conseils pour le meilleur résultat">
                        <BulletList items={doc.tips} />
                    </DocSection>
                )}
            </div>
        </details>
    );
}

// ─── Sub-components ────────────────────────────────────────────

function DocSection({ icon, title, tone, children }) {
    const titleClass = tone === "warning"
        ? "font-semibold text-amber-700 mb-1.5"
        : "font-semibold text-foreground mb-1.5";
    return (
        <div>
            <h3 className={titleClass}>
                <span aria-hidden className="mr-1.5">{icon}</span>
                {title}
            </h3>
            {children}
        </div>
    );
}

function BulletList({ items }) {
    return (
        <ul className="list-disc list-outside ml-5 text-muted-foreground space-y-1.5 leading-relaxed">
            {items.map((item, i) => <li key={i}>{item}</li>)}
        </ul>
    );
}

/**
 * Image with graceful fallback. If src 404s or never loads, shows a soft
 * placeholder so the doc remains coherent while assets are pending.
 */
function BeforeAfterImage({ src, caption, label }) {
    const [errored, setErrored] = useState(false);
    return (
        <figure className="space-y-1.5">
            <div className="relative w-full aspect-square rounded-md border bg-muted/30 overflow-hidden flex items-center justify-center">
                <span className="absolute top-1.5 left-1.5 z-10 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-background/80 text-muted-foreground uppercase tracking-wider">
                    {label}
                </span>
                {!errored ? (
                    <img
                        src={src}
                        alt={`${label} — ${caption}`}
                        className="w-full h-full object-contain"
                        onError={() => setErrored(true)}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-1 text-muted-foreground text-xs px-3 text-center">
                        <span aria-hidden className="text-2xl opacity-50">🖼️</span>
                        <span className="opacity-70">Visuel à venir</span>
                    </div>
                )}
            </div>
            <figcaption className="text-xs text-muted-foreground text-center leading-snug">
                {caption}
            </figcaption>
        </figure>
    );
}
