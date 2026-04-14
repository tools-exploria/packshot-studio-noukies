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
import { IMAGE_ROLES, buildLegacyPayload } from "@/lib/interleaved";

const STEPS = ["Images", "Generation", "Export"];

export default function PliagePage() {
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

    // ── Arrangement reference (1, required) ─────────────────
    const [arrangementInput, setArrangementInput] = useState(null);

    // ── Garments to fold (1+, required) ─────────────────────
    const [garmentInputs, setGarmentInputs] = useState([]);

    const handleArrangementUpload = useCallback((f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setArrangementInput({
                file: f,
                preview: e.target.result,
                role: "arrangement",
                description: "",
            });
        };
        reader.readAsDataURL(f);
    }, []);

    const handleGarmentUpload = useCallback((f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setGarmentInputs((prev) => [
                ...prev,
                { file: f, preview: e.target.result, role: "garment", description: "" },
            ]);
        };
        reader.readAsDataURL(f);
    }, []);

    const updateArrangementDesc = useCallback((description) => {
        setArrangementInput((prev) => prev ? { ...prev, description } : prev);
    }, []);

    const updateGarmentDesc = useCallback((idx, description) => {
        setGarmentInputs((prev) => prev.map((inp, i) => (i === idx ? { ...inp, description } : inp)));
    }, []);

    const removeGarment = useCallback((idx) => {
        setGarmentInputs((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => { },
        setError,
    });

    // ── Generation handler ────────────────────────────────────
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!arrangementInput || !garmentInputs.length) return;

        try {
            const allInputs = [arrangementInput, ...garmentInputs];
            const base64Data = await Promise.all(allInputs.map((inp) => fileToBase64(inp.file)));

            const inputs = allInputs.map((inp, i) => ({
                role: inp.role,
                data: base64Data[i],
                description: inp.description || undefined,
            }));

            const instruction = PROMPTS.pliage(garmentInputs.length, productNotes.trim());
            const legacy = buildLegacyPayload(inputs, instruction);

            const files = allInputs.map((inp) => inp.file);
            await runGenerate(legacy.prompt, files, model);
        } catch (err) {
            setError(err.message);
        }
    };

    // ── Can proceed? ──────────────────────────────────────────
    const canGenerate = arrangementInput && garmentInputs.length > 0;

    // ── Previews for reference strip ──────────────────────────
    const allInputs = [arrangementInput, ...garmentInputs].filter(Boolean);
    const allPreviews = allInputs.map((inp) => ({
        preview: inp.preview,
        label: IMAGE_ROLES[inp.role]?.label || inp.role,
    }));

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <div className="mb-6">
                <h1 className="text-2xl font-bold">Pliage & Disposition</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Plie et dispose des vetements selon un arrangement de reference pour generer un packshot catalogue.
                </p>
                <details className="mt-3 text-sm">
                    <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                        Comment bien utiliser cet outil ?
                    </summary>
                    <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-2 text-muted-foreground text-[13px] leading-relaxed">
                        <p><span className="font-semibold text-foreground">1. Choisissez un arrangement de reference</span> — un packshot existant qui montre le style de pliage/disposition souhaite (flat lay, superpose, plie en pile...). Le modele reproduira cette mise en scene.</p>
                        <p><span className="font-semibold text-foreground">2. Ajoutez les vetements a plier</span> — les packshots individuels de chaque vetement. Le modele gardera leur identite exacte (couleurs, motifs, matieres) mais les pliera selon la reference.</p>
                        <p><span className="font-semibold text-foreground">3. Decrivez les images</span> — decrivez l'arrangement ("Pyjama 2 pieces plie a plat, pantalon pose sur le haut") et chaque vetement ("Haut blanc a motifs dinosaures", "Pantalon velours bleu").</p>
                        <p><span className="font-semibold text-foreground">4. Utilisez les notes</span> pour preciser des details : "le pantalon doit etre au premier plan", "plier les manches vers l'interieur".</p>
                    </div>
                </details>
            </div>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* ─── Step 0: Image Inputs ─────────────────────────── */}
            {step === 0 && (
                <div className="space-y-6">

                    {/* ── Arrangement reference (required, 1) ────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                                Reference d'arrangement
                                <span className="text-xs font-normal text-destructive ml-1">obligatoire</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Un packshot montrant le style de pliage ou de disposition souhaite.
                                Le modele reproduira cette mise en scene avec vos vetements.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            <UploadZone
                                onFile={handleArrangementUpload}
                                label="Packshot d'arrangement (obligatoire)"
                                sublabel="Un exemple de vetements plies/disposes comme vous le souhaitez"
                                preview={arrangementInput?.preview}
                            />
                            {arrangementInput && (
                                <div>
                                    <label className="text-xs font-medium text-muted-foreground mb-1 block">
                                        Decrivez cette disposition
                                    </label>
                                    <input
                                        type="text"
                                        value={arrangementInput.description}
                                        onChange={(e) => updateArrangementDesc(e.target.value)}
                                        placeholder={"Ex: Pyjama 2 pieces plie a plat, pantalon pose sur le cote droit du haut"}
                                        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                    />
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* ── Garments to fold (required, 1+) ─────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">2</span>
                                Vetements a plier
                                <span className="text-xs font-normal text-destructive ml-1">obligatoire</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Les packshots individuels de chaque vetement. Le modele conservera leur identite
                                exacte (couleurs, motifs, matieres) et les pliera selon la reference.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {garmentInputs.length > 0 && (
                                <div className="space-y-3">
                                    {garmentInputs.map((inp, i) => (
                                        <div key={i} className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
                                            <div className="flex-shrink-0 relative">
                                                <img src={inp.preview} alt={`Vetement ${i + 1}`}
                                                    className="w-24 h-24 object-contain rounded-md bg-white border" />
                                                <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shadow">
                                                    {i + 1}
                                                </span>
                                            </div>
                                            <div className="flex-1 space-y-2 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm font-medium text-muted-foreground">Vetement {i + 1}</span>
                                                    <button onClick={() => removeGarment(i)}
                                                        className="text-destructive hover:text-destructive/80 text-xs font-medium ml-auto">
                                                        Supprimer
                                                    </button>
                                                </div>
                                                <input
                                                    type="text"
                                                    value={inp.description}
                                                    onChange={(e) => updateGarmentDesc(i, e.target.value)}
                                                    placeholder={"Decrivez ce vetement (ex: Haut blanc a motifs dinosaures, coton jersey)"}
                                                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            <UploadZone
                                onFile={handleGarmentUpload}
                                label={garmentInputs.length === 0 ? "Ajoutez votre premier vetement" : "Ajouter un autre vetement"}
                                sublabel="Packshot individuel du vetement a plier/disposer"
                            />
                        </CardContent>
                    </Card>

                    <Button onClick={() => setStep(1)} disabled={!canGenerate} className="w-full">
                        Continuer vers la generation →
                    </Button>
                </div>
            )}

            {/* ─── Step 1: Generation ───────────────────────────── */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Generation — Pliage</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            1 reference d'arrangement + {garmentInputs.length} vetement{garmentInputs.length > 1 ? "s" : ""} a plier.
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
                                        {i === 0 ? "Arrangement" : `Vetement ${i}`}
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
                                {allInputs.map((inp, i) => {
                                    const role = IMAGE_ROLES[inp.role];
                                    return (
                                        <div key={i} className="flex gap-2">
                                            <span className="font-mono font-bold text-primary">{i + 1}.</span>
                                            <div>
                                                <span className="font-medium">{role?.label || inp.role}</span>
                                                {inp.description && <span className="text-muted-foreground"> — {inp.description}</span>}
                                                <br />
                                                <span className="text-muted-foreground">Extraire: {role?.extract}</span>
                                                {role?.ignore && <><br /><span className="text-destructive/70">Ignorer: {role?.ignore}</span></>}
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
                                notesPlaceholder="Notes (ex: pantalon au premier plan, manches pliees vers l'interieur...)"
                                generateLabel="pliage"
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
