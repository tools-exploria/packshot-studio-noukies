"use client";
import { Button } from "@/components/ui/button";
import { LoadingDots } from "@/components/shared";
import { downloadImage } from "@/lib/api";

/**
 * Available export sizes. Each carries :
 *   - label    : semantic name (matches the GENERATION_PRESETS naming in
 *                useGenerationPage.js, so the mental bridge between
 *                "generate at Packshot 4:5" and "export at Packshot 4:5"
 *                is obvious)
 *   - subLabel : raw dimensions for clarity
 *   - ratio    : aspect ratio (w/h) used to detect mismatch with generation
 */
const EXPORT_SIZES = [
    { value: "",           label: "Natif",         subLabel: "taille d'origine", ratio: null },
    { value: "1024x1024",  label: "Carré 1K",      subLabel: "1024×1024",        ratio: 1 },
    { value: "2048x2048",  label: "Carré 2K",      subLabel: "2048×2048",        ratio: 1 },
    { value: "4096x4096",  label: "Carré 4K",      subLabel: "4096×4096",        ratio: 1 },
    { value: "1560x2000",  label: "Packshot 4:5",  subLabel: "1560×2000",        ratio: 1560 / 2000 },
    { value: "2048x1152",  label: "Bannière 16:9", subLabel: "2048×1152",        ratio: 2048 / 1152 },
    { value: "1152x2048",  label: "Story 9:16",    subLabel: "1152×2048",        ratio: 1152 / 2048 },
];

function parseGenRatio(r) {
    if (!r) return null;
    const [a, b] = r.split(":").map(Number);
    return a && b ? a / b : null;
}

/**
 * Shared export panel UI: background mode, chroma key picker, resize, download buttons.
 * The generation aspect ratio is read from pipeline.generationAspectRatio so all 12
 * consumer pages get the export mismatch warning for free without prop drilling.
 */
export function ExportPanel({ pipeline, generatedImages, loading, filledCount, selectedImages }) {
    const {
        bgMode, setBgMode,
        chromaColor, setChromaColor,
        greenScreenImages,
        detouredImages,
        detourProgress,
        regeneratingIdx,
        exportSize, setExportSize,
        refLightboxSrc, setRefLightboxSrc,
        generateGreenScreen, generateAllGreenScreens,
        getFileName,
        handleExport, handleExportJPG, handleExportPDF,
        generationAspectRatio,
    } = pipeline;

    // Per-tile download — lets the user grab a ready image individually even
    // when other images in the batch are still loading or have failed.
    const downloadGreenScreenTile = (idx) => {
        const img = greenScreenImages[idx];
        if (!img) return;
        downloadImage(img, getFileName(idx, "png"));
    };

    return (
        <div className="space-y-4">
            {/* Background mode */}
            <div className="space-y-2">
                <label className="text-sm font-medium">Fond</label>
                <div className="flex gap-2">
                    {[
                        { key: "original", label: "Original", icon: "🖼️" },
                        { key: "white", label: "Fond blanc", icon: "⬜" },
                        { key: "transparent", label: "Transparent", icon: "🔲" },
                    ].map(({ key, label, icon }) => (
                        <button
                            key={key}
                            onClick={() => setBgMode(key)}
                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border-2 transition-all ${bgMode === key ? "bg-primary/10 border-primary text-primary" : "border-input hover:border-primary/30 hover:bg-accent"}`}
                        >
                            {icon} {label}
                        </button>
                    ))}
                </div>

                {/* Fond blanc — AI generates directly on white */}
                {bgMode === "white" && (
                    <div className="space-y-3 mt-2">
                        <Button
                            variant="outline"
                            onClick={generateAllGreenScreens}
                            disabled={loading || !!detourProgress || regeneratingIdx !== null}
                            className="w-full"
                        >
                            {detourProgress ? (
                                <span className="inline-flex items-center gap-1.5">
                                    Génération fond blanc {detourProgress} <LoadingDots />
                                </span>
                            ) : Object.keys(greenScreenImages).length > 0
                                ? `🔄 Régénérer le fond blanc`
                                : `⬜ Préparer le fond blanc`}
                        </Button>
                        {(detourProgress || regeneratingIdx !== null || Object.keys(greenScreenImages).length > 0) && (
                            <GreenScreenGrid
                                generatedImages={generatedImages}
                                greenScreenImages={greenScreenImages}
                                loading={loading || !!detourProgress || regeneratingIdx !== null}
                                regeneratingIdx={regeneratingIdx}
                                selectedImages={selectedImages}
                                label="Aperçu fond blanc"
                                bgStyle="bg-white"
                                onRegenerate={generateGreenScreen}
                                onZoom={(src) => setRefLightboxSrc(src)}
                                onDownload={downloadGreenScreenTile}
                            />
                        )}
                    </div>
                )}

                {/* Transparent — chroma key picker */}
                {bgMode === "transparent" && (
                    <div className="space-y-3 mt-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-muted-foreground">Couleur clé :</span>
                            {[
                                { key: "green", hex: "#00FF00", label: "Vert" },
                                { key: "magenta", hex: "#FF00FF", label: "Magenta" },
                                { key: "blue", hex: "#0000FF", label: "Bleu" },
                            ].map(({ key, hex, label }) => (
                                <button
                                    key={key}
                                    onClick={() => setChromaColor(key)}
                                    className={`flex items-center gap-1.5 py-1 px-2.5 rounded-md text-xs font-medium border transition-all ${chromaColor === key ? "border-primary ring-1 ring-primary" : "border-input hover:border-primary/30"}`}
                                >
                                    <span className="w-3 h-3 rounded-full inline-block border" style={{ background: hex }} />
                                    {label}
                                </button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            onClick={generateAllGreenScreens}
                            disabled={loading || !!detourProgress || regeneratingIdx !== null}
                            className="w-full"
                        >
                            {detourProgress ? (
                                <span className="inline-flex items-center gap-1.5">
                                    Génération fond {detourProgress} <LoadingDots />
                                </span>
                            ) : Object.keys(greenScreenImages).length > 0
                                ? `🔄 Régénérer le fond`
                                : `🎨 Préparer le détourage`}
                        </Button>
                        {(detourProgress || regeneratingIdx !== null || Object.keys(greenScreenImages).length > 0) && (
                            <GreenScreenGrid
                                generatedImages={generatedImages}
                                greenScreenImages={greenScreenImages}
                                loading={loading || !!detourProgress || regeneratingIdx !== null}
                                regeneratingIdx={regeneratingIdx}
                                selectedImages={selectedImages}
                                label="Aperçu fonds"
                                bgStyle={chromaColor === "green" ? "#00FF00" : chromaColor === "magenta" ? "#FF00FF" : "#0000FF"}
                                chromaBg
                                onRegenerate={generateGreenScreen}
                                onZoom={(src) => setRefLightboxSrc(src)}
                                onDownload={downloadGreenScreenTile}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Optional resize */}
            <div className="space-y-2">
                <div className="flex items-start gap-4">
                    <label className="text-sm font-medium min-w-fit pt-2">Redimensionner</label>
                    <div className="flex gap-2 flex-1 flex-wrap">
                        {EXPORT_SIZES.map(({ value, label, subLabel }) => (
                            <button
                                key={value || "native"}
                                onClick={() => setExportSize(value)}
                                className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-all flex flex-col items-center leading-tight ${exportSize === value ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-input"}`}
                            >
                                <span>{label}</span>
                                {subLabel && (
                                    <span className={`text-[10px] font-normal mt-0.5 ${exportSize === value ? "opacity-80" : "text-muted-foreground"}`}>
                                        {subLabel}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>
                {(() => {
                    const genRatio = parseGenRatio(generationAspectRatio);
                    const selected = EXPORT_SIZES.find((s) => s.value === exportSize);
                    const mismatch =
                        selected && selected.ratio && genRatio &&
                        Math.abs(selected.ratio - genRatio) > 0.05;
                    if (!mismatch) return null;

                    // Suggest a compatible export size if one exists for the
                    // current generation ratio. Names match the GENERATION_PRESETS
                    // for instant mental matching.
                    const compatibleSize = EXPORT_SIZES.find(
                        (s) => s.ratio && Math.abs(s.ratio - genRatio) <= 0.05,
                    );
                    return (
                        <div className="flex gap-2 text-xs bg-amber-50 border border-amber-200 text-amber-800 rounded-md p-2.5 leading-snug">
                            <span aria-hidden>⚠️</span>
                            <span>
                                Cette taille a un ratio différent de votre génération
                                ({generationAspectRatio}) — l'image sera <strong>rognée sur les
                                bords</strong>.{" "}
                                {compatibleSize ? (
                                    <>
                                        Pour exporter sans perte, choisissez{" "}
                                        <strong>{compatibleSize.label}</strong> ({compatibleSize.subLabel}),
                                        ou regénérez avec le préset correspondant à la taille souhaitée
                                        (boutons en haut de la section Génération).
                                    </>
                                ) : (
                                    <>
                                        Pour exporter sans perte, regénérez avec le préset correspondant
                                        à la taille souhaitée (boutons en haut de la section Génération).
                                    </>
                                )}
                            </span>
                        </div>
                    );
                })()}
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-3 gap-3">
                <Button onClick={handleExport} disabled={loading || !!detourProgress || regeneratingIdx !== null} className="w-full" size="lg">
                    {detourProgress
                        ? <span className="inline-flex items-center gap-1.5">{detourProgress} <LoadingDots /></span>
                        : loading
                            ? <LoadingDots />
                            : selectedImages.size > 0
                                ? `⬇ PNG (${selectedImages.size})`
                                : `⬇ PNG (${filledCount})`}
                </Button>
                <Button onClick={handleExportJPG} disabled={loading || !!detourProgress || regeneratingIdx !== null} className="w-full" size="lg" variant="outline">
                    {detourProgress
                        ? <span className="inline-flex items-center gap-1.5">{detourProgress} <LoadingDots /></span>
                        : loading
                            ? <LoadingDots />
                            : selectedImages.size > 0
                                ? `⬇ JPG (${selectedImages.size})`
                                : `⬇ JPG (${filledCount})`}
                </Button>
                <Button onClick={handleExportPDF} disabled={loading || !!detourProgress || regeneratingIdx !== null} variant="outline" size="lg">
                    {detourProgress
                        ? <span className="inline-flex items-center gap-1.5">{detourProgress} <LoadingDots /></span>
                        : loading
                            ? <LoadingDots />
                            : selectedImages.size > 0
                                ? `📄 PDF (${selectedImages.size})`
                                : `📄 PDF (${filledCount})`}
                </Button>
            </div>
        </div>
    );
}

// Internal sub-component: green screen preview grid
function GreenScreenGrid({ generatedImages, greenScreenImages, loading, regeneratingIdx, selectedImages, label, bgStyle, chromaBg, onRegenerate, onZoom, onDownload }) {
    const hasSelection = selectedImages && selectedImages.size > 0;
    const inCurrentBatch = (idx) => !hasSelection || selectedImages.has(idx);
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{label} — 🔄 relancer • ⬇ télécharger</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {generatedImages.map((img, idx) => {
                    if (!img) return null;
                    const ready = !!greenScreenImages[idx];
                    const isRegenerating = regeneratingIdx === idx;
                    if (!ready && (!loading || !inCurrentBatch(idx)) && !isRegenerating) return null;
                    return (
                        <div key={idx} className={`relative rounded-md overflow-hidden border ${ready ? "cursor-pointer" : ""} ${isRegenerating || !ready ? "animate-pulse" : ""}`} onClick={ready ? () => onZoom(`data:image/png;base64,${greenScreenImages[idx]}`) : undefined}>
                            {ready ? (
                                <img
                                    src={`data:image/png;base64,${greenScreenImages[idx]}`}
                                    alt={`Fond ${idx + 1}`}
                                    className={`w-full aspect-square object-contain ${chromaBg ? "" : "bg-white"}`}
                                    style={chromaBg ? { background: bgStyle } : undefined}
                                />
                            ) : (
                                <div className={`w-full aspect-square flex items-center justify-center ${chromaBg ? "" : "bg-muted"}`} style={chromaBg ? { background: bgStyle } : undefined}>
                                    <div className="bg-black/40 rounded-full px-2 py-1 text-white">
                                        <LoadingDots />
                                    </div>
                                </div>
                            )}
                            {ready && isRegenerating && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center text-white">
                                    <LoadingDots className="scale-150" />
                                </div>
                            )}
                            {ready && (
                                <>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onRegenerate(idx); }}
                                        disabled={loading}
                                        className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-xs shadow disabled:opacity-50"
                                        title="Relancer"
                                    >{isRegenerating ? <LoadingDots /> : "🔄"}</button>
                                    {onDownload && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); onDownload(idx); }}
                                            className="absolute bottom-7 right-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-xs shadow"
                                            title="Télécharger cette image"
                                        >⬇</button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onZoom(`data:image/png;base64,${greenScreenImages[idx]}`); }}
                                        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-xs shadow"
                                        title="Agrandir"
                                    >🔍</button>
                                </>
                            )}
                            <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] text-center py-0.5">V{idx + 1}</div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
