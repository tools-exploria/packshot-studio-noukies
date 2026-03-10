"use client";
import { useCallback, useRef, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";

export function UploadZone({ onFile, accept = "image/*", label = "Glissez-déposez votre image", sublabel = "ou cliquez pour sélectionner", preview = null, className = "" }) {
    const [dragover, setDragover] = useState(false);
    const inputRef = useRef(null);

    const handleFile = useCallback((f) => {
        if (f && onFile) onFile(f);
    }, [onFile]);

    return (
        <div
            className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
        ${dragover ? "border-primary bg-primary/5 scale-[1.01]" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-accent/50"}
        ${preview ? "p-4" : ""} ${className}`}
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); setDragover(false); handleFile(e.dataTransfer.files[0]); }}
            onDragOver={(e) => { e.preventDefault(); setDragover(true); }}
            onDragLeave={() => setDragover(false)}
        >
            <input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFile(e.target.files[0])} />
            {preview ? (
                <div className="flex flex-col items-center gap-3">
                    <img src={preview} alt="Preview" className="max-h-48 rounded-lg object-contain" />
                    <p className="text-sm text-muted-foreground">Cliquer pour changer</p>
                </div>
            ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                    <div className="text-4xl mb-2">📁</div>
                    <p className="font-medium text-foreground">{label}</p>
                    <p className="text-sm text-muted-foreground">{sublabel}</p>
                </div>
            )}
        </div>
    );
}

export function ImageGrid({ images, selected, onSelect, loading = false, columns = 2 }) {
    if (!images || !images.length) {
        if (!loading) return null;
        // Pure loading state (no images array yet)
        return (
            <div className="grid grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden animate-pulse">
                        <CardContent className="p-0">
                            <div className="aspect-square bg-muted flex items-center justify-center">
                                <div className="text-center">
                                    <div className="animate-spin text-2xl mb-2">⏳</div>
                                    <p className="text-sm text-muted-foreground">Génération...</p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        );
    }

    return (
        <div className="grid grid-cols-2 gap-4">
            {images.map((img, i) => (
                <Card
                    key={i}
                    className={`overflow-hidden transition-all
                        ${img ? "cursor-pointer hover:shadow-lg" : "animate-pulse"}
                        ${img && selected === i ? "ring-2 ring-primary ring-offset-2" : img ? "hover:ring-1 hover:ring-primary/30" : ""}`}
                    onClick={() => img && onSelect?.(i)}
                >
                    <CardContent className="p-0 relative">
                        {img ? (
                            <>
                                <img
                                    src={`data:image/png;base64,${img}`}
                                    alt={`Variante ${i + 1}`}
                                    className="w-full aspect-square object-contain bg-white"
                                />
                                {selected === i && (
                                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">✓</div>
                                )}
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
                    </CardContent>
                </Card>
            ))}
        </div>
    );
}

export function Stepper({ steps, currentStep }) {
    return (
        <div className="flex items-center gap-1.5 sm:gap-2 mb-8">
            {steps.map((step, i) => (
                <div key={i} className="flex items-center gap-1.5 sm:gap-2">
                    <div className={`flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-medium transition-all duration-300
            ${i < currentStep ? "bg-primary/15 text-primary" : ""}
            ${i === currentStep ? "bg-primary text-primary-foreground shadow-md shadow-primary/20" : ""}
            ${i > currentStep ? "bg-muted text-muted-foreground" : ""}`}
                    >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-semibold
                            ${i < currentStep ? "bg-primary text-primary-foreground" : ""}
                            ${i === currentStep ? "bg-white/25" : ""}
                            ${i > currentStep ? "bg-muted-foreground/15" : ""}`}>
                            {i < currentStep ? "✓" : i + 1}
                        </span>
                        <span className="hidden sm:inline">{step}</span>
                    </div>
                    {i < steps.length - 1 && (
                        <div className={`w-6 sm:w-8 h-0.5 rounded-full transition-colors duration-300 ${i < currentStep ? "bg-primary/40" : "bg-border"}`} />
                    )}
                </div>
            ))}
        </div>
    );
}
