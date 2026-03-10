"use client";
import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Shared lightbox with zoom/pan for full-size image preview.
 *
 * Gallery mode (lightboxIdx + images[]):  prev/next nav, download, select
 * Simple mode (src):                      single image, no nav
 */

// Gallery lightbox — nav between images
export function GalleryLightbox({ images, imageDims, lightboxIdx, setLightboxIdx, onDownload, selectedImages, toggleSelect }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const didDragRef = useRef(false);
    const mouseDownPosRef = useRef({ x: 0, y: 0 });

    const resetZoom = () => { setZoom(1); setPan({ x: 0, y: 0 }); };
    const close = () => { setLightboxIdx(null); resetZoom(); };

    return (
        <Dialog open={lightboxIdx !== null} onOpenChange={close}>
            <DialogContent className="max-w-[90vh] max-h-[90vh] w-[90vh] aspect-square p-0 overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">Image agrandie</DialogTitle>
                {lightboxIdx !== null && images[lightboxIdx] && (() => {
                    const imgSrc = `data:image/png;base64,${images[lightboxIdx]}`;
                    const dims = imageDims?.[lightboxIdx];
                    return (
                        <div className="relative flex-1 flex flex-col overflow-hidden">
                            <ZoomArea
                                src={imgSrc}
                                alt={`Variante ${lightboxIdx + 1}`}
                                zoom={zoom} setZoom={setZoom}
                                pan={pan} setPan={setPan}
                                isPanning={isPanning} setIsPanning={setIsPanning}
                                panStart={panStart} setPanStart={setPanStart}
                                didDragRef={didDragRef} mouseDownPosRef={mouseDownPosRef}
                            />

                            {/* Bottom bar */}
                            <div className="flex items-center justify-between px-4 py-2 bg-background border-t gap-2">
                                <div className="flex items-center gap-2">
                                    <button onClick={() => { setZoom(Math.max(1, zoom - 0.5)); if (zoom - 0.5 <= 1) setPan({ x: 0, y: 0 }); }} className="w-8 h-8 rounded-md border flex items-center justify-center text-sm hover:bg-accent" title="Zoom -">−</button>
                                    <span className="text-xs font-mono min-w-[4ch] text-center">{Math.round(zoom * 100)}%</span>
                                    <button onClick={() => setZoom(Math.min(5, zoom + 0.5))} className="w-8 h-8 rounded-md border flex items-center justify-center text-sm hover:bg-accent" title="Zoom +">+</button>
                                    <button onClick={resetZoom} className="px-2 h-8 rounded-md border flex items-center justify-center text-xs hover:bg-accent" title="Reset">Reset</button>
                                </div>

                                <div className="text-xs text-muted-foreground">
                                    Variante {lightboxIdx + 1}{dims ? ` — ${dims.w}×${dims.h}px` : ''}
                                </div>

                                <div className="flex items-center gap-1">
                                    {onDownload && (
                                        <Button size="sm" variant="secondary" onClick={() => onDownload(lightboxIdx)}>⬇</Button>
                                    )}
                                    {toggleSelect && (
                                        <Button
                                            size="sm"
                                            variant={selectedImages?.has(lightboxIdx) ? "default" : "outline"}
                                            onClick={() => toggleSelect(lightboxIdx)}
                                        >
                                            {selectedImages?.has(lightboxIdx) ? "✓" : "☐"}
                                        </Button>
                                    )}
                                </div>
                            </div>

                            {/* Navigation arrows */}
                            {lightboxIdx > 0 && images[lightboxIdx - 1] && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); resetZoom(); }}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 flex items-center justify-center text-lg shadow-md z-10"
                                >←</button>
                            )}
                            {lightboxIdx < images.length - 1 && images[lightboxIdx + 1] && (
                                <button
                                    onClick={(e) => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); resetZoom(); }}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full w-10 h-10 flex items-center justify-center text-lg shadow-md z-10"
                                >→</button>
                            )}
                        </div>
                    );
                })()}
            </DialogContent>
        </Dialog>
    );
}

// Simple lightbox — single image, no nav
export function SimpleLightbox({ src, onClose }) {
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const didDragRef = useRef(false);
    const mouseDownPosRef = useRef({ x: 0, y: 0 });

    return (
        <Dialog open={src !== null} onOpenChange={() => { onClose(); setZoom(1); setPan({ x: 0, y: 0 }); }}>
            <DialogContent className="max-w-[90vh] max-h-[90vh] w-[90vh] aspect-square p-0 overflow-hidden flex flex-col">
                <DialogTitle className="sr-only">Image de référence</DialogTitle>
                {src && (
                    <ZoomArea
                        src={src}
                        alt="Référence"
                        zoom={zoom} setZoom={setZoom}
                        pan={pan} setPan={setPan}
                        isPanning={isPanning} setIsPanning={setIsPanning}
                        panStart={panStart} setPanStart={setPanStart}
                        didDragRef={didDragRef} mouseDownPosRef={mouseDownPosRef}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

// Internal: zoomable/pannable image area
function ZoomArea({ src, alt, zoom, setZoom, pan, setPan, isPanning, setIsPanning, panStart, setPanStart, didDragRef, mouseDownPosRef }) {
    return (
        <div
            className="flex-1 overflow-hidden bg-muted/30"
            style={{ cursor: zoom > 1 ? (isPanning ? 'grabbing' : 'grab') : 'zoom-in' }}
            onMouseDown={(e) => {
                mouseDownPosRef.current = { x: e.clientX, y: e.clientY };
                didDragRef.current = false;
                if (zoom > 1) { e.preventDefault(); setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y }); }
            }}
            onMouseMove={(e) => {
                const dx = Math.abs(e.clientX - mouseDownPosRef.current.x);
                const dy = Math.abs(e.clientY - mouseDownPosRef.current.y);
                if (dx > 5 || dy > 5) didDragRef.current = true;
                if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
            }}
            onMouseUp={() => setIsPanning(false)}
            onMouseLeave={() => setIsPanning(false)}
            onClick={() => {
                if (didDragRef.current) return;
                const levels = [1, 2, 3];
                const next = levels[(levels.indexOf(zoom) + 1) % levels.length];
                setZoom(next);
                if (next === 1) setPan({ x: 0, y: 0 });
            }}
            onWheel={(e) => {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.5 : 0.5;
                const next = Math.max(1, Math.min(5, zoom + delta));
                setZoom(next);
                if (next === 1) setPan({ x: 0, y: 0 });
            }}
        >
            <img
                src={src}
                alt={alt}
                className="w-full h-full object-contain select-none"
                draggable={false}
                style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: isPanning ? 'none' : 'transform 0.2s ease-out',
                }}
            />
        </div>
    );
}
