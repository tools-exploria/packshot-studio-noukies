"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS, SCENE_LABELS, STRUCTURED_SCENE_LABELS } from "@/lib/prompts";
import { downloadImage, MODELS } from "@/lib/api";
import { useExportPipeline } from "@/hooks/useExportPipeline";
import { ExportPanel } from "@/components/ExportPanel";
import { GenerationControls } from "@/components/GenerationControls";
import { ImageGrid } from "@/components/ImageGrid";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";
import { useGenerationPage } from "@/hooks/useGenerationPage";

const STEPS = ["Produit", "Scène", "Génération", "Export"];

const PLACEMENT_OPTIONS = [
    { value: "on the bed", label: "Sur le lit" },
    { value: "on a shelf", label: "Sur une étagère" },
    { value: "draped on a chair", label: "Drapé sur une chaise" },
    { value: "in the crib", label: "Dans le berceau" },
    { value: "on the changing table", label: "Sur la table à langer" },
];

const BABY_AGE_OPTIONS = [
    { value: "newborn", label: "Nouveau-né (0-1 mois)" },
    { value: "3-6-months", label: "3-6 mois" },
    { value: "6-12-months", label: "6-12 mois" },
];

const OUTDOOR_TYPE_OPTIONS = [
    { value: "garden", label: "Jardin" },
    { value: "park-walk", label: "Balade au parc" },
    { value: "morning-terrace", label: "Terrasse du matin" },
];

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

    // New structured scene controls
    const [productPlacement, setProductPlacement] = useState("on the bed");
    const [babyAge, setBabyAge] = useState("3-6-months");
    const [outdoorType, setOutdoorType] = useState("garden");
    const [sceneMood, setSceneMood] = useState("");

    const pipeline = useExportPipeline({
        generatedImages, imageDims, resolution, aspectRatio, selectedImages, setLoading, setError,
    });

    // Helper to get display label for current scene
    const getSceneLabel = () => {
        if (sceneType === "custom") return "Prompt personnalisé";
        if (SCENE_LABELS[sceneType]) return SCENE_LABELS[sceneType];
        if (STRUCTURED_SCENE_LABELS[sceneType]) return STRUCTURED_SCENE_LABELS[sceneType];
        return sceneType;
    };

    // ── Generation handler (ambiance-specific prompt assembly) ──
    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile) return;
        let prompt;

        if (sceneType === "custom") {
            prompt = PROMPTS.ambianceCustom(customPrompt);
        } else if (sceneType === "nursery_scene") {
            prompt = PROMPTS.nurseryScene(productPlacement, sceneMood.trim() || "", productNotes.trim() || "");
        } else if (sceneType === "baby_scene") {
            prompt = PROMPTS.babyScene(babyAge, sceneMood.trim() || "", productNotes.trim() || "");
        } else if (sceneType === "outdoor_scene") {
            prompt = PROMPTS.outdoorScene(outdoorType, sceneMood.trim() || "", productNotes.trim() || "");
        } else {
            prompt = PROMPTS.ambiance[sceneType];
        }

        if (!prompt) { setError("Prompt vide"); return; }

        // Append notes for legacy presets and custom (structured scenes handle notes internally)
        if (!["nursery_scene", "baby_scene", "outdoor_scene"].includes(sceneType) && productNotes.trim()) {
            prompt += `\n\nAdditional product notes: ${productNotes.trim()}`;
        }

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
                        {/* Legacy presets */}
                        <div>
                            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wide">Templates rapides</p>
                            <div className="grid grid-cols-1 gap-2">
                                {Object.entries(SCENE_LABELS).map(([key, label]) => (
                                    <button key={key} onClick={() => setSceneType(key)}
                                        className={`text-left p-3 rounded-lg border transition-all ${sceneType === key ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}>
                                        <span className="font-medium text-sm">{label}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
                            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">Scènes avancées</span></div>
                        </div>

                        {/* New structured scenes */}
                        <div className="grid grid-cols-1 gap-2">
                            {Object.entries(STRUCTURED_SCENE_LABELS).map(([key, label]) => (
                                <button key={key} onClick={() => setSceneType(key)}
                                    className={`text-left p-3 rounded-lg border transition-all ${sceneType === key ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}>
                                    <span className="font-medium text-sm">{label}</span>
                                    {key === "baby_scene" && <span className="text-xs text-muted-foreground ml-2">— anti uncanny valley</span>}
                                </button>
                            ))}
                        </div>

                        {/* Sub-controls for structured scenes */}
                        {sceneType === "nursery_scene" && (
                            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                                <div className="space-y-2">
                                    <Label className="text-xs">Placement du produit</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {PLACEMENT_OPTIONS.map((opt) => (
                                            <button key={opt.value} onClick={() => setProductPlacement(opt.value)}
                                                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${productPlacement === opt.value ? "border-primary bg-primary/10 font-medium" : "hover:border-primary/30"}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Ambiance (optionnel)</Label>
                                    <input type="text" value={sceneMood} onChange={(e) => setSceneMood(e.target.value)}
                                        placeholder="Ex: lumière dorée du matin, ambiance cocooning..."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                </div>
                            </div>
                        )}

                        {sceneType === "baby_scene" && (
                            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                                <div className="space-y-2">
                                    <Label className="text-xs">Âge du bébé</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {BABY_AGE_OPTIONS.map((opt) => (
                                            <button key={opt.value} onClick={() => setBabyAge(opt.value)}
                                                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${babyAge === opt.value ? "border-primary bg-primary/10 font-medium" : "hover:border-primary/30"}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Ambiance (optionnel)</Label>
                                    <input type="text" value={sceneMood} onChange={(e) => setSceneMood(e.target.value)}
                                        placeholder="Ex: tendre et paisible, moment de jeu..."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                </div>
                            </div>
                        )}

                        {sceneType === "outdoor_scene" && (
                            <div className="space-y-3 p-3 rounded-lg bg-muted/50 border">
                                <div className="space-y-2">
                                    <Label className="text-xs">Type de scène</Label>
                                    <div className="flex flex-wrap gap-2">
                                        {OUTDOOR_TYPE_OPTIONS.map((opt) => (
                                            <button key={opt.value} onClick={() => setOutdoorType(opt.value)}
                                                className={`px-3 py-1.5 rounded-full text-xs border transition-all ${outdoorType === opt.value ? "border-primary bg-primary/10 font-medium" : "hover:border-primary/30"}`}>
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Ambiance (optionnel)</Label>
                                    <input type="text" value={sceneMood} onChange={(e) => setSceneMood(e.target.value)}
                                        placeholder="Ex: lumière fraîche du matin, ambiance automnale..."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
                                </div>
                            </div>
                        )}

                        {/* Custom prompt */}
                        <button onClick={() => setSceneType("custom")}
                            className={`w-full text-left p-3 rounded-lg border transition-all ${sceneType === "custom" ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}>
                            <span className="font-medium text-sm">✏️ Prompt personnalisé</span>
                        </button>

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
                                <p className="text-sm font-medium text-center">{getSceneLabel()}</p>
                                {sceneType === "nursery_scene" && (
                                    <p className="text-xs text-muted-foreground">{PLACEMENT_OPTIONS.find(o => o.value === productPlacement)?.label}</p>
                                )}
                                {sceneType === "baby_scene" && (
                                    <p className="text-xs text-muted-foreground">{BABY_AGE_OPTIONS.find(o => o.value === babyAge)?.label}</p>
                                )}
                                {sceneType === "outdoor_scene" && (
                                    <p className="text-xs text-muted-foreground">{OUTDOOR_TYPE_OPTIONS.find(o => o.value === outdoorType)?.label}</p>
                                )}
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
