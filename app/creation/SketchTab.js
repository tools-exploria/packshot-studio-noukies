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

// Roles for base images (define the product)
const BASE_ROLE_OPTIONS = [
    { value: "sketch",    label: "Croquis / Dessin" },
    { value: "photo",     label: "Photo smartphone" },
    { value: "product",   label: "Packshot existant" },
];

// Roles for optional reference images (enrich the generation)
const REF_ROLE_OPTIONS = [
    { value: "existingProduct", label: "Produit existant" },
];

// Placeholders by reference role
const REF_PLACEHOLDERS = {
    existingProduct: "Que reprendre de ce produit ? Ex: la matiere velours vert, le zip dore...",
};

// ── Reusable card for a base image (with role selector) ─────
function BaseImageCard({ input, index, onUpdateRole, onUpdateDesc, onRemove }) {
    const role = IMAGE_ROLES[input.role];
    return (
        <div className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
            <div className="flex-shrink-0 relative">
                <img src={input.preview} alt={`Base ${index + 1}`}
                    className="w-24 h-24 object-contain rounded-md bg-white border" />
                <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold shadow">
                    {index + 1}
                </span>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                    <select
                        value={input.role}
                        onChange={(e) => onUpdateRole(e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
                    >
                        {BASE_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button onClick={onRemove}
                        className="text-destructive hover:text-destructive/80 text-xs font-medium ml-auto">
                        Supprimer
                    </button>
                </div>
                <input
                    type="text"
                    value={input.description}
                    onChange={(e) => onUpdateDesc(e.target.value)}
                    placeholder="Decrivez cette image pour aider le modele..."
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                    {role?.extract && <>Extraira : {role.extract}</>}
                    {role?.ignore && <> — Ignorera : {role.ignore}</>}
                </p>
            </div>
        </div>
    );
}

// ── Reusable card for a reference (product existant or fabric swatch) ─
function RefProductCard({ input, index, onUpdateRole, onUpdateDesc, onRemove }) {
    return (
        <div className="flex gap-3 items-start p-3 rounded-lg border bg-muted/30">
            <div className="flex-shrink-0 relative">
                <img src={input.preview} alt={`Ref ${index + 1}`}
                    className="w-24 h-24 object-contain rounded-md bg-white border" />
                <span className="absolute -top-2 -left-2 w-5 h-5 rounded-full bg-muted-foreground text-white text-[10px] flex items-center justify-center font-bold shadow">
                    R{index + 1}
                </span>
            </div>
            <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-center gap-2">
                    <select
                        value={input.role}
                        onChange={(e) => onUpdateRole(e.target.value)}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm font-medium"
                    >
                        {REF_ROLE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    <button onClick={onRemove}
                        className="text-destructive hover:text-destructive/80 text-xs font-medium ml-auto">
                        Supprimer
                    </button>
                </div>
                <input
                    type="text"
                    value={input.description}
                    onChange={(e) => onUpdateDesc(e.target.value)}
                    placeholder={REF_PLACEHOLDERS[input.role] || "Decrivez cette image..."}
                    className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
            </div>
        </div>
    );
}

export default function SketchTab() {
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

    // ── Base images (define the product — at least 1 required) ──
    const [baseInputs, setBaseInputs] = useState([]);

    // ── Reference images (optional — enrich generation) ──────────
    const [refInputs, setRefInputs] = useState([]);

    // ── Helpers ──────────────────────────────────────────────────
    const addImage = useCallback((f, list, setList, defaultRole) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setList((prev) => [
                ...prev,
                { file: f, preview: e.target.result, role: defaultRole, description: "" },
            ]);
        };
        reader.readAsDataURL(f);
    }, []);

    const updateField = useCallback((setList, idx, field, value) => {
        setList((prev) => prev.map((inp, i) => (i === idx ? { ...inp, [field]: value } : inp)));
    }, []);

    const removeFrom = useCallback((setList, idx) => {
        setList((prev) => prev.filter((_, i) => i !== idx));
    }, []);

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages,
        setLoading: () => { },
        setError,
    });

    // ── Generation handler ────────────────────────────────────
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!baseInputs.length) return;

        try {
            const allInputs = [...baseInputs, ...refInputs];
            const base64Data = await Promise.all(allInputs.map((inp) => fileToBase64(inp.file)));

            const inputs = allInputs.map((inp, i) => ({
                role: inp.role,
                data: base64Data[i],
                description: inp.description || undefined,
            }));

            const instruction = PROMPTS.sketchToPackshot(productNotes.trim());
            const legacy = buildLegacyPayload(inputs, instruction);

            const files = allInputs.map((inp) => inp.file);
            await runGenerate(legacy.prompt, files, model);
        } catch (err) {
            setError(err.message);
        }
    };

    // ── Can proceed? ──────────────────────────────────────────
    const canGenerate = baseInputs.length > 0;

    // ── Previews for reference strip ──────────────────────────
    const allInputs = [...baseInputs, ...refInputs];
    const allPreviews = allInputs.map((inp) => ({
        preview: inp.preview,
        label: IMAGE_ROLES[inp.role]?.label || inp.role,
    }));

    return (
        <>
            <details className="mb-4 text-sm">
                <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
                    Comment bien utiliser cet onglet ?
                </summary>
                <div className="mt-2 p-4 rounded-lg bg-muted/50 border space-y-2 text-muted-foreground text-[13px] leading-relaxed">
                    <p><span className="font-semibold text-foreground">1. Ajoutez au moins une base</span> — un croquis, une photo smartphone ou un packshot. Plus vous en ajoutez, mieux le modele comprendra le produit.</p>
                    <p><span className="font-semibold text-foreground">2. Choisissez le bon role</span> pour chaque image : un croquis sera interprete comme un guide de forme, une photo smartphone comme reference d'identite visuelle (couleurs, matieres).</p>
                    <p><span className="font-semibold text-foreground">3. Decrivez chaque image</span> — meme une phrase courte aide enormement. Ex : "Croquis vue de face d'une gigoteuse avec manches longues" ou "Photo de la gigoteuse grise prise sur un canape".</p>
                    <p><span className="font-semibold text-foreground">4. Produits de reference</span> — si vous voulez reprendre la matiere, la couleur ou les finitions d'un produit existant, ajoutez son packshot en section 2 et precisez ce que vous voulez en tirer. Ex : "Reprendre le velours vert sauge et le zip dore". Pour appliquer une matiere brute (swatch textile), utilisez plutot l'onglet <strong>"3D Produit"</strong>.</p>
                    <p><span className="font-semibold text-foreground">5. Utilisez les notes</span> a l'etape generation pour preciser des details que les images ne montrent pas (ex : "le zip est dore", "doublure interieure blanche").</p>
                </div>
            </details>

            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* ─── Step 0: Image Inputs ─────────────────────────── */}
            {step === 0 && (
                <div className="space-y-6">

                    {/* ── Base images (required) ──────────────────── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">1</span>
                                Base produit
                                <span className="text-xs font-normal text-destructive ml-1">obligatoire</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Les images qui definissent le produit : croquis, photo smartphone, packshot existant, fiche technique.
                                Vous pouvez en ajouter plusieurs pour que le modele comprenne mieux l'objet.
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {baseInputs.length > 0 && (
                                <div className="space-y-3">
                                    {baseInputs.map((inp, i) => (
                                        <BaseImageCard
                                            key={i}
                                            input={inp}
                                            index={i}
                                            onUpdateRole={(v) => updateField(setBaseInputs, i, "role", v)}
                                            onUpdateDesc={(v) => updateField(setBaseInputs, i, "description", v)}
                                            onRemove={() => removeFrom(setBaseInputs, i)}
                                        />
                                    ))}
                                </div>
                            )}
                            <UploadZone
                                onFile={(f) => addImage(f, baseInputs, setBaseInputs, "sketch")}
                                label={baseInputs.length === 0 ? "Ajoutez votre premiere base" : "Ajouter une autre base"}
                                sublabel="Croquis, photo smartphone, packshot..."
                            />
                        </CardContent>
                    </Card>

                    {/* ── Existing product references (optional) ──── */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold">2</span>
                                Produits existants de reference
                                <span className="text-xs font-normal text-muted-foreground ml-1">optionnel</span>
                            </CardTitle>
                            <p className="text-sm text-muted-foreground">
                                Packshot d'un produit existant dont le modele doit s'inspirer.
                                Decrivez ce que vous voulez reprendre : matiere, couleur, finitions, zip...
                            </p>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {refInputs.length > 0 && (
                                <div className="space-y-3">
                                    {refInputs.map((inp, i) => (
                                        <RefProductCard
                                            key={i}
                                            input={inp}
                                            index={i}
                                            onUpdateRole={(v) => updateField(setRefInputs, i, "role", v)}
                                            onUpdateDesc={(v) => updateField(setRefInputs, i, "description", v)}
                                            onRemove={() => removeFrom(setRefInputs, i)}
                                        />
                                    ))}
                                </div>
                            )}
                            <UploadZone
                                onFile={(f) => addImage(f, refInputs, setRefInputs, "existingProduct")}
                                label={refInputs.length === 0 ? "Ajouter un produit de reference" : "Ajouter un autre produit"}
                                sublabel="Packshot d'un produit existant du catalogue"
                                className="py-4"
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
                        <CardTitle>Generation — Sketch → Packshot</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {baseInputs.length} base{baseInputs.length > 1 ? "s" : ""}
                            {refInputs.length > 0 && ` + ${refInputs.length} reference${refInputs.length > 1 ? "s" : ""}`}
                            {" — "}chaque image a son role.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference strip with role labels */}
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
                                notesPlaceholder="Notes sur le produit (ex: le zip est dore, le tissu est du velours cotele...)"
                                generateLabel="sketch → packshot"
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
        </>
    );
}
