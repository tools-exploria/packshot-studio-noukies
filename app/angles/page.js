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

const STEPS = ["Photos référence", "Angle", "Génération", "Export"];

const ANGLE_OPTIONS = [
    { key: "front", label: "Face", desc: "Vue frontale, caméra perpendiculaire" },
    { key: "3/4-face", label: "3/4 Face", desc: "45° avant-gauche, perspective légère" },
    { key: "profile", label: "Profil", desc: "90° latéral, profondeur du produit" },
    { key: "3/4-dos", label: "3/4 Dos", desc: "45° arrière-droit" },
    { key: "dos", label: "Dos", desc: "Vue arrière, fermetures" },
    { key: "flat-lay", label: "Flat Lay", desc: "Vue du dessus, produit à plat" },
    { key: "bottom", label: "Dessous", desc: "Vue du dessous, semelle / base" },
    { key: "detail-macro", label: "Détail Macro", desc: "Gros plan texture, coutures, broderie" },
];

const VIEW_LABELS = [
    { value: "front view", label: "Vue de face" },
    { value: "side view", label: "Vue de profil" },
    { value: "back view", label: "Vue de dos" },
    { value: "three-quarter view", label: "Vue 3/4" },
    { value: "top-down view", label: "Vue du dessus" },
    { value: "bottom view", label: "Vue du dessous" },
    { value: "detail / close-up", label: "Détail / gros plan" },
];

const REF_ROLES = [
    { value: "same", label: "Même produit, autre angle" },
    { value: "structure", label: "Produit similaire (structure seulement)" },
];

export default function AnglesPage() {
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

    // ── Angles-specific state ────────────────────────────────────
    const [angleType, setAngleType] = useState("front");
    const [detailFocus, setDetailFocus] = useState("");

    // Multi-ref: extra reference images beyond the main product upload
    const [extraRefs, setExtraRefs] = useState([]); // [{file, preview, viewLabel, role}]

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages, setLoading, setError,
    });

    const handleAddRef = useCallback((f) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            setExtraRefs((prev) => [...prev, { file: f, preview: e.target.result, viewLabel: "", role: "same" }]);
        };
        reader.readAsDataURL(f);
    }, []);

    const handleRemoveRef = (idx) => {
        setExtraRefs((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleRefLabel = (idx, label) => {
        setExtraRefs((prev) => prev.map((r, i) => i === idx ? { ...r, viewLabel: label } : r));
    };

    const handleRefRole = (idx, role) => {
        setExtraRefs((prev) => prev.map((r, i) => i === idx ? { ...r, role } : r));
    };

    // ── Generation handler ───────────────────────────────────────
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile) return;

        // Build file array and ref descriptors
        const files = [productFile, ...extraRefs.map((r) => r.file)];
        const descriptions = extraRefs.length > 0
            ? [
                { label: "main reference view", role: "identity" },
                ...extraRefs.map((r) => ({
                    label: r.viewLabel || "additional view",
                    role: r.role === "structure" ? "structure" : "identity",
                })),
            ]
            : null;

        const prompt = PROMPTS.alternateAngle(angleType, detailFocus.trim(), productNotes.trim() || "", descriptions);
        await runGenerate(prompt, files, model);
    };

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
            <Stepper steps={STEPS} currentStep={step} />

            {error && (
                <div className="bg-destructive/10 text-destructive rounded-lg p-4 mb-6 text-sm">{error}</div>
            )}

            {/* Step 0: Product upload (multi-ref) */}
            {step === 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Photos de référence du produit</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            Uploadez une ou plusieurs photos du même produit sous différents angles.
                            Plus vous fournissez de vues, plus le résultat sera fidèle.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Main product photo */}
                        <div>
                            <Label className="text-xs text-muted-foreground mb-1 block">Photo principale *</Label>
                            <UploadZone
                                onFile={handleProductFile}
                                label="Photo principale du produit"
                                sublabel="PNG ou JPG — la vue principale de référence"
                                preview={productPreview}
                            />
                        </div>

                        {/* Extra references */}
                        {extraRefs.length > 0 && (
                            <div className="space-y-3">
                                <Label className="text-xs text-muted-foreground">Photos supplémentaires</Label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                    {extraRefs.map((ref, idx) => (
                                        <div key={idx} className={`relative rounded-lg border p-2 space-y-2 ${ref.role === "structure" ? "bg-amber-50 border-amber-200" : "bg-muted/30"}`}>
                                            <img src={ref.preview} alt={`Ref ${idx + 2}`}
                                                className="w-full aspect-square object-contain rounded-md bg-white" />
                                            <select
                                                value={ref.role}
                                                onChange={(e) => handleRefRole(idx, e.target.value)}
                                                className="w-full text-xs rounded border border-input bg-background px-2 py-1 font-medium"
                                            >
                                                {REF_ROLES.map((r) => (
                                                    <option key={r.value} value={r.value}>{r.label}</option>
                                                ))}
                                            </select>
                                            <select
                                                value={ref.viewLabel}
                                                onChange={(e) => handleRefLabel(idx, e.target.value)}
                                                className="w-full text-xs rounded border border-input bg-background px-2 py-1"
                                            >
                                                <option value="">Type de vue...</option>
                                                {VIEW_LABELS.map((l) => (
                                                    <option key={l.value} value={l.value}>{l.label}</option>
                                                ))}
                                            </select>
                                            {ref.role === "structure" && (
                                                <p className="text-[10px] text-amber-600">Forme/structure seulement — couleur ignorée</p>
                                            )}
                                            <button onClick={() => handleRemoveRef(idx)}
                                                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center text-xs hover:bg-destructive"
                                                title="Retirer">×</button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Add more refs */}
                        {productFile && (
                            <div className="border border-dashed rounded-lg p-3">
                                <UploadZone
                                    onFile={handleAddRef}
                                    label="+ Ajouter une vue supplémentaire"
                                    sublabel="Dos, profil, détail... (optionnel, jusqu'à 13 photos)"
                                    preview={null}
                                />
                            </div>
                        )}

                        {productFile && (
                            <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                                {extraRefs.length === 0
                                    ? "1 photo — le modèle devra imaginer les angles non visibles. Ajoutez d'autres vues pour un résultat plus fidèle."
                                    : `${1 + extraRefs.length} photo${extraRefs.length > 0 ? "s" : ""} de référence — le modèle combinera toutes les vues pour comprendre la structure 3D du produit.`
                                }
                            </div>
                        )}

                        <Button onClick={() => setStep(1)} disabled={!productFile} className="w-full">
                            Continuer →
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Step 1: Angle selection */}
            {step === 1 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Choix de l&apos;angle à générer</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {1 + extraRefs.length} photo{extraRefs.length > 0 ? "s" : ""} de référence chargée{extraRefs.length > 0 ? "s" : ""}.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 gap-2">
                            {ANGLE_OPTIONS.map((opt) => (
                                <button key={opt.key} onClick={() => setAngleType(opt.key)}
                                    className={`text-left p-3 rounded-lg border transition-all ${angleType === opt.key ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}>
                                    <span className="font-medium text-sm">{opt.label}</span>
                                    <span className="text-xs text-muted-foreground ml-2">— {opt.desc}</span>
                                </button>
                            ))}
                        </div>

                        {angleType === "detail-macro" && (
                            <div className="space-y-2">
                                <Label>Détail à cibler</Label>
                                <input
                                    type="text"
                                    value={detailFocus}
                                    onChange={(e) => setDetailFocus(e.target.value)}
                                    placeholder="Ex: broderie sur le chest, texture du tissu, fermeture éclair..."
                                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                                />
                            </div>
                        )}

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
                        <CardTitle>Génération — angle {ANGLE_OPTIONS.find(o => o.key === angleType)?.label}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                            {variantCount} variante{variantCount > 1 ? "s" : ""} à partir de {1 + extraRefs.length} référence{extraRefs.length > 0 ? "s" : ""}.
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Reference thumbnails */}
                        <div className="flex gap-3 p-3 rounded-lg bg-muted/50 border border-dashed overflow-x-auto">
                            <div className="flex-shrink-0 w-24 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(productPreview)}>
                                <img src={productPreview} alt="Principale" className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                <p className="text-[10px] text-muted-foreground mt-1">Principale 🔍</p>
                            </div>
                            {extraRefs.map((ref, idx) => (
                                <div key={idx} className="flex-shrink-0 w-24 text-center cursor-pointer" onClick={() => pipeline.setRefLightboxSrc(ref.preview)}>
                                    <img src={ref.preview} alt={`Ref ${idx + 2}`} className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all" />
                                    <p className="text-[10px] text-muted-foreground mt-1">{ref.viewLabel || `Ref ${idx + 2}`} 🔍</p>
                                </div>
                            ))}
                            <div className="flex-shrink-0 w-24 flex flex-col items-center justify-center">
                                <p className="text-sm font-medium">{ANGLE_OPTIONS.find(o => o.key === angleType)?.label}</p>
                                <p className="text-[10px] text-muted-foreground text-center">{ANGLE_OPTIONS.find(o => o.key === angleType)?.desc}</p>
                            </div>
                        </div>

                        {!generatedImages.length && !loading && (
                            <GenerationControls
                                variantCount={variantCount} setVariantCount={setVariantCount}
                                resolution={resolution} setResolution={setResolution}
                                aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                                activePreset={activePreset} applyPreset={applyPreset} clearPreset={clearPreset}
                                productNotes={productNotes} setProductNotes={setProductNotes}
                                notesPlaceholder="Ex: Le produit a un motif rayé qui doit continuer sur les côtés. Fermeture éclair au dos."
                                generateLabel="angle"
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
