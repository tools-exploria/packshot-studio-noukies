"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS } from "@/lib/prompts";
import { downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
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
        selectedImages,
        variantCount, setVariantCount,
        resolution, setResolution,
        aspectRatio, setAspectRatio,
        activePreset, applyPreset, clearPreset,
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
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Ex: La fermeture éclair est en métal argenté, ne pas changer. Les coutures doivent rester visibles."
                                generateLabel="packshot"
                                onGenerate={handleGenerate}
                            />
                        )}

                        <ImageGrid
                            generatedImages={generatedImages} selectedImages={selectedImages} filledCount={filledCount}
                            editingIdx={editingIdx} setEditingIdx={setEditingIdx}
                            editPrompt={editPrompt} setEditPrompt={setEditPrompt}
                            editLoading={editLoading} error={error} loading={loading}
                            setLightboxIdx={setLightboxIdx}
                            toggleSelect={toggleSelect} toggleSelectAll={toggleSelectAll}
                            handleEditImage={handleEditImage}
                            onDownload={(i) => downloadImage(generatedImages[i], pipeline.getFileName(i))}
                            onGenerate={handleGenerate}
                            onExport={() => setStep(3)}
                        />
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
