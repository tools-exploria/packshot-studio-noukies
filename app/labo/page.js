"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, UploadZone } from "@/components/shared";
import { downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";

const STEPS = ["Setup", "Generation", "Export"];

export default function LaboPage() {
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

    // ── Labo-specific state ────────────────────────────────────
    const [refFiles, setRefFiles] = useState([]);       // File[]
    const [refPreviews, setRefPreviews] = useState([]); // dataURL[]
    const [prompt, setPrompt] = useState("");

    const handleRefFile = useCallback((f) => {
        setRefFiles((prev) => [...prev, f]);
        const reader = new FileReader();
        reader.onload = (e) => setRefPreviews((prev) => [...prev, e.target.result]);
        reader.readAsDataURL(f);
    }, []);

    const removeRef = useCallback((idx) => {
        setRefFiles((prev) => prev.filter((_, i) => i !== idx));
        setRefPreviews((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => {},
        setError,
    });

    // ── Generation handler ─────────────────────────────────────
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile || !prompt.trim()) return;
        const files = [productFile, ...refFiles];
        await runGenerate(prompt.trim(), files, model);
    };

    // ── Can proceed to generation? ─────────────────────────────
    const canGenerate = productFile && prompt.trim().length > 0;

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Labo experiments nav */}
            <div className="flex items-center gap-3 mb-6">
                <a href="/labo"
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary/10 text-primary">
                    Prompt libre
                </a>
                <a href="/labo/sketch-to-packshot"
                    className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">
                    Sketch → Packshot
                </a>
                <a href="/labo/pliage"
                    className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">
                    Pliage
                </a>
            </div>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* Step 0: Setup — product + refs + prompt */}
            {step === 0 && (
                <div className="space-y-6">
                    {/* Product upload */}
                    <Card>
                        <CardHeader><CardTitle>Photo produit</CardTitle></CardHeader>
                        <CardContent>
                            <UploadZone
                                onFile={handleProductFile}
                                label="Packshot produit (obligatoire)"
                                sublabel="PNG ou JPG, fond blanc de preference"
                                preview={productPreview}
                            />
                        </CardContent>
                    </Card>

                    {/* Reference images (optional, multiple) */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Images de reference (optionnel)</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Pattern, texture, broderie, swatch... autant que necessaire.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {refPreviews.length > 0 && (
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                                    {refPreviews.map((prev, i) => (
                                        <div key={i} className="relative group">
                                            <img src={prev} alt={`Ref ${i + 1}`}
                                                className="w-full aspect-square object-contain rounded-lg bg-white border" />
                                            <button
                                                onClick={() => removeRef(i)}
                                                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive text-destructive-foreground text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                                                title="Supprimer"
                                            >x</button>
                                            <p className="text-[10px] text-center text-muted-foreground mt-1">Ref {i + 1}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <UploadZone
                                onFile={handleRefFile}
                                label="Ajouter une image de reference"
                                sublabel="Cliquer ou glisser-deposer"
                            />
                        </CardContent>
                    </Card>

                    {/* Prompt */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Prompt</CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Ecrivez le prompt complet. Pas de template ici, c'est du brut.
                            </p>
                        </CardHeader>
                        <CardContent>
                            <textarea
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                                placeholder="Ecrivez votre prompt ici... Il sera envoye tel quel au modele avec les images ci-dessus."
                                rows={8}
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 resize-y"
                            />
                        </CardContent>
                    </Card>

                    <Button onClick={() => setStep(1)} disabled={!canGenerate} className="w-full">
                        Continuer vers la generation →
                    </Button>
                </div>
            )}

            {/* Step 1: Generation */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Generation Labo</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {variantCount} variante{variantCount > 1 ? "s" : ""}. Prompt libre, pas de garde-fous.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference strip */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed overflow-x-auto">
                            <div className="flex-shrink-0 w-20 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(productPreview)}>
                                <img src={productPreview} alt="Produit" className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-[10px] text-muted-foreground mt-1">Produit</p>
                            </div>
                            {refPreviews.map((prev, i) => (
                                <div key={i} className="flex-shrink-0 w-20 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(prev)}>
                                    <img src={prev} alt={`Ref ${i + 1}`} className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                    <p className="text-[10px] text-muted-foreground mt-1">Ref {i + 1}</p>
                                </div>
                            ))}
                        </div>

                        {/* Show prompt for reference */}
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Voir le prompt</summary>
                            <pre className="mt-2 p-3 rounded-lg bg-muted text-xs whitespace-pre-wrap max-h-48 overflow-y-auto">{prompt}</pre>
                        </details>

                        {!generatedImages.length && !loading && (
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Notes supplementaires (optionnel)"
                                generateLabel="labo"
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
                            onExport={() => setStep(2)}
                        />

                        {!loading && !generatedImages.length && (
                            <Button variant="outline" onClick={() => setStep(0)} className="w-full">← Retour</Button>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Export */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Export & telechargement</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {selectedImages.size > 0
                                ? `${selectedImages.size} image${selectedImages.size > 1 ? "s" : ""} selectionnee${selectedImages.size > 1 ? "s" : ""}`
                                : `${filledCount} image${filledCount > 1 ? "s" : ""} — tout sera telecharge.`}
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
                                            {imageDims[idx] ? `${imageDims[idx].w}x${imageDims[idx].h}px` : "..."}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-between items-center">
                            <button onClick={toggleSelectAll} className="text-sm text-primary hover:underline">
                                {selectedImages.size === filledCount ? "Tout deselectionner" : "Tout selectionner"}
                            </button>
                            <span className="text-xs text-muted-foreground">
                                {selectedImages.size > 0 ? `${selectedImages.size} selectionnee${selectedImages.size > 1 ? "s" : ""}` : "Toutes (aucune selection)"}
                            </span>
                        </div>

                        <ExportPanel
                            pipeline={pipeline}
                            generatedImages={generatedImages}
                            loading={loading}
                            filledCount={filledCount}
                            selectedImages={selectedImages}
                        />

                        <Button variant="outline" onClick={() => setStep(1)} className="w-full">← Retour</Button>
                    </CardContent>
                </Card>
            )}

            <GalleryLightbox
                images={generatedImages}
                imageDims={imageDims}
                lightboxIdx={lightboxIdx}
                setLightboxIdx={setLightboxIdx}
                onDownload={(idx) => downloadImage(generatedImages[idx], pipeline.getFileName(idx))}
                selectedImages={selectedImages}
                toggleSelect={toggleSelect}
            />

            <SimpleLightbox
                src={pipeline.refLightboxSrc}
                onClose={() => pipeline.setRefLightboxSrc(null)}
            />
        </div>
    );
}
