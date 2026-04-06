/**
 * useGenerationPage — Shared state & logic for all packshot generation tools.
 *
 * Encapsulates the ~70% of state and logic that is identical across
 * pattern, couleur, ambiance, and 3d-produit pages.
 *
 * Each page uses this hook and adds only its own specific state on top.
 */
"use client";
import { useState, useCallback } from "react";
import { fileToBase64, generateImages, MODELS } from "@/lib/api";

/**
 * Generation presets — pre-configured resolution + aspect ratio combos
 * that match specific client requirements.
 *
 * Each preset generates slightly above the target dimensions, so the final
 * crop/resize at export time is minimal (downscale only, no upscale).
 *
 * Will eventually be driven by the brand config page instead of hardcoded.
 */
export const GENERATION_PRESETS = {
    "noukies-packshot": {
        label: "Noukies Packshot",
        description: "Génère en 2K 4:5 (~1664x2048), à exporter en 1560x2000",
        resolution: "2K",
        aspectRatio: "4:5",
        exportSize: "1560x2000",
    },
};

/**
 * @param {object} opts
 * @param {number}  [opts.defaultVariantCount=4]   - Initial number of variants
 * @param {string}  [opts.defaultResolution="2K"]   - Initial resolution
 * @param {string}  [opts.defaultAspectRatio="1:1"] - Initial aspect ratio
 */
export function useGenerationPage({
    defaultVariantCount = 4,
    defaultResolution = "2K",
    defaultAspectRatio = "1:1",
} = {}) {
    // ── Generation state ────────────────────────────────────────
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [generatedImages, setGeneratedImages] = useState([]);
    const [imageDims, setImageDims] = useState([]);
    const [selectedImages, setSelectedImages] = useState(new Set());

    // ── Generation controls ──────────────────────────────────────
    const [variantCount, setVariantCount] = useState(defaultVariantCount);
    const [resolution, setResolution] = useState(defaultResolution);
    const [aspectRatio, setAspectRatio] = useState(defaultAspectRatio);
    const [productNotes, setProductNotes] = useState("");
    const [activePreset, setActivePreset] = useState(null);

    /** Apply a generation preset (sets resolution + aspectRatio in one click). */
    const applyPreset = useCallback((presetKey) => {
        const preset = GENERATION_PRESETS[presetKey];
        if (!preset) return;
        setResolution(preset.resolution);
        setAspectRatio(preset.aspectRatio);
        setActivePreset(presetKey);
    }, []);

    /** Clear any active preset (when user manually changes resolution or ratio). */
    const clearPreset = useCallback(() => setActivePreset(null), []);

    // ── Product file ─────────────────────────────────────────────
    const [productFile, setProductFile] = useState(null);
    const [productPreview, setProductPreview] = useState(null);
    const [productDims, setProductDims] = useState(null);

    // ── Lightbox ─────────────────────────────────────────────────
    const [lightboxIdx, setLightboxIdx] = useState(null);

    // ── Per-image inline editing ─────────────────────────────────
    const [editingIdx, setEditingIdx] = useState(null);
    const [editPrompt, setEditPrompt] = useState("");
    const [editLoading, setEditLoading] = useState(false);

    // ── Handlers ─────────────────────────────────────────────────

    /**
     * Load a product file: sets preview data URL + reads natural image dimensions.
     * This is the standard handler for the main product upload zone.
     */
    const handleProductFile = useCallback((f) => {
        setProductFile(f);
        const reader = new FileReader();
        reader.onload = (e) => {
            setProductPreview(e.target.result);
            const img = new Image();
            img.onload = () => setProductDims({ w: img.naturalWidth, h: img.naturalHeight });
            img.src = e.target.result;
        };
        reader.readAsDataURL(f);
    }, []);

    /**
     * Core generation runner. Accepts a prompt and an array of base64 images.
     * Handles progressive loading via onProgress callback.
     *
     * @param {string}   prompt      - The fully-assembled AI prompt
     * @param {File[]}   files       - Array of File objects to encode (product first)
     * @param {string}   [model]     - MODELS.FLASH | MODELS.PRO
     * @param {number}   [timeoutMs] - Override request timeout (default: API default)
     */
    const runGenerate = useCallback(async (prompt, files, model = MODELS.FLASH, timeoutMs) => {
        if (!files.length) return;
        setLoading(true);
        setError(null);
        setGeneratedImages(Array(variantCount).fill(null));
        setSelectedImages(new Set());
        setImageDims(Array(variantCount).fill(null));
        try {
            const base64Images = await Promise.all(files.map(fileToBase64));

            const extraOpts = timeoutMs ? { timeoutMs } : {};
            const results = await generateImages({
                prompt,
                images: base64Images,
                count: variantCount,
                model,
                resolution,
                aspectRatio,
                ...extraOpts,
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
    }, [variantCount, resolution, aspectRatio]);

    /**
     * Edit a specific generated image variant using a text instruction.
     * Appends the new image at the end of the list (non-destructive).
     *
     * @param {number} idx   - Index of the image to edit
     * @param {string} model - MODELS.FLASH | MODELS.PRO
     */
    const handleEditImage = useCallback(async (idx, model = MODELS.PRO) => {
        if (!editPrompt.trim() || !generatedImages[idx]) return;
        setEditLoading(true);
        setError(null);
        try {
            const results = await generateImages({
                prompt: editPrompt.trim(),
                images: [generatedImages[idx]],
                count: 1,
                model,
                resolution,
                aspectRatio,
                onProgress: (_, image) => {
                    setGeneratedImages((prev) => [...prev, image]);
                    const img = new Image();
                    img.onload = () =>
                        setImageDims((prev) => [...prev, { w: img.naturalWidth, h: img.naturalHeight }]);
                    img.src = `data:image/png;base64,${image}`;
                },
            });
            if (results.length) {
                setEditingIdx(null);
                setEditPrompt("");
            } else {
                setError("Modification échouée: Pas d'image");
            }
        } catch (err) {
            setError(`Modification échouée: ${err.message}`);
        } finally {
            setEditLoading(false);
        }
    }, [editPrompt, generatedImages, resolution, aspectRatio]);

    /** Toggle selection of a single image by index */
    const toggleSelect = useCallback((idx) => {
        setSelectedImages((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    }, []);

    /** Toggle all / none selection */
    const toggleSelectAll = useCallback(() => {
        const filled = generatedImages.filter(Boolean);
        if (selectedImages.size === filled.length) {
            setSelectedImages(new Set());
        } else {
            setSelectedImages(
                new Set(generatedImages.map((img, i) => (img ? i : -1)).filter((i) => i >= 0))
            );
        }
    }, [generatedImages, selectedImages.size]);

    /** Reset the generation state (useful when going back from step 2) */
    const resetGeneration = useCallback(() => {
        setGeneratedImages([]);
        setImageDims([]);
        setSelectedImages(new Set());
        setError(null);
    }, []);

    const filledCount = generatedImages.filter(Boolean).length;

    return {
        // State
        loading, setLoading,
        error, setError,
        generatedImages, setGeneratedImages,
        imageDims, setImageDims,
        selectedImages, setSelectedImages,
        variantCount, setVariantCount,
        resolution, setResolution,
        aspectRatio, setAspectRatio,
        activePreset, applyPreset, clearPreset,
        productNotes, setProductNotes,
        productFile, setProductFile,
        productPreview, setProductPreview,
        productDims, setProductDims,
        lightboxIdx, setLightboxIdx,
        editingIdx, setEditingIdx,
        editPrompt, setEditPrompt,
        editLoading,
        // Computed
        filledCount,
        // Handlers
        handleProductFile,
        runGenerate,
        handleEditImage,
        toggleSelect,
        toggleSelectAll,
        resetGeneration,
    };
}
