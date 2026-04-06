"use client";
import { Button } from "@/components/ui/button";
import { MODELS } from "@/lib/api";

/**
 * Shared image grid with selection, download, inline edit, and regeneration.
 * Used by all generation pages after the first generation run.
 *
 * @param {Object} props
 * @param {string[]}  props.generatedImages - base64 images (may contain nulls for loading)
 * @param {Set}       props.selectedImages
 * @param {number}    props.filledCount
 * @param {number|null} props.editingIdx
 * @param {function}  props.setEditingIdx
 * @param {string}    props.editPrompt
 * @param {function}  props.setEditPrompt
 * @param {boolean}   props.editLoading
 * @param {string|null} props.error
 * @param {boolean}   props.loading
 * @param {function}  props.setLightboxIdx
 * @param {function}  props.toggleSelect
 * @param {function}  props.toggleSelectAll
 * @param {function}  props.handleEditImage - (idx, model) => void
 * @param {function}  props.onDownload - (idx) => void
 * @param {function}  props.onGenerate - (model) => void
 * @param {function}  props.onExport - () => void, navigates to export step
 */
export function ImageGrid({
    generatedImages, selectedImages, filledCount,
    editingIdx, setEditingIdx, editPrompt, setEditPrompt, editLoading, error,
    loading, setLightboxIdx,
    toggleSelect, toggleSelectAll,
    handleEditImage, onDownload, onGenerate, onExport,
}) {
    return (
        <>
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
                            <div key={i}
                                className={`relative rounded-lg border overflow-hidden transition-all ${img ? "cursor-pointer hover:shadow-lg" : "animate-pulse"} ${img && selectedImages.has(i) ? "ring-2 ring-primary ring-offset-2" : ""}`}>
                                {img ? (
                                    <>
                                        <img src={`data:image/png;base64,${img}`} alt={`Variante ${i + 1}`}
                                            className="w-full aspect-square object-contain bg-white"
                                            onClick={() => setLightboxIdx(i)} />
                                        <button onClick={(e) => { e.stopPropagation(); toggleSelect(i); }}
                                            className={`absolute top-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center text-xs font-bold transition-all ${selectedImages.has(i) ? "bg-primary border-primary text-primary-foreground" : "bg-white/80 border-gray-300 hover:border-primary"}`}>
                                            {selectedImages.has(i) && "✓"}
                                        </button>
                                        <button onClick={(e) => { e.stopPropagation(); onDownload(i); }}
                                            className="absolute top-2 right-2 w-8 h-8 rounded-full bg-white/80 hover:bg-white flex items-center justify-center text-sm shadow transition-all hover:scale-110"
                                            title="Télécharger">⬇</button>
                                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/40 to-transparent p-3 flex items-center justify-between">
                                            <span className="text-white text-sm font-medium">Variante {i + 1}</span>
                                            <button onClick={(e) => { e.stopPropagation(); setEditingIdx(editingIdx === i ? null : i); setEditPrompt(""); }}
                                                className="text-white/80 hover:text-white text-xs bg-white/20 hover:bg-white/30 rounded px-2 py-0.5 transition-all"
                                                title="Modifier cette image">✏️ Modifier</button>
                                        </div>
                                        {editingIdx === i && (
                                            <div className="absolute left-0 right-0 bottom-10 p-2 bg-background border-t" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex gap-1">
                                                    <input type="text" value={editPrompt}
                                                        onChange={(e) => setEditPrompt(e.target.value)}
                                                        onKeyDown={(e) => { if (e.key === "Enter" && editPrompt.trim()) handleEditImage(i); }}
                                                        placeholder="Décrivez la modification…"
                                                        className="flex-1 rounded-md border border-input bg-background px-2 py-1 text-xs"
                                                        autoFocus />
                                                    <Button size="sm" variant="outline" disabled={editLoading || !editPrompt.trim()}
                                                        onClick={() => handleEditImage(i, MODELS.FLASH)} className="text-xs h-7" title="Rapide (Flash)">
                                                        {editLoading ? "…" : "⚡"}
                                                    </Button>
                                                    <Button size="sm" disabled={editLoading || !editPrompt.trim()}
                                                        onClick={() => handleEditImage(i, MODELS.PRO)} className="text-xs h-7" title="Qualité (Pro)">
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

            {filledCount > 0 && !loading && (
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => onGenerate(MODELS.FLASH)}>⚡ Régénérer (Flash)</Button>
                    <Button variant="outline" onClick={() => onGenerate(MODELS.PRO)}>🔄 Régénérer (Pro)</Button>
                    <Button onClick={onExport} className="flex-1">Export →</Button>
                </div>
            )}
        </>
    );
}
