"use client";
import { Button } from "@/components/ui/button";
import { GENERATION_PRESETS } from "@/hooks/useGenerationPage";
import { MODELS } from "@/lib/api";

/**
 * Shared generation controls: presets, variant count, resolution, ratio, notes, generate button.
 * Used by all generation pages before the first generation run.
 *
 * @param {Object} props
 * @param {number}  props.variantCount
 * @param {function} props.setVariantCount
 * @param {string}  props.resolution
 * @param {function} props.setResolution
 * @param {string}  props.aspectRatio
 * @param {function} props.setAspectRatio
 * @param {string|null} props.activePreset
 * @param {function} props.applyPreset
 * @param {function} props.clearPreset
 * @param {string}  [props.productNotes]
 * @param {function} [props.setProductNotes]
 * @param {string}  [props.notesPlaceholder]
 * @param {string}  props.generateLabel - e.g. "packshot", "photo", "visualisation 3D"
 * @param {function} props.onGenerate - called with model (MODELS.FLASH)
 * @param {number}  [props.maxVariants=10]
 */
export function GenerationControls({
    variantCount, setVariantCount,
    resolution, setResolution,
    aspectRatio, setAspectRatio,
    activePreset, applyPreset, clearPreset,
    productNotes, setProductNotes,
    notesPlaceholder = "Ex: Ajoutez des précisions spécifiques au produit pour améliorer le résultat.",
    generateLabel = "packshot",
    onGenerate,
    maxVariants = 10,
}) {
    return (
        <div className="space-y-4">
            {/* Presets */}
            <div className="flex gap-2">
                {Object.entries(GENERATION_PRESETS).map(([key, preset]) => (
                    <button key={key} onClick={() => applyPreset(key)}
                        className={`py-2 px-4 rounded-lg text-sm font-medium border-2 transition-all ${activePreset === key ? "bg-primary/10 border-primary text-primary" : "border-input hover:border-primary/30 hover:bg-accent"}`}>
                        {preset.label}
                        <span className="block text-[10px] font-normal text-muted-foreground">{preset.description}</span>
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-4">
                <label className="text-sm font-medium min-w-fit">Variantes</label>
                <input type="range" min={1} max={maxVariants} value={variantCount}
                    onChange={(e) => setVariantCount(Number(e.target.value))}
                    className="flex-1 accent-primary" />
                <span className="text-lg font-bold min-w-[2ch] text-center">{variantCount}</span>
            </div>
            <div className="flex items-center gap-4">
                <label className="text-sm font-medium min-w-fit">Résolution</label>
                <div className="flex gap-2 flex-1">
                    {["1K", "2K", "4K"].map((r) => (
                        <button key={r} onClick={() => { clearPreset(); setResolution(r); }}
                            className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${resolution === r && !activePreset ? "bg-primary text-primary-foreground border-primary" : resolution === r && activePreset ? "bg-primary/20 text-primary border-primary/50" : "hover:bg-accent border-input"}`}>
                            {r}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex items-center gap-4">
                <label className="text-sm font-medium min-w-fit">Ratio</label>
                <div className="flex gap-2 flex-1 flex-wrap">
                    {["1:1", "4:3", "3:4", "16:9", "9:16"].map((r) => (
                        <button key={r} onClick={() => { clearPreset(); setAspectRatio(r); }}
                            className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${aspectRatio === r && !activePreset ? "bg-primary text-primary-foreground border-primary" : aspectRatio === r && activePreset ? "bg-primary/20 text-primary border-primary/50" : "hover:bg-accent border-input"}`}>
                            {r}
                        </button>
                    ))}
                </div>
            </div>
            {setProductNotes && (
                <div className="space-y-1">
                    <label className="text-sm font-medium">Notes produit (optionnel)</label>
                    <textarea value={productNotes} onChange={(e) => setProductNotes(e.target.value)}
                        placeholder={notesPlaceholder}
                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                        rows={2} />
                    <p className="text-[11px] text-muted-foreground">Ajoutez des précisions spécifiques au produit pour améliorer le résultat.</p>
                </div>
            )}
            <Button onClick={() => onGenerate(MODELS.FLASH)} className="w-full">
                ⚡ Générer {variantCount} {generateLabel}{variantCount > 1 ? "s" : ""} ({resolution}, {aspectRatio})
            </Button>
            <p className="text-xs text-muted-foreground text-center">Aperçu rapide via Flash — utilisez Régénérer pour la qualité Pro</p>
        </div>
    );
}
