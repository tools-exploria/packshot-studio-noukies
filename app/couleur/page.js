"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS } from "@/lib/prompts";
import { downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";

const STEPS = ["Produit", "Couleur / Texture", "Génération", "Export"];

const PRESET_COLORS = [
    { name: "Bleu marine", value: "#1a237e" },
    { name: "Rose poudré", value: "#f8bbd0" },
    { name: "Gris perle", value: "#e0e0e0" },
    { name: "Beige", value: "#d7ccc8" },
    { name: "Vert sauge", value: "#a5d6a7" },
    { name: "Terracotta", value: "#bf360c" },
    { name: "Blanc cassé", value: "#fafafa" },
    { name: "Moutarde", value: "#f9a825" },
];

export default function CouleurPage() {
    const [step, setStep] = useState(0);

    const {
        loading, error, setError,
        generatedImages, imageDims,
        selectedImages, setSelectedImages,
        variantCount, setVariantCount,
        resolution, setResolution,
        aspectRatio, setAspectRatio,
        productNotes, setProductNotes,
        productFile,
        productPreview,
        lightboxIdx, setLightboxIdx,
        editingIdx, setEditingIdx,
        editPrompt, setEditPrompt,
        editLoading,
        filledCount,
        handleProductFile,
        runGenerate,
        handleEditImage,
        toggleSelect,
        toggleSelectAll,
    } = useGenerationPage();

    // ── Couleur-specific state ──────────────────────────────────
    const [colorMode, setColorMode] = useState("picker"); // "picker" | "texture"
    const [color, setColor] = useState("#1a237e");
    const [textureFile, setTextureFile] = useState(null);
    const [texturePreview, setTexturePreview] = useState(null);

    // Derive color name from presets, fallback to hex
    const colorName = PRESET_COLORS.find((c) => c.value === color)?.name || color;

    const handleTextureFile = useCallback((f) => {
        setTextureFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setTexturePreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => {}, // pipeline manages its own loading
        setError,
    });

    // ── Generation handler (couleur-specific prompt assembly) ───
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile) return;

        let prompt;
        const files = [productFile];

        if (colorMode === "texture" && textureFile) {
            files.push(textureFile);
            prompt = PROMPTS.applyTexture(productNotes.trim() || "");
        } else {
            prompt = PROMPTS.solidColor(color, colorName, productNotes.trim() || "");
        }

        await runGenerate(prompt, files, model);
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* Step 0: Product upload */}
            {step === 0 && (
                <Card>
                    <CardHeader><CardTitle>Photo produit de référence</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <UploadZone
                            onFile={handleProductFile}
                            label="Uploadez votre packshot détouré"
                            sublabel="PNG ou JPG, fond blanc de préférence"
                            preview={productPreview}
                        />
                        <Button onClick={() => setStep(1)} disabled={!productFile} className="w-full">
                            Continuer →
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 1: Color or texture */}
            {step === 1 && (
                <Card>
                    <CardHeader><CardTitle>Couleur ou texture du tissu</CardTitle></CardHeader>
                    <CardContent className="space-y-6">
                        <div className="flex gap-2">
                            <Button variant={colorMode === "picker" ? "default" : "outline"} onClick={() => setColorMode("picker")}>🎨 Couleur unie</Button>
                            <Button variant={colorMode === "texture" ? "default" : "outline"} onClick={() => setColorMode("texture")}>🧵 Texture tissu</Button>
                        </div>

                        {colorMode === "picker" && (
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    {PRESET_COLORS.map((c) => (
                                        <button
                                            key={c.value}
                                            onClick={() => setColor(c.value)}
                                            className={`w-10 h-10 rounded-full border-2 transition-all ${color === c.value ? "border-primary scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                                            style={{ backgroundColor: c.value }}
                                            title={c.name}
                                        />
                                    ))}
                                </div>
                                <div className="flex items-center gap-3">
                                    <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-12 h-10 rounded cursor-pointer" />
                                    <span className="text-sm text-muted-foreground">Ou choisissez une couleur personnalisée</span>
                                </div>
                                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                                    <div className="w-12 h-12 rounded-lg border" style={{ backgroundColor: color }} />
                                    <span className="text-sm font-medium">{colorName} — {color}</span>
                                </div>
                            </div>
                        )}

                        {colorMode === "texture" && (
                            <UploadZone onFile={handleTextureFile} label="Uploadez votre texture tissu" sublabel="Velours, jersey, lin..." preview={texturePreview} />
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(0)}>← Retour</Button>
                            <Button onClick={() => setStep(2)} disabled={colorMode === "texture" && !textureFile} className="flex-1">Continuer →</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Generation */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Génération packshot</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {variantCount} variante{variantCount > 1 ? "s" : ""} générée{variantCount > 1 ? "s" : ""} par IA. Cliquez pour agrandir, cochez pour sélectionner.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference images for comparison */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(productPreview)}>
                                <img src={productPreview} alt="Produit" className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Produit 🔍</p>
                            </div>
                            {colorMode === "texture" && texturePreview && (
                                <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(texturePreview)}>
                                    <img src={texturePreview} alt="Texture" className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                    <p className="text-xs text-muted-foreground mt-1">Texture 🔍</p>
                                </div>
                            )}
                            {colorMode === "picker" && (
                                <div className="flex-1 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-lg border shadow-sm" style={{ backgroundColor: color }} />
                                    <p className="text-xs text-muted-foreground mt-1">{colorName}</p>
                                </div>
                            )}
                        </div>

                        {!generatedImages.length && !loading && (
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Variantes</label>
                                    <input
                                        type="range" min={1} max={10} value={variantCount}
                                        onChange={(e) => setVariantCount(Number(e.target.value))}
                                        className="flex-1 accent-primary"
                                    />
                                    <span className="text-lg font-bold min-w-[2ch] text-center">{variantCount}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Résolution</label>
                                    <div className="flex gap-2 flex-1">
                                        {["1K", "2K", "4K"].map((r) => (
                                            <button key={r} onClick={() => setResolution(r)}
                                                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${resolution === r ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-input"}`}>
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Ratio</label>
                                    <div className="flex gap-2 flex-1 flex-wrap">
                                        {["1:1", "4:3", "3:4", "16:9", "9:16"].map((r) => (
                                            <button key={r} onClick={() => setAspectRatio(r)}
                                                className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${aspectRatio === r ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-input"}`}>
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Notes produit (optionnel)</label>
                                    <textarea
                                        value={productNotes}
                                        onChange={(e) => setProductNotes(e.target.value)}
                                        placeholder="Ex: La fermeture éclair est en métal argenté, ne pas changer. Les coutures doivent rester visibles."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                                        rows={2}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Ajoutez des précisions spécifiques au produit pour améliorer le résultat.</p>
                                </div>
                                <Button onClick={() => handleGenerate(MODELS.FLASH)} className="w-full">
                                    ⚡ Générer {variantCount} packshot{variantCount > 1 ? "s" : ""} ({resolution}, {aspectRatio})
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">Aperçu rapide via Flash — utilisez Régénérer pour la qualité Pro</p>
                            </div>
                        )}

                        {/* Image grid */}
                        {(generatedImages.length > 0 || loading) && (
                            <div className="space-y-3">
                                {filledCount > 0 && (
                                    <div className="flex items-center justify-between">
                                        <button onClick={toggleSelectAll} className="text-sm text-primary hover:underline">
                                            {selectedImages.size === filledCount ? "Tout désélectionner" : "Tout sélectionner"}
                                        </button>
                                        <span className="text-sm text-muted-foreground">{selectedImages.size} sélectionnée{selectedImages.size > 1 ? "s" : ""}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {generatedImages.map((img, i) => (
                                        <div key={i}
                                            className={`relative rounded-lg border overflow-hidden transition-all ${img ? "cursor-pointer hover:shadow-lg" : "animate-pulse"} ${img && selectedImages.has(i) ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                                            {img ? (
                                                <>
                                                    <img src={`data:image/png;base64,${img}`} alt={`Variante ${i + 1}`}
                                                        className="w-full aspect-square object-contain bg-white"
                                                        onClick={() => setLightboxIdx(i)} />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSelect(i); }}
                                                        className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold transition-all ${selectedImages.has(i) ? "bg-primary border-primary text-primary-foreground" : "bg-white/80 border-gray-300 hover:border-primary"}`}>
                                                        {selectedImages.has(i) && "✓"}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); downloadImage(img, pipeline.getFileName(i)); }}
                                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-sm shadow transition-all hover:scale-110"
                                                        title="Télécharger">
                                                        ⬇
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-3 flex items-center justify-between">
                                                        <span className="text-white text-sm font-medium">Variante {i + 1}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingIdx(editingIdx === i ? null : i); setEditPrompt(""); }}
                                                            className="text-white/80 hover:text-white text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 transition-all"
                                                            title="Modifier cette image">
                                                            ✏️ Modifier
                                                        </button>
                                                    </div>
                                                    {editingIdx === i && (
                                                        <div className="absolute left-0 right-0 bottom-10 p-2 bg-background border-t" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex gap-1">
                                                                <input type="text" value={editPrompt}
                                                                    onChange={(e) => setEditPrompt(e.target.value)}
                                                                    onKeyDown={(e) => { if (e.key === "Enter" && editPrompt.trim()) handleEditImage(i); }}
                                                                    placeholder="Décrivez la modification…"
                                                                    className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                                    autoFocus />
                                                                <Button size="sm" variant="outline" disabled={editLoading || !editPrompt.trim()}
                                                                    onClick={() => handleEditImage(i, MODELS.FLASH)} className="text-xs h-7" title="Rapide (Flash)">
                                                                    {editLoading ? "…" : "⚡"}
                                                                </Button>
                                                                <Button size="sm" disabled={editLoading || !editPrompt.trim()}
                                                                    onClick={() => handleEditImage(i, MODELS.PRO)} className="text-xs h-7" title="Qualité (Pro)">
                                                                    {editLoading ? "…" : "Pro"}
                                                                </Button>
                                                            </div>
                                                            {error && error.startsWith("Modification") && (
                                                                <p className="text-xs text-destructive mt-1">{error}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="aspect-square bg-muted flex items-center justify-center">
                                                    <div className="text-center">
                                                        <div className="animate-spin text-2xl mb-2">⏳</div>
                                                        <p className="text-sm text-muted-foreground">Génération...</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {filledCount > 0 && !loading && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => handleGenerate(MODELS.FLASH)}>⚡ Régénérer (Flash)</Button>
                                <Button variant="outline" onClick={() => handleGenerate(MODELS.PRO)}>🔄 Régénérer (Pro)</Button>
                                <Button onClick={() => setStep(3)} className="flex-1">Export →</Button>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Export */}
            {step === 3 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Export & téléchargement</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {selectedImages.size > 0
                                ? `${selectedImages.size} image${selectedImages.size > 1 ? "s" : ""} sélectionnée${selectedImages.size > 1 ? "s" : ""} — cliquez pour dé/sélectionner`
                                : `${filledCount} image${filledCount > 1 ? "s" : ""} — tout sera téléchargé. Cliquez pour en sélectionner.`}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {generatedImages.map((img, idx) => img && (
                                <div key={idx} onClick={() => toggleSelect(idx)}
                                    className={`relative text-center cursor-pointer rounded-lg border-2 overflow-hidden transition-all hover:shadow-lg ${selectedImages.has(idx) ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"}`}>
                                    <img src={`data:image/png;base64,${img}`} alt={`Variante ${idx + 1}`}
                                        className="w-full aspect-square object-contain bg-white" />
                                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow transition-all ${selectedImages.has(idx) ? "bg-primary text-primary-foreground" : "bg-white/80 text-muted-foreground"}`}>
                                        {selectedImages.has(idx) ? "✓" : idx + 1}
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(idx); }}
                                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-xs shadow"
                                        title="Agrandir">🔍</button>
                                    <div className="bg-muted/80 py-1 px-2">
                                        <p className="text-xs font-medium">Variante {idx + 1}</p>
                                        <p className="text-[10px] text-muted-foreground">
                                            {imageDims[idx] ? `${imageDims[idx].w}×${imageDims[idx].h}px` : "…"}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center">
                            <button onClick={toggleSelectAll} className="text-sm text-primary hover:underline">
                                {selectedImages.size === filledCount ? "Tout désélectionner" : "Tout sélectionner"}
                            </button>
                            <span className="text-xs text-muted-foreground">
                                {selectedImages.size > 0 ? `${selectedImages.size} sélectionnée${selectedImages.size > 1 ? "s" : ""}` : "Toutes (aucune sélection)"}
                            </span>
                        </div>

                        <ExportPanel
                            pipeline={pipeline}
                            generatedImages={generatedImages}
                            loading={loading}
                            filledCount={filledCount}
                            selectedImages={selectedImages}
                        />

                        <Button variant="outline" onClick={() => setStep(2)} className="w-full">← Retour</Button>
                    </CardContent>
                </Card>
            )}

            {/* Gallery lightbox */}
            <GalleryLightbox
                images={generatedImages}
                imageDims={imageDims}
                lightboxIdx={lightboxIdx}
                setLightboxIdx={setLightboxIdx}
                onDownload={(idx) => downloadImage(generatedImages[idx], pipeline.getFileName(idx))}
                selectedImages={selectedImages}
                toggleSelect={toggleSelect}
            />

            {/* Reference lightbox */}
            <SimpleLightbox
                src={pipeline.refLightboxSrc}
                onClose={() => pipeline.setRefLightboxSrc(null)}
            />
        </div>
    );
}
