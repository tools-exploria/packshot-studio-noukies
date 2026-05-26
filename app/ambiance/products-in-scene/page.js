"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, UploadZone } from "@/components/shared";
import { fileToBase64, downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";
import { PROMPTS } from "@/lib/prompts";
import { IMAGE_ROLES, buildInterleavedParts } from "@/lib/interleaved";
import { ReformulableInput, ReformulableTextarea } from "@/components/Reformulable";

const STEPS = ["Scène + Produits", "Génération", "Export"];

const PRODUCT_PLACEHOLDERS = [
    "Ex: Gigoteuse en jersey gris avec broderie lapin, à poser dans le berceau ou sur le lit",
    "Ex: Doudou lapin blanc en coton, à placer sur le lit ou dans les bras d'un fauteuil",
    "Ex: Mobile musical avec oursons et étoiles, à suspendre ou à poser sur l'étagère",
    "Ex: Pyjama velours bleu ciel, à plier sur la commode ou draper sur la chaise",
    "Ex: Peluche ours brun en velours, assise sur une étagère ou au pied du lit",
    "Ex: Coussin nuage en lin beige, sur le fauteuil ou intégré à la literie",
];

export default function ProductsInScenePage() {
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
        runGenerateParts,
        handleEditImage,
        toggleSelect,
        toggleSelectAll,
    } = useGenerationPage({ defaultAspectRatio: "16:9" });

    // ── Scene reference (1, required) ─────────────────────────
    const [sceneInput, setSceneInput] = useState(null);

    // ── Scene tweaks (optional) — explicit modifications to the scene at this step
    //    to avoid round-trips back to /ambiance/scene-builder when a small adjustment is needed.
    const [sceneTweaks, setSceneTweaks] = useState("");

    // ── Products to place (1+, required) ──────────────────────
    const [productInputs, setProductInputs] = useState([]);

    const handleSceneUpload = useCallback((f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setSceneInput({
                file: f,
                preview: e.target.result,
                role: "scene",
                // No `description` — the manifest already labels the image as
                // SCENE / ENVIRONMENT REFERENCE with extract/ignore rules. Asking
                // the user to describe the scene was redundant + confusing.
                // Actionable scene changes go in sceneTweaks, not here.
            });
        };
        reader.readAsDataURL(f);
    }, []);

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

    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!sceneInput || !productInputs.length) return;

        try {
            const allInputs = [sceneInput, ...productInputs];
            const base64Data = await Promise.all(allInputs.map((inp) => fileToBase64(inp.file)));

            const inputs = allInputs.map((inp, i) => ({
                role: inp.role,
                data: base64Data[i],
                description: inp.description || undefined,
            }));

            const instruction = PROMPTS.productsInScene(
                productInputs.length,
                productNotes.trim(),
                sceneTweaks.trim(),
            );
            const parts = buildInterleavedParts(inputs, instruction);

            await runGenerateParts(parts, model);
        } catch (err) {
            setError(err.message);
        }
    };

    const canGenerate = sceneInput && productInputs.length > 0;
    const allInputs = [sceneInput, ...productInputs].filter(Boolean);

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            {/* Sub-nav */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
                <a href="/ambiance" className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">Scène produit</a>
                <a href="/ambiance/room-scene" className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">Scène chambre</a>
                <a href="/ambiance/scene-builder" className="px-3 py-1.5 text-sm font-medium rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/80 transition-colors">Créer une scène</a>
                <a href="/ambiance/products-in-scene" className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-primary/10 text-primary">Produits dans scène</a>
            </div>

            <div className="mb-6">
                <h1 className="text-2xl font-bold">Produits dans une scène</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Intégrez plusieurs produits Noukies dans une scène fournie. La scène sert d'inspiration
                    (mood, lumière, palette) — le modèle a la latitude d'adapter cadrage et composition
                    pour bien présenter les produits.
                </p>
                <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                        Comment bien utiliser cet outil ?
                    </summary>
                    <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-2 text-muted-foreground text-[13px] leading-relaxed">
                        <p><span className="font-semibold text-foreground">1. Uploadez une scène</span> — soit générée via <em>Créer une scène</em>, soit une vraie photo, soit un Pinterest. Elle définit l'atmosphère.</p>
                        <p><span className="font-semibold text-foreground">2. Ajoutez vos produits</span> — packshots détourés. Le modèle préserve leur identité exacte (couleurs, motifs, matières).</p>
                        <p><span className="font-semibold text-foreground">3. Décrivez chaque image</span> — ça aide le modèle à comprendre le contexte. Pour la scène, décrivez l'ambiance ; pour chaque produit, ce qu'il est.</p>
                        <p><span className="font-semibold text-foreground">4. La scène n'est pas figée</span> — le modèle peut zoomer, recadrer, ajuster la lumière pour bien intégrer les produits. C'est voulu.</p>
                    </div>
                </details>
            </div>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* Step 0: Inputs */}
            {step === 0 && (
                <div className="space-y-6">
                    {/* Scene reference */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                                Scène de référence
                                <span className="text-xs font-normal text-destructive ml-1">obligatoire</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                L'image qui inspire l'ambiance, la lumière et la palette du résultat final.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <UploadZone
                                onFile={handleSceneUpload}
                                label="Image de scène"
                                sublabel="Scène générée, photo d'intérieur, mood board…"
                                preview={sceneInput?.preview}
                            />
                            {sceneInput && (
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                        Modifications de la scène (optionnel)
                                    </label>
                                    <ReformulableTextarea
                                        value={sceneTweaks}
                                        onChange={setSceneTweaks}
                                        placeholder="Ex: mur plus chaud (terracotta clair), retirer le tableau au-dessus du lit, ajouter une lampe à gauche, lumière plus dorée…"
                                        className="min-h-[80px]"
                                        rows={3}
                                        context={{ agent: "ambiance-products-in-scene", role: "sceneTweaks", extras: { productCount: productInputs.length } }}
                                        image={sceneInput.preview?.split(",")[1]}
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Products */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
                                Produits à intégrer
                                <span className="text-xs font-normal text-destructive ml-1">min. 1 produit</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Packshots détourés des produits Noukies. Leur identité (couleur, matière, motif)
                                sera préservée à 100 %.
                            </p>
                            <p className="text-xs text-amber-600 mt-1">
                                Jusqu'à 6 produits pour une fidélité optimale (max 14).
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
                                                <ReformulableInput
                                                    value={inp.description}
                                                    onChange={(v) => updateProductDesc(i, v)}
                                                    placeholder={PRODUCT_PLACEHOLDERS[i % PRODUCT_PLACEHOLDERS.length]}
                                                    context={{ agent: "ambiance-products-in-scene", role: "description", extras: { field: "product", index: i } }}
                                                    image={inp.preview?.split(",")[1]}
                                                    disableReformulate
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <UploadZone
                                onFile={handleProductUpload}
                                label={productInputs.length === 0 ? "Ajoutez votre premier produit" : "Ajouter un autre produit"}
                                sublabel="Packshot détouré (PNG/JPG fond blanc de préférence)"
                            />
                        </CardContent>
                    </Card>

                    <Button onClick={() => setStep(1)} disabled={!canGenerate} className="w-full">
                        Continuer vers la génération →
                    </Button>
                </div>
            )}

            {/* Step 1: Generation */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Génération</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            1 scène + {productInputs.length} produit{productInputs.length > 1 ? "s" : ""} à intégrer.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference strip */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed overflow-x-auto">
                            {allInputs.map((inp, i) => (
                                <div key={i} className="flex-shrink-0 w-24 text-center cursor-pointer"
                                    onClick={() => pipeline.setRefLightboxSrc(inp.preview)}>
                                    <img src={inp.preview} alt={IMAGE_ROLES[inp.role]?.label}
                                        className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                    <p className="text-[10px] text-muted-foreground mt-1 leading-tight truncate">
                                        {i === 0 ? "Scène" : `Produit ${i}`}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {/* Manifest */}
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                                Voir le manifeste d'images
                            </summary>
                            <div className="mt-2 p-3 rounded-lg bg-muted text-xs space-y-2">
                                {allInputs.map((inp, i) => {
                                    const role = IMAGE_ROLES[inp.role];
                                    return (
                                        <div key={i} className="flex gap-2">
                                            <span className="font-mono font-bold text-primary">{i + 1}.</span>
                                            <div>
                                                <span className="font-medium">{role?.label || inp.role}</span>
                                                {inp.description && <span className="text-muted-foreground"> — {inp.description}</span>}
                                                <br />
                                                <span className="text-muted-foreground">Extraire : {role?.extract}</span>
                                                {role?.ignore && <><br /><span className="text-destructive/70">Ignorer : {role?.ignore}</span></>}
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
                                notesPlaceholder="Notes (ex: la gigoteuse dans le berceau, le doudou en premier plan, lumière plus douce…)"
                                generateLabel="scène"
                                onGenerate={handleGenerate}
                                agent="ambiance-products-in-scene"
                                contextImage={sceneInput?.preview?.split(",")[1]}
                                contextExtras={{ productCount: productInputs.length }}
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
                            agent="ambiance-products-in-scene"
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
