"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS, SCENE_LABELS } from "@/lib/prompts";
import { downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";

const STEPS = ["Produit", "Scène", "Génération", "Export"];

export default function AmbiancePage() {
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

    // ── Ambiance-specific state ──────────────────────────────────
    const [sceneType, setSceneType] = useState("baby_sitting");
    const [customPrompt, setCustomPrompt] = useState("");

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages, setLoading, setError,
    });

    // ── Generation handler (ambiance-specific prompt assembly) ──
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile) return;
        let prompt;
        if (sceneType === "custom") {
            prompt = PROMPTS.ambianceCustom(customPrompt);
        } else {
            prompt = PROMPTS.ambiance[sceneType];
        }
        if (!prompt) { setError("Prompt vide"); return; }
        if (productNotes.trim()) prompt += `\n\nAdditional product notes: ${productNotes.trim()}`;
        await runGenerate(prompt, [productFile], model);
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

            {/* Step 1: Scene selection */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Type de scène</CardTitle>
                        <p className="text-sm text-muted-foreground">Choisissez un template ou écrivez un prompt personnalisé.</p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(SCENE_LABELS).map(([key, label]) => (
                                <button key={key} onClick={() => setSceneType(key)}
                                    className={`text-left p-3 rounded-lg border transition-all ${sceneType === key ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}>
                                    <span className="font-medium text-sm">{label}</span>
                                </button>
                            ))}
                            <button onClick={() => setSceneType("custom")}
                                className={`text-left p-3 rounded-lg border transition-all ${sceneType === "custom" ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}>
                                <span className="font-medium text-sm">✏️ Prompt personnalisé</span>
                            </button>
                        </div>

                        {sceneType === "custom" && (
                            <div className="space-y-2">
                                <Label>Décrivez votre scène</Label>
                                <textarea
                                    value={customPrompt}
                                    onChange={(e) => setCustomPrompt(e.target.value)}
                                    placeholder="Un bébé assis sur un tapis dans un salon lumineux..."
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[100px] resize-y"
                                />
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(0)}>← Retour</Button>
                            <Button onClick={() => setStep(2)} disabled={sceneType === "custom" && !customPrompt} className="flex-1">Continuer →</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Generation */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Génération photo d&apos;ambiance</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {variantCount} variante{variantCount > 1 ? "s" : ""} générée{variantCount > 1 ? "s" : ""} par IA. Cliquez pour agrandir, cochez pour sélectionner.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference images */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(productPreview)}>
                                <img src={productPreview} alt="Produit" className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Produit 🔍</p>
                            </div>
                            <div className="flex-1 flex flex-col items-center justify-center">
                                <p className="text-sm font-medium text-center">
                                    {sceneType === "custom" ? "Prompt personnalisé" : SCENE_LABELS[sceneType]}
                                </p>
                            </div>
                        </div>

                        {!generatedImages.length && !loading && (
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Ex: Le produit doit être au premier plan, bien visible. L'ambiance doit être chaleureuse."
                                generateLabel="photo"
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
