"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS, SCENE_LABELS } from "@/lib/prompts";
import { fileToBase64, downloadImage, generateImages, MODELS } from "@/lib/api";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";

const STEPS = ["Produit", "Scène", "Génération", "Export"];

export default function AmbiancePage() {
    const [step, setStep] = useState(0);
    const [productFile, setProductFile] = useState(null);
    const [productPreview, setProductPreview] = useState(null);
    const [sceneType, setSceneType] = useState("baby_sitting");
    const [customPrompt, setCustomPrompt] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [imageDims, setImageDims] = useState([]);
    const [variantCount, setVariantCount] = useState(4);
    const [resolution, setResolution] = useState("2K");
    const [aspectRatio, setAspectRatio] = useState("1:1");
    // Product notes
    const [productNotes, setProductNotes] = useState("");
    // Lightbox
    const [lightboxIdx, setLightboxIdx] = useState(null);
    // Per-image edit
    const [editingIdx, setEditingIdx] = useState(null);
    const [editPrompt, setEditPrompt] = useState("");
    const [editLoading, setEditLoading] = useState(false);

    // Lightbox for reference images
    const [refLightboxSrc, setRefLightboxSrc] = useState(null);

    const handleProductFile = useCallback((f) => {
        setProductFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setProductPreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile) return;
        setLoading(true);
        setError(null);
        setGeneratedImages(Array(variantCount).fill(null));
        setSelectedImages(new Set());
        setImageDims(Array(variantCount).fill(null));
        try {
            const productB64 = await fileToBase64(productFile);
            let prompt;
            if (sceneType === "custom") {
                prompt = PROMPTS.ambianceCustom(customPrompt);
            } else {
                prompt = PROMPTS.ambiance[sceneType];
            }
            if (!prompt) throw new Error("Prompt vide");
            if (productNotes.trim()) prompt += `\n\nAdditional product notes: ${productNotes.trim()}`;

            const results = await generateImages({
                prompt,
                images: [productB64],
                count: variantCount,
                model,
                resolution,
                aspectRatio,
                onProgress: (i, image) => {
                    setGeneratedImages((prev) => {
                        const next = [...prev];
                        next[i] = image;
                        return next;
                    });
                    const img = new Image();
                    img.onload = () => {
                        setImageDims((prev) => {
                            const next = [...prev];
                            next[i] = { w: img.naturalWidth, h: img.naturalHeight };
                            return next;
                        });
                    };
                    img.src = `data:image/png;base64,${image}`;
                },
            });

            if (!results.length) setError("Aucune image générée");
            setGeneratedImages(results.length ? results : []);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Per-image edit
    const handleEditImage = async (idx, model = MODELS.PRO) => {
        if (!editPrompt.trim() || !generatedImages[idx]) return;
        setEditLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt: editPrompt.trim(), images: [generatedImages[idx]], model }),
            });
            const data = await res.json();
            if (data.status === "success" && data.image) {
                setGeneratedImages((prev) => [...prev, data.image]);
                const img = new Image();
                img.onload = () => setImageDims((prev) => [...prev, { w: img.naturalWidth, h: img.naturalHeight }]);
                img.src = `data:image/png;base64,${data.image}`;
                setEditingIdx(null);
                setEditPrompt("");
            } else {
                setError(`Modification échouée: ${data.error || "Pas d'image"}`);
            }
        } catch (err) {
            setError(`Modification échouée: ${err.message}`);
        } finally {
            setEditLoading(false);
        }
    };

    const toggleSelect = (idx) => {
        setSelectedImages((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const toggleSelectAll = () => {
        const filled = generatedImages.filter(Boolean);
        if (selectedImages.size === filled.length) {
            setSelectedImages(new Set());
        } else {
            setSelectedImages(new Set(generatedImages.map((img, i) => (img ? i : -1)).filter((i) => i >= 0)));
        }
    };

    const filledCount = generatedImages.filter(Boolean).length;

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
                                <button
                                    key={key}
                                    onClick={() => setSceneType(key)}
                                    className={`text-left p-3 rounded-lg border transition-all ${sceneType === key ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}
                                >
                                    <span className="font-medium text-sm">{label}</span>
                                </button>
                            ))}
                            <button
                                onClick={() => setSceneType("custom")}
                                className={`text-left p-3 rounded-lg border transition-all ${sceneType === "custom" ? "border-primary bg-primary/5 shadow-sm" : "hover:border-primary/30 hover:bg-accent/50"}`}
                            >
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
                            <div className="flex-1 text-center cursor-pointer" onClick={() => setRefLightboxSrc(productPreview)}>
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
                            <div className="space-y-4">
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Variantes</label>
                                    <input
                                        type="range"
                                        min={1}
                                        max={10}
                                        value={variantCount}
                                        onChange={(e) => setVariantCount(Number(e.target.value))}
                                        className="flex-1 accent-primary"
                                    />
                                    <span className="text-lg font-bold min-w-[2ch] text-center">{variantCount}</span>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Résolution</label>
                                    <div className="flex gap-2 flex-1">
                                        {["1K", "2K", "4K"].map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setResolution(r)}
                                                className={`flex-1 py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${resolution === r ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-input"}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Ratio</label>
                                    <div className="flex gap-2 flex-1 flex-wrap">
                                        {["1:1", "4:3", "3:4", "16:9", "9:16"].map((r) => (
                                            <button
                                                key={r}
                                                onClick={() => setAspectRatio(r)}
                                                className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${aspectRatio === r ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-input"}`}
                                            >
                                                {r}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                {/* Product-specific notes */}
                                <div className="space-y-1">
                                    <label className="text-sm font-medium">Notes produit (optionnel)</label>
                                    <textarea
                                        value={productNotes}
                                        onChange={(e) => setProductNotes(e.target.value)}
                                        placeholder="Ex: Le produit doit être au premier plan, bien visible. L'ambiance doit être chaleureuse."
                                        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] resize-y"
                                        rows={2}
                                    />
                                    <p className="text-[11px] text-muted-foreground">Ajoutez des précisions spécifiques pour améliorer le résultat.</p>
                                </div>
                                <Button onClick={() => handleGenerate(MODELS.FLASH)} className="w-full">
                                    ⚡ Générer {variantCount} photo{variantCount > 1 ? "s" : ""} ({resolution}, {aspectRatio})
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">Aperçu rapide via Flash — utilisez Régénérer pour la qualité Pro</p>
                            </div>
                        )}

                        {/* Image grid */}
                        {(generatedImages.length > 0 || loading) && (
                            <div className="space-y-3">
                                {filledCount > 0 && (
                                    <div className="flex items-center justify-between">
                                        <button onClick={toggleSelectAll} className="text-sm text-primary hover:underline">
                                            {selectedImages.size === filledCount ? "Tout désélectionner" : "Tout sélectionner"}
                                        </button>
                                        <span className="text-sm text-muted-foreground">{selectedImages.size} sélectionnée{selectedImages.size > 1 ? "s" : ""}</span>
                                    </div>
                                )}
                                <div className="grid grid-cols-2 gap-4">
                                    {generatedImages.map((img, i) => (
                                        <div
                                            key={i}
                                            className={`relative rounded-lg border overflow-hidden transition-all ${img ? "cursor-pointer hover:shadow-lg" : "animate-pulse"
                                                } ${img && selectedImages.has(i) ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                        >
                                            {img ? (
                                                <>
                                                    <img
                                                        src={`data:image/png;base64,${img}`}
                                                        alt={`Variante ${i + 1}`}
                                                        className="w-full aspect-square object-contain bg-white"
                                                        onClick={() => setLightboxIdx(i)}
                                                    />
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSelect(i); }}
                                                        className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold transition-all ${selectedImages.has(i)
                                                            ? "bg-primary border-primary text-primary-foreground"
                                                            : "bg-white/80 border-gray-300 hover:border-primary"
                                                            }`}
                                                    >
                                                        {selectedImages.has(i) && "✓"}
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); downloadImage(img, pipeline.getFileName(i)); }}
                                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-sm shadow transition-all hover:scale-110"
                                                        title="Télécharger"
                                                    >
                                                        ⬇
                                                    </button>
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-3 flex items-center justify-between">
                                                        <span className="text-white text-sm font-medium">Variante {i + 1}</span>
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setEditingIdx(editingIdx === i ? null : i); setEditPrompt(""); }}
                                                            className="text-white/80 hover:text-white text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 transition-all"
                                                            title="Modifier cette image"
                                                        >
                                                            ✏️ Modifier
                                                        </button>
                                                    </div>
                                                    {editingIdx === i && (
                                                        <div className="absolute left-0 right-0 bottom-10 p-2 bg-background border-t" onClick={(e) => e.stopPropagation()}>
                                                            <div className="flex gap-1">
                                                                <input
                                                                    type="text"
                                                                    value={editPrompt}
                                                                    onChange={(e) => setEditPrompt(e.target.value)}
                                                                    onKeyDown={(e) => { if (e.key === "Enter" && editPrompt.trim()) handleEditImage(i); }}
                                                                    placeholder="Décrivez la modification…"
                                                                    className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                                    autoFocus
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    disabled={editLoading || !editPrompt.trim()}
                                                                    onClick={() => handleEditImage(i, MODELS.FLASH)}
                                                                    className="text-xs h-7"
                                                                    title="Rapide (Flash)"
                                                                >
                                                                    {editLoading ? "…" : "⚡"}
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    disabled={editLoading || !editPrompt.trim()}
                                                                    onClick={() => handleEditImage(i, MODELS.PRO)}
                                                                    className="text-xs h-7"
                                                                    title="Qualité (Pro)"
                                                                >
                                                                    {editLoading ? "…" : "Pro"}
                                                                </Button>
                                                            </div>
                                                            {error && error.startsWith("Modification") && (
                                                                <p className="text-xs text-destructive mt-1">{error}</p>
                                                            )}
                                                        </div>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="aspect-square bg-muted flex items-center justify-center">
                                                    <div className="text-center">
                                                        <div className="animate-spin text-2xl mb-2">⏳</div>
                                                        <p className="text-sm text-muted-foreground">Génération...</p>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        {filledCount > 0 && !loading && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => handleGenerate(MODELS.FLASH)}>
                                    ⚡ Régénérer (Flash)
                                </Button>
                                <Button variant="outline" onClick={() => handleGenerate(MODELS.PRO)}>
                                    🔄 Régénérer (Pro)
                                </Button>
                                <Button onClick={() => setStep(3)} className="flex-1">
                                    Export →
                                </Button>
                            </div>
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
                                ? `${selectedImages.size} image${selectedImages.size > 1 ? "s" : ""} sélectionnée${selectedImages.size > 1 ? "s" : ""} — cliquez pour dé/sélectionner`
                                : `${filledCount} image${filledCount > 1 ? "s" : ""} — tout sera téléchargé. Cliquez pour en sélectionner.`}
                        </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {generatedImages.map((img, idx) => img && (
                                <div
                                    key={idx}
                                    onClick={() => toggleSelect(idx)}
                                    className={`relative text-center cursor-pointer rounded-lg border-2 overflow-hidden transition-all hover:shadow-lg ${selectedImages.has(idx) ? "border-primary ring-2 ring-primary ring-offset-2" : "border-transparent"
                                        }`}
                                >
                                    <img
                                        src={`data:image/png;base64,${img}`}
                                        alt={`Variante ${idx + 1}`}
                                        className="w-full aspect-square object-contain bg-white"
                                    />
                                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shadow transition-all ${selectedImages.has(idx) ? "bg-primary text-primary-foreground" : "bg-white/80 text-muted-foreground"
                                        }`}>
                                        {selectedImages.has(idx) ? "✓" : idx + 1}
                                    </div>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setLightboxIdx(idx); }}
                                        className="absolute top-2 right-2 w-6 h-6 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-xs shadow"
                                        title="Agrandir"
                                    >🔍</button>
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

                        {/* Simple download buttons — no background processing for ambiance */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const indices = selectedImages.size > 0
                                            ? [...selectedImages].sort()
                                            : generatedImages.map((img, i) => img ? i : -1).filter(i => i >= 0);
                                        for (let n = 0; n < indices.length; n++) {
                                            const idx = indices[n];
                                            const dims = imageDims[idx];
                                            const dimStr = dims ? `${dims.w}x${dims.h}` : resolution;
                                            downloadImage(generatedImages[idx], `ambiance_${idx + 1}_${dimStr}.png`);
                                            if (n < indices.length - 1) await new Promise(r => setTimeout(r, 300));
                                        }
                                    } catch (err) { setError(err.message); }
                                    finally { setLoading(false); }
                                }}
                                disabled={loading}
                                className="w-full"
                                size="lg"
                            >
                                {loading ? "Préparation..." : selectedImages.size > 0 ? `⬇ PNG (${selectedImages.size})` : `⬇ PNG (${filledCount})`}
                            </Button>
                            <Button
                                onClick={async () => {
                                    setLoading(true);
                                    try {
                                        const indices = selectedImages.size > 0
                                            ? [...selectedImages].sort()
                                            : generatedImages.map((img, i) => img ? i : -1).filter(i => i >= 0);
                                        const { jsPDF } = await import("jspdf");
                                        const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                                        const pageW = pdf.internal.pageSize.getWidth();
                                        const pageH = pdf.internal.pageSize.getHeight();
                                        const margin = 10;
                                        for (let n = 0; n < indices.length; n++) {
                                            if (n > 0) pdf.addPage();
                                            const maxW = pageW - margin * 2;
                                            const maxH = pageH - margin * 2;
                                            const imgSize = Math.min(maxW, maxH);
                                            const x = (pageW - imgSize) / 2;
                                            const y = (pageH - imgSize) / 2;
                                            pdf.addImage(`data:image/png;base64,${generatedImages[indices[n]]}`, "PNG", x, y, imgSize, imgSize);
                                        }
                                        pdf.save("noukies_ambiance.pdf");
                                    } catch (err) { setError(err.message); }
                                    finally { setLoading(false); }
                                }}
                                disabled={loading}
                                variant="outline"
                                size="lg"
                            >
                                {loading ? "Préparation..." : selectedImages.size > 0 ? `📄 PDF (${selectedImages.size})` : `📄 PDF (${filledCount})`}
                            </Button>
                        </div>

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
                onDownload={(idx) => {
                    const dims = imageDims[idx];
                    const dimStr = dims ? `${dims.w}x${dims.h}` : resolution;
                    downloadImage(generatedImages[idx], `ambiance_${idx + 1}_${dimStr}.png`);
                }}
                selectedImages={selectedImages}
                toggleSelect={toggleSelect}
            />

            {/* Reference lightbox */}
            <SimpleLightbox
                src={refLightboxSrc}
                onClose={() => setRefLightboxSrc(null)}
            />
        </div>
    );
}
