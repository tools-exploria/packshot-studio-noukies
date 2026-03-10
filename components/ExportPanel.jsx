"use client";
import { Button } from "@/components/ui/button";

/**
 * Shared export panel UI: background mode, chroma key picker, resize, download buttons.
 *
 * @param {Object} props
 * @param {Object} props.pipeline - return value of useExportPipeline()
 * @param {string[]} props.generatedImages - base64 images
 * @param {boolean} props.loading
 * @param {number} props.filledCount - count of non-null generated images
 * @param {Set} props.selectedImages
 */
export function ExportPanel({ pipeline, generatedImages, loading, filledCount, selectedImages }) {
    const {
        bgMode, setBgMode,
        chromaColor, setChromaColor,
        greenScreenImages,
        detouredImages,
        detourProgress,
        exportSize, setExportSize,
        refLightboxSrc, setRefLightboxSrc,
        generateGreenScreen, generateAllGreenScreens,
        handleExport, handleExportPDF,
    } = pipeline;

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
                            disabled={loading}
                            className="w-full"
                        >
                            {loading && detourProgress
                                ? `Génération fond blanc ${detourProgress}...`
                                : Object.keys(greenScreenImages).length > 0
                                    ? `🔄 Régénérer le fond blanc`
                                    : `⬜ Préparer le fond blanc`}
                        </Button>
                        {Object.keys(greenScreenImages).length > 0 && (
                            <GreenScreenGrid
                                generatedImages={generatedImages}
                                greenScreenImages={greenScreenImages}
                                loading={loading}
                                label="Aperçu fond blanc"
                                bgStyle="bg-white"
                                onRegenerate={generateGreenScreen}
                                onZoom={(src) => setRefLightboxSrc(src)}
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
                            disabled={loading}
                            className="w-full"
                        >
                            {loading && detourProgress
                                ? `Génération fond ${detourProgress}...`
                                : Object.keys(greenScreenImages).length > 0
                                    ? `🔄 Régénérer le fond`
                                    : `🎨 Préparer le détourage`}
                        </Button>
                        {Object.keys(greenScreenImages).length > 0 && (
                            <GreenScreenGrid
                                generatedImages={generatedImages}
                                greenScreenImages={greenScreenImages}
                                loading={loading}
                                label="Aperçu fonds"
                                bgStyle={chromaColor === "green" ? "#00FF00" : chromaColor === "magenta" ? "#FF00FF" : "#0000FF"}
                                chromaBg
                                onRegenerate={generateGreenScreen}
                                onZoom={(src) => setRefLightboxSrc(src)}
                            />
                        )}
                    </div>
                )}
            </div>

            {/* Optional resize */}
            <div className="flex items-center gap-4">
                <label className="text-sm font-medium min-w-fit">Redimensionner</label>
                <div className="flex gap-2 flex-1 flex-wrap">
                    {["", "1024x1024", "2048x2048", "4096x4096"].map((size) => (
                        <button
                            key={size || "native"}
                            onClick={() => setExportSize(size)}
                            className={`py-1.5 px-3 rounded-md text-sm font-medium border transition-all ${exportSize === size ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent border-input"}`}
                        >
                            {size || "Natif"}
                        </button>
                    ))}
                </div>
            </div>

            {/* Export buttons */}
            <div className="grid grid-cols-2 gap-3">
                <Button onClick={handleExport} disabled={loading} className="w-full" size="lg">
                    {loading && !detourProgress
                        ? "Préparation..."
                        : detourProgress
                            ? `Détourage ${detourProgress}...`
                            : selectedImages.size > 0
                                ? `⬇ PNG (${selectedImages.size})`
                                : `⬇ PNG (${filledCount})`}
                </Button>
                <Button onClick={handleExportPDF} disabled={loading} variant="outline" size="lg">
                    {loading && !detourProgress
                        ? "Préparation..."
                        : detourProgress
                            ? `Détourage ${detourProgress}...`
                            : selectedImages.size > 0
                                ? `📄 PDF (${selectedImages.size})`
                                : `📄 PDF (${filledCount})`}
                </Button>
            </div>
        </div>
    );
}

// Internal sub-component: green screen preview grid
function GreenScreenGrid({ generatedImages, greenScreenImages, loading, label, bgStyle, chromaBg, onRegenerate, onZoom }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{label} — cliquez 🔄 pour relancer</p>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {generatedImages.map((img, idx) => img && greenScreenImages[idx] && (
                    <div key={idx} className="relative rounded-md overflow-hidden border cursor-pointer" onClick={() => onZoom(`data:image/png;base64,${greenScreenImages[idx]}`)}>
                        <img
                            src={`data:image/png;base64,${greenScreenImages[idx]}`}
                            alt={`Fond ${idx + 1}`}
                            className={`w-full aspect-square object-contain ${chromaBg ? "" : "bg-white"}`}
                            style={chromaBg ? { background: bgStyle } : undefined}
                        />
                        <button
                            onClick={(e) => { e.stopPropagation(); onRegenerate(idx); }}
                            disabled={loading}
                            className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-xs shadow"
                            title="Relancer"
                        >🔄</button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onZoom(`data:image/png;base64,${greenScreenImages[idx]}`); }}
                            className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white/90 hover:bg-white flex items-center justify-center text-xs shadow"
                            title="Agrandir"
                        >🔍</button>
                        <div className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] text-center py-0.5">V{idx + 1}</div>
                    </div>
                ))}
            </div>
        </div>
    );
}
