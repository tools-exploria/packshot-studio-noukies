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

const STEPS = ["Produit", "Matière", "Génération", "Export"];

export default function ProduitTab() {
    const [step, setStep] = useState(0);

    const {
        loading, error, setError,
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
    } = useGenerationPage({ defaultVariantCount: 2 });

    // ── 3D-specific state: fabric/texture image ──────────────────
    const [fabricFile, setFabricFile] = useState(null);
    const [fabricPreview, setFabricPreview] = useState(null);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => {},
        setError,
    });

    const handleFabricFile = useCallback((f) => {
        setFabricFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setFabricPreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    // 3D generation uses a 180s timeout (heavier rendering)
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile || !fabricFile) return;
        const prompt = PROMPTS.product3D(productNotes.trim() || "");
        await runGenerate(prompt, [productFile, fabricFile], model, 180_000);
    };

    return (
        <>
            <details className="mb-4 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    Comment bien utiliser cet onglet ?
                </summary>
                <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-2 text-muted-foreground text-[13px] leading-relaxed">
                    <p><span className="font-semibold text-foreground">1. Fiche technique</span> — uploadez le schema, la fiche technique ou un dessin a plat du produit. C'est la structure de reference.</p>
                    <p><span className="font-semibold text-foreground">2. Matiere / swatch</span> — uploadez une photo du tissu a appliquer sur le produit. Le modele reproduira sa couleur ET sa texture physique (velours, jersey, corduroy...).</p>
                    <p><span className="font-semibold text-foreground">3. Notes</span> — precisez les details non visibles (couleur du zip, type de couture...).</p>
                </div>
            </details>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">
                    {error}
                </div>
            )}

            {/* ── Step 0 : Fiche technique produit ── */}
            {step === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Fiche technique du produit</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Uploadez la fiche technique ou le schéma du produit.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <UploadZone
                            onFile={handleProductFile}
                            label="Fiche technique / schéma produit"
                            sublabel="PNG, JPG ou PDF — plan du produit"
                            preview={productPreview}
                        />
                        <Button onClick={() => setStep(1)} disabled={!productFile} className="w-full">
                            Continuer →
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* ── Step 1 : Image du tissu ── */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Image du tissu / matière</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Uploadez une photo du tissu à appliquer sur le produit.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <UploadZone
                            onFile={handleFabricFile}
                            label="Photo du tissu"
                            sublabel="PNG ou JPG — swatch de matière"
                            preview={fabricPreview}
                        />
                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(0)}>← Retour</Button>
                            <Button onClick={() => setStep(2)} disabled={!fabricFile} className="flex-1">
                                Continuer →
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* ── Step 2 : Génération 3D ── */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Génération 3D produit</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {variantCount} variante{variantCount > 1 ? "s" : ""} générée{variantCount > 1 ? "s" : ""} par IA. Cliquez pour agrandir, cochez pour sélectionner.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference images */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(productPreview)}>
                                <img src={productPreview} alt="Fiche technique"
                                    className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Structure 🔍</p>
                            </div>
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(fabricPreview)}>
                                <img src={fabricPreview} alt="Tissu"
                                    className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Matière 🔍</p>
                            </div>
                        </div>

                        {!generatedImages.length && !loading && (
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Ex: Le tissu doit envelopper le produit de manière réaliste. Les coutures doivent être visibles."
                                generateLabel="visualisation 3D"
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

                        <Button variant="outline" onClick={() => setStep(1)} className="w-full">← Retour</Button>
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
        </>
    );
}
