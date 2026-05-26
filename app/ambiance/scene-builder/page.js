"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS } from "@/lib/prompts";
import { downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { ReformulableTextarea } from "@/components/Reformulable";

const STEPS = ["Référence", "Retouches", "Génération", "Export"];

export default function SceneBuilderPage() {
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
        lightboxIdx, setLightboxIdx,
        editingIdx, setEditingIdx,
        editPrompt, setEditPrompt,
        editLoading,
        filledCount,
        runGenerate,
        handleEditImage,
        toggleSelect,
        toggleSelectAll,
    } = useGenerationPage({ defaultAspectRatio: "16:9" });

    // ── Scene-builder-specific state ─────────────────────────────
    const [referenceFile, setReferenceFile] = useState(null);
    const [referencePreview, setReferencePreview] = useState(null);
    const [tweaks, setTweaks] = useState("");
    const [applyBrand, setApplyBrand] = useState(true);

    const handleReferenceFile = useCallback((f) => {
        setReferenceFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setReferencePreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => { },
        setError,
    });

    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!referenceFile) return;
        const prompt = PROMPTS.sceneFromReference(tweaks, applyBrand, productNotes.trim());
        await runGenerate(prompt, [referenceFile], model);
    };

    const refB64 = referencePreview?.split(",")[1];

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Sub-nav */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <a href="/ambiance" className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">Scène produit</a>
                <a href="/ambiance/room-scene" className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">Scène chambre</a>
                <a href="/ambiance/scene-builder" className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary/10 text-primary">Créer une scène</a>
                {/* "Produits dans scène" — retiré 2026-05-26, en validation. Route accessible par URL. */}
                {/* <a href="/ambiance/products-in-scene" className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">Produits dans scène</a> */}
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-bold">Créer une scène d'ambiance</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Partez d'une image de référence (Pinterest, mood board, photo trouvée) et adaptez-la
                    à vos besoins : couleur des murs, luminosité, ambiance, ajouts ou retraits. Le résultat
                    est une scène prête à accueillir des produits Noukies (via l'agent <em>Produits dans scène</em>).
                </p>
            </div>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* Step 0: Reference image */}
            {step === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Image de référence</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Uploadez l'image qui inspire la scène que vous voulez générer.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <UploadZone
                            onFile={handleReferenceFile}
                            label="Image de la scène de référence"
                            sublabel="Pinterest, mood board, photo d'intérieur, render…"
                            preview={referencePreview}
                        />
                        <Button onClick={() => setStep(1)} disabled={!referenceFile} className="w-full">
                            Continuer →
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 1: Tweaks */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Retouches</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Décrivez les modifications à apporter à la scène (couleur des murs, luminosité,
                            ajouts, ambiance…). Laissez vide pour une simple version polie de la référence.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(referencePreview)}>
                                <img src={referencePreview} alt="Référence" className="w-full max-h-48 object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Référence 🔍</p>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-sm">Modifications souhaitées (optionnel)</Label>
                            <ReformulableTextarea
                                value={tweaks}
                                onChange={setTweaks}
                                placeholder="Ex: mur principal plus chaud (terracotta clair), plus de lumière naturelle venant de la gauche, ajouter un rideau de lin beige, retirer le tableau au-dessus du lit, ambiance fin d'après-midi…"
                                className="min-h-[120px]"
                                rows={5}
                                context={{ agent: "ambiance-scene-builder", role: "sceneTweaks" }}
                                image={refB64}
                            />
                        </div>

                        <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 border">
                            <input
                                type="checkbox"
                                id="apply-brand"
                                checked={applyBrand}
                                onChange={(e) => setApplyBrand(e.target.checked)}
                                className="accent-primary"
                            />
                            <label htmlFor="apply-brand" className="text-sm cursor-pointer select-none">
                                Appliquer la charte Noukies (palette pastel, lumière douce, mood éditorial)
                            </label>
                        </div>

                        <div className="flex gap-2">
                            <Button variant="outline" onClick={() => setStep(0)}>← Retour</Button>
                            <Button onClick={() => setStep(2)} className="flex-1">Continuer →</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 2: Generation */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Génération de la scène</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {variantCount} variante{variantCount > 1 ? "s" : ""} générée{variantCount > 1 ? "s" : ""}.
                            Cliquez pour agrandir, cochez pour sélectionner.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed">
                            <div className="flex-1 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(referencePreview)}>
                                <img src={referencePreview} alt="Référence" className="w-full aspect-video object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-xs text-muted-foreground mt-1">Référence 🔍</p>
                            </div>
                            {tweaks.trim() && (
                                <div className="flex-1 flex flex-col justify-center text-sm text-muted-foreground">
                                    <p className="font-medium text-foreground mb-1">Retouches</p>
                                    <p className="text-xs italic line-clamp-6">{tweaks}</p>
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
                                notesPlaceholder="Notes additionnelles (ex: privilégier le bois clair, éviter le doré, ambiance d'automne…)"
                                generateLabel="scène"
                                onGenerate={handleGenerate}
                                agent="ambiance-scene-builder"
                                contextImage={refB64}
                                contextExtras={{ tweaks: tweaks || undefined, applyBrand }}
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
                            agent="ambiance-scene-builder"
                        />

                        {!loading && !generatedImages.length && (
                            <Button variant="outline" onClick={() => setStep(1)} className="w-full">← Retour</Button>
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
                                ? `${selectedImages.size} image${selectedImages.size > 1 ? "s" : ""} sélectionnée${selectedImages.size > 1 ? "s" : ""}`
                                : `${filledCount} image${filledCount > 1 ? "s" : ""} — tout sera téléchargé.`}
                        </p>
                        <p className="text-xs text-amber-700 mt-1">
                            💡 Astuce : téléchargez la scène, puis utilisez-la comme entrée dans l'agent <em>Produits dans scène</em>.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {generatedImages.map((img, idx) => img && (
                                <div key={idx} onClick={() => toggleSelect(idx)}
                                    className={`relative text-center cursor-pointer rounded-lg border-2 overflow-hidden transition-all hover:shadow-lg ${selectedImages.has(idx) ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"}`}>
                                    <img src={`data:image/png;base64,${img}`} alt={`Variante ${idx + 1}`}
                                        className="w-full aspect-video object-contain bg-white" />
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
        </div>
    );
}
