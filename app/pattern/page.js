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

const STEPS = ["Produit", "Pattern", "Tiling", "Génération", "Export"];

export default function PatternPage() {
    const [step, setStep] = useState(0);

    const {
        loading, setLoading,
        error, setError,
        generatedImages,
        imageDims,
        selectedImages,
        variantCount, setVariantCount,
        resolution, setResolution,
        aspectRatio, setAspectRatio,
        activePreset, applyPreset, clearPreset,
        productNotes, setProductNotes,
        productFile,
        productPreview,
        productDims,
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

    // ── Pattern-specific state ───────────────────────────────────
    const [patternFile, setPatternFile] = useState(null);
    const [patternPreview, setPatternPreview] = useState(null);
    const [density, setDensity] = useState(4);
    const [tiledPreview, setTiledPreview] = useState(null);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages, setLoading, setError,
    });

    const handlePatternFile = useCallback((f) => {
        setPatternFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setPatternPreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    // Tile the pattern on a canvas matching product image dimensions
    const handleTile = async () => {
        if (!patternFile || !productDims) return;
        setLoading(true);
        setError(null);
        const formData = new FormData();
        formData.append("file", patternFile);
        formData.append("density", String(density));
        formData.append("canvasWidth", String(productDims.w));
        formData.append("canvasHeight", String(productDims.h));
        try {
            const res = await fetch("/api/tile", { method: "POST", body: formData });
            if (!res.ok) throw new Error((await res.json()).error || "Erreur tiling");
            const blob = await res.blob();
            setTiledPreview(URL.createObjectURL(blob));
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Generate: convert tiled object URL → base64, assemble prompt, then run
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile || !tiledPreview) return;

        // Convert tiledPreview (object URL) to a File-compatible blob
        const tiledRes = await fetch(tiledPreview);
        const tiledBlob = await tiledRes.blob();
        const tiledFile = new File([tiledBlob], "tiled.png", { type: "image/png" });

        const prompt = PROMPTS.applyPattern.replace(
            "{PRODUCT_NOTES}",
            productNotes.trim() ? `\nPRODUCT-SPECIFIC NOTES:\n${productNotes.trim()}` : ""
        );

        await runGenerate(prompt, [productFile, tiledFile], model);
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

            {/* Step 1: Pattern upload */}
            {step === 1 && (
                <Card>
                    <CardHeader><CardTitle>Fichier pattern (motif unitaire)</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <UploadZone
                            onFile={handlePatternFile}
                            label="Uploadez votre motif PNG"
                            sublabel="Image du motif qui sera répété"
                            preview={patternPreview}
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(0)}>← Retour</Button>
                            <Button onClick={() => setStep(2)} disabled={!patternFile} className="flex-1">
                                Continuer →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Tiling */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Tiling — densité du motif</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {productDims
                                ? `Canvas = ${productDims.w}×${productDims.h}px (image produit) — ~${density} tiles en largeur`
                                : "Chargement des dimensions…"}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="text-sm font-medium min-w-fit">Densité</label>
                            <input type="range" min={1} max={12} value={density}
                                onChange={(e) => setDensity(Number(e.target.value))}
                                className="flex-1 accent-primary" />
                            <span className="text-lg font-bold min-w-[3ch] text-center">×{density}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                            Plus haut = motif plus petit, plus de répétitions. Plus bas = motif plus grand.
                        </p>
                        <Button onClick={handleTile} disabled={loading || !productDims} className="w-full">
                            {loading ? "Tiling en cours..." : `Générer le tiling ×${density} (${productDims?.w ?? "?"}×${productDims?.h ?? "?"})`}
                        </Button>
                        {tiledPreview && (
                            <div className="space-y-3">
                                <img src={tiledPreview} alt="Tiled" className="w-full rounded-lg border" />
                                <div className="flex gap-2">
                                    <Button variant="outline" onClick={() => setStep(1)}>← Retour</Button>
                                    <Button onClick={() => setStep(3)} className="flex-1">Continuer vers la génération →</Button>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 3: Generation */}
            {step === 3 && (
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
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(tiledPreview)}>
                                <img src={tiledPreview} alt="Tiling" className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Tiling 🔍</p>
                            </div>
                        </div>

                        {!generatedImages.length && !loading && (
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Ex: Le produit a des bretelles en tissu qui doivent aussi recevoir le motif. Les parties en plastique sont transparentes."
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
                            onExport={() => setStep(4)}
                        />
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Export */}
            {step === 4 && (
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

                        <Button variant="outline" onClick={() => setStep(3)} className="w-full">← Retour</Button>
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

            {/* Reference lightbox (product, tiling, green screen previews) */}
            <SimpleLightbox
                src={pipeline.refLightboxSrc}
                onClose={() => pipeline.setRefLightboxSrc(null)}
            />
        </div>
    );
}
