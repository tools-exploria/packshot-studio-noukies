"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Stepper, UploadZone } from "@/components/shared";
import { fileToBase64, downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { PROMPTS } from "@/lib/prompts";
import { IMAGE_ROLES, buildLegacyPayload } from "@/lib/interleaved";

const STEPS = ["Produits", "Génération", "Export"];

const PRODUCT_PLACEHOLDERS = [
    "Ex: Mobile musical avec oursons et étoiles, à suspendre au-dessus du berceau",
    "Ex: Pyjama velours bleu ciel, à plier sur l'étagère ou draper sur la chaise",
    "Ex: Gigoteuse en jersey gris avec broderie lapin, à poser dans le berceau",
    "Ex: Peluche ours brun en velours, à placer assis sur l'étagère à côté des livres",
    "Ex: Doudou lapin blanc en coton, à poser sur le lit ou dans le berceau",
    "Ex: Coussin nuage en lin beige, à disposer sur le fauteuil ou dans le lit",
];

export default function RoomScenePage() {
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
        lightboxIdx, setLightboxIdx,
        editingIdx, setEditingIdx,
        editPrompt, setEditPrompt,
        editLoading,
        filledCount,
        runGenerate,
        handleEditImage,
        toggleSelect,
        toggleSelectAll,
    } = useGenerationPage();

    // ── Mood (optional) ──────────────────────────────────────
    const [sceneMood, setSceneMood] = useState("");

    // ── Products to place in the room (1+, required) ─────────
    const [productInputs, setProductInputs] = useState([]);

    const handleProductUpload = useCallback((f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setProductInputs((prev) => [
                ...prev,
                { file: f, preview: e.target.result, role: "roomProduct", description: "" },
            ]);
        };
        reader.readAsDataURL(f);
    }, []);

    const updateProductDesc = useCallback((idx, description) => {
        setProductInputs((prev) => prev.map((inp, i) => (i === idx ? { ...inp, description } : inp)));
    }, []);

    const removeProduct = useCallback((idx) => {
        setProductInputs((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => { },
        setError,
    });

    // ── Generation handler ────────────────────────────────────
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productInputs.length) return;

        try {
            const base64Data = await Promise.all(productInputs.map((inp) => fileToBase64(inp.file)));

            const inputs = productInputs.map((inp, i) => ({
                role: inp.role,
                data: base64Data[i],
                description: inp.description || undefined,
            }));

            const instruction = PROMPTS.roomScene(productInputs.length, sceneMood.trim() || "", productNotes.trim());
            const legacy = buildLegacyPayload(inputs, instruction);

            const files = productInputs.map((inp) => inp.file);
            await runGenerate(legacy.prompt, files, model);
        } catch (err) {
            setError(err.message);
        }
    };

    // ── Can proceed? ──────────────────────────────────────────
    const canGenerate = productInputs.length > 0;

    // ── Previews for reference strip ──────────────────────────
    const allPreviews = productInputs.map((inp, i) => ({
        preview: inp.preview,
        label: inp.description || `Produit ${i + 1}`,
    }));

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Ambiance tabs */}
            <div className="flex items-center gap-3 mb-6">
                <a href="/ambiance"
                    className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">
                    Scène produit
                </a>
                <a href="/ambiance/room-scene"
                    className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary/10 text-primary">
                    Scène chambre
                </a>
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-bold">Scène chambre multi-produits</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Placez plusieurs produits Noukies dans une chambre bébé stylée pour générer une photo d'ambiance grand angle.
                </p>
            </div>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* ─── Step 0: Product Inputs ──────────────────────── */}
            {step === 0 && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                                Produits à placer dans la chambre
                                <span className="text-xs font-normal text-destructive ml-1">min. 1 produit</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Ajoutez les packshots des produits Noukies à mettre en scène.
                                Tous les produits seront placés naturellement dans une chambre bébé.
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                                Jusqu'à 6 produits pour une fidélité optimale. Au-delà de 6 (max 14), la qualité de reproduction peut diminuer.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {productInputs.length > 0 && (
                                <div className="space-y-3">
                                    {productInputs.map((inp, i) => (
                                        <div key={i} className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
                                            <div className="flex-shrink-0 relative">
                                                <img src={inp.preview} alt={`Produit ${i + 1}`}
                                                    className="w-24 h-24 object-contain rounded-md bg-white border" />
                                                <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shadow">
                                                    {i + 1}
                                                </span>
                                            </div>
                                            <div className="flex-1 space-y-2 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-muted-foreground">Produit {i + 1}</span>
                                                    <button onClick={() => removeProduct(i)}
                                                        className="text-destructive hover:text-destructive/80 text-xs font-medium ml-auto">
                                                        Supprimer
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={inp.description}
                                                    onChange={(e) => updateProductDesc(i, e.target.value)}
                                                    placeholder={PRODUCT_PLACEHOLDERS[i % PRODUCT_PLACEHOLDERS.length]}
                                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <UploadZone
                                onFile={handleProductUpload}
                                label={productInputs.length === 0 ? "Ajoutez votre premier produit" : "Ajouter un autre produit"}
                                sublabel="Packshot détouré du produit (PNG ou JPG, fond blanc)"
                            />
                        </CardContent>
                    </Card>

                    {/* ── Optional mood ────────────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold">2</span>
                                Ambiance
                                <span className="text-xs font-normal text-muted-foreground ml-1">optionnel</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <input
                                type="text"
                                value={sceneMood}
                                onChange={(e) => setSceneMood(e.target.value)}
                                placeholder="Ex: lumière dorée du matin, ambiance cocooning, tons chauds..."
                                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            />
                        </CardContent>
                    </Card>

                    <Button onClick={() => setStep(1)} disabled={!canGenerate} className="w-full">
                        Continuer vers la génération →
                    </Button>
                </div>
            )}

            {/* ─── Step 1: Generation ───────────────────────────── */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Génération — Scène chambre</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {productInputs.length} produit{productInputs.length > 1 ? "s" : ""} à placer dans la chambre.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference strip */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed overflow-x-auto">
                            {allPreviews.map((ref, i) => (
                                <div key={i} className="flex-shrink-0 w-24 text-center cursor-pointer"
                                    onClick={() => pipeline.setRefLightboxSrc(ref.preview)}>
                                    <img src={ref.preview} alt={ref.label}
                                        className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight truncate" title={ref.label}>
                                        {ref.label}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Show manifest */}
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Voir le manifeste d'images
                            </summary>
                            <div className="mt-2 p-3 rounded-lg bg-muted text-xs space-y-2">
                                {productInputs.map((inp, i) => {
                                    const role = IMAGE_ROLES[inp.role];
                                    return (
                                        <div key={i} className="flex gap-2">
                                            <span className="font-mono font-bold text-primary">{i + 1}.</span>
                                            <div>
                                                <span className="font-medium">{role?.label || inp.role}</span>
                                                {inp.description && <span className="text-muted-foreground"> — {inp.description}</span>}
                                                <br />
                                                <span className="text-muted-foreground">Extraire: {role?.extract}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </details>

                        {!generatedImages.length && !loading && (
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Notes (ex: la gigoteuse dans le lit, le doudou sur l'étagère...)"
                                generateLabel="scène chambre"
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

            {/* ─── Step 2: Export ────────────────────────────────── */}
            {step === 2 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Export & téléchargement</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {selectedImages.size > 0
                                ? `${selectedImages.size} image${selectedImages.size > 1 ? "s" : ""} sélectionnée${selectedImages.size > 1 ? "s" : ""}`
                                : `${filledCount} image${filledCount > 1 ? "s" : ""} — tout sera téléchargé.`}
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
