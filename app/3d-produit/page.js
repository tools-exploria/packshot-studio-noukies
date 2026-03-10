"use client";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Stepper, UploadZone } from "@/components/shared";
import { PROMPTS } from "@/lib/prompts";
import { fileToBase64, downloadImage, generateImages, MODELS } from "@/lib/api";
import { GalleryLightbox, SimpleLightbox } from "@/components/Lightbox";

const STEPS = ["Produit", "Pattern", "Génération"];

export default function ThreeDProduitPage() {
    const [step, setStep] = useState(0);

    // Step 0 — technical product sheet
    const [productFile, setProductFile] = useState(null);
    const [productPreview, setProductPreview] = useState(null);

    // Step 1 — fabric / texture image
    const [fabricFile, setFabricFile] = useState(null);
    const [fabricPreview, setFabricPreview] = useState(null);

    // Step 2 — generation
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [imageDims, setImageDims] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());
    const [variantCount, setVariantCount] = useState(2);
    const [resolution, setResolution] = useState("2K");
    const [aspectRatio, setAspectRatio] = useState("1:1");

    // Lightbox
    const [lightboxIdx, setLightboxIdx] = useState(null);
    const [refLightboxSrc, setRefLightboxSrc] = useState(null);

    const handleProductFile = useCallback((f) => {
        setProductFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setProductPreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    const handleFabricFile = useCallback((f) => {
        setFabricFile(f);
        const reader = new FileReader();
        reader.onload = (e) => setFabricPreview(e.target.result);
        reader.readAsDataURL(f);
    }, []);

    const handleGenerate = async (model = MODELS.FLASH) => {
        if (!productFile || !fabricFile) return;
        setLoading(true);
        setError(null);
        setGeneratedImages(Array(variantCount).fill(null));
        setSelectedImages(new Set());
        setImageDims(Array(variantCount).fill(null));
        try {
            const productB64 = await fileToBase64(productFile);
            const fabricB64 = await fileToBase64(fabricFile);

            const results = await generateImages({
                prompt: PROMPTS.product3D,
                images: [productB64, fabricB64],
                count: variantCount,
                model,
                resolution,
                aspectRatio,
                timeoutMs: 180_000,
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

    const getFileName = (i) => `swaddle-3d-variante-${i + 1}.png`;
    const filledCount = generatedImages.filter(Boolean).length;

    return (
        <div className="max-w-4xl mx-auto px-6 py-8">
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
                            Uploadez la fiche technique ou le schéma du produit (swaddle bag).
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
                            Uploadez une photo du tissu coton jacquard à appliquer sur le produit.
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
                            <div className="flex-1 text-center cursor-pointer" onClick={() => setRefLightboxSrc(productPreview)}>
                                <img
                                    src={productPreview}
                                    alt="Fiche technique"
                                    className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Structure 🔍</p>
                            </div>
                            <div className="flex-1 text-center cursor-pointer" onClick={() => setRefLightboxSrc(fabricPreview)}>
                                <img
                                    src={fabricPreview}
                                    alt="Tissu"
                                    className="w-full aspect-square object-contain rounded-md bg-white hover:ring-2 hover:ring-primary transition-all"
                                />
                                <p className="text-xs text-muted-foreground mt-1">Matière 🔍</p>
                            </div>
                        </div>

                        {/* Controls — only before first generation */}
                        {!generatedImages.length && !loading && (
                            <div className="space-y-4">
                                {/* Variant count */}
                                <div className="flex items-center gap-4">
                                    <label className="text-sm font-medium min-w-fit">Variantes</label>
                                    <input
                                        type="range"
                                        min={1}
                                        max={6}
                                        value={variantCount}
                                        onChange={(e) => setVariantCount(Number(e.target.value))}
                                        className="flex-1 accent-primary"
                                    />
                                    <span className="text-lg font-bold min-w-[2ch] text-center">{variantCount}</span>
                                </div>
                                {/* Resolution */}
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
                                {/* Aspect ratio */}
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
                                <Button onClick={() => handleGenerate(MODELS.FLASH)} className="w-full">
                                    ⚡ Générer {variantCount} visualisation{variantCount > 1 ? "s" : ""} 3D ({resolution}, {aspectRatio})
                                </Button>
                                <p className="text-xs text-muted-foreground text-center">Aperçu rapide via Flash — utilisez Régénérer pour la qualité Pro</p>
                            </div>
                        )}

                        {/* Image grid — progressive loading */}
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
                                            className={`relative rounded-lg border overflow-hidden transition-all ${img ? "cursor-pointer hover:shadow-lg" : "animate-pulse"} ${img && selectedImages.has(i) ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                        >
                                            {img ? (
                                                <>
                                                    <img
                                                        src={`data:image/png;base64,${img}`}
                                                        alt={`Variante ${i + 1}`}
                                                        className="w-full aspect-square object-contain bg-white"
                                                        onClick={() => setLightboxIdx(i)}
                                                    />
                                                    {/* Checkbox */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); toggleSelect(i); }}
                                                        className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold transition-all ${selectedImages.has(i) ? "bg-primary border-primary text-primary-foreground" : "bg-white/80 border-gray-300 hover:border-primary"}`}
                                                    >
                                                        {selectedImages.has(i) && "✓"}
                                                    </button>
                                                    {/* Download */}
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); downloadImage(img, getFileName(i)); }}
                                                        className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-sm shadow transition-all hover:scale-110"
                                                        title="Télécharger"
                                                    >
                                                        ⬇
                                                    </button>
                                                    {/* Label */}
                                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-3">
                                                        <span className="text-white text-sm font-medium">Variante {i + 1}</span>
                                                    </div>
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

                        {/* Actions after generation */}
                        {filledCount > 0 && !loading && (
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => handleGenerate(MODELS.FLASH)}>
                                    ⚡ Régénérer (Flash)
                                </Button>
                                <Button variant="outline" onClick={() => handleGenerate(MODELS.PRO)}>
                                    🔄 Régénérer (Pro)
                                </Button>
                            </div>
                        )}

                        <Button variant="outline" onClick={() => setStep(1)} className="w-full">
                            ← Retour
                        </Button>
                    </CardContent>
                </Card>
            )}

            {/* Gallery lightbox */}
            <GalleryLightbox
                images={generatedImages}
                imageDims={imageDims}
                lightboxIdx={lightboxIdx}
                setLightboxIdx={setLightboxIdx}
                onDownload={(idx) => downloadImage(generatedImages[idx], getFileName(idx))}
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
