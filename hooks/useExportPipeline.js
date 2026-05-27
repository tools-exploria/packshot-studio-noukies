"use client";
import { useState } from "react";
import { MODELS, compressBase64Image } from "@/lib/api";
import { PROMPTS } from "@/lib/prompts";

// Parse a fetch response as JSON, but fall back to a readable error when the
// body is plain text — typically Vercel's "Request Entity Too Large" (413)
// when the request body exceeds 4.5MB. Without this, the caller sees the
// cryptic "Unexpected token 'R'..." from JSON.parse.
async function parseResponseOrThrow(res, fallbackLabel = "Échec de la requête") {
    const text = await res.text();
    try {
        return JSON.parse(text);
    } catch {
        // Body isn't JSON — surface the raw error
        if (res.status === 413 || /entity too large/i.test(text)) {
            throw new Error("Image trop volumineuse (>4.5MB) — la compression devrait empêcher ce cas, signalez ce bug.");
        }
        throw new Error(`${fallbackLabel} (HTTP ${res.status}) : ${text.slice(0, 120)}`);
    }
}

/** Trigger a browser download from a base64 string. Infers MIME from extension. */
function downloadB64(b64, filename) {
    const ext = filename.split(".").pop().toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    const a = document.createElement("a");
    a.href = `data:${mime};base64,${b64}`;
    a.download = filename;
    a.click();
}

/**
 * Shared hook for export pipeline: green screen, chroma key, file naming, PNG/PDF export.
 *
 * @param {Object} params
 * @param {string[]} params.generatedImages - base64 images array
 * @param {Object[]} params.imageDims - [{w,h}] per image
 * @param {string} params.resolution - e.g. "2K"
 * @param {string} params.aspectRatio - e.g. "1:1"
 * @param {Set} params.selectedImages - selected indices
 * @param {function} params.setLoading
 * @param {function} params.setError
 */
export function useExportPipeline({ generatedImages, imageDims, resolution, aspectRatio, selectedImages, setLoading, setError }) {
    const [bgMode, setBgMode] = useState("original");
    const [chromaColor, setChromaColor] = useState("green");
    const [greenScreenImages, setGreenScreenImages] = useState({});
    const [detouredImages, setDetouredImages] = useState({});
    const [detourProgress, setDetourProgress] = useState(null);
    const [regeneratingIdx, setRegeneratingIdx] = useState(null);
    const [exportSize, setExportSize] = useState("");
    // Ref lightbox (for green screen previews)
    const [refLightboxSrc, setRefLightboxSrc] = useState(null);

    // Reset caches when mode/color changes
    const handleSetBgMode = (mode) => {
        setBgMode(mode);
        setGreenScreenImages({});
        setDetouredImages({});
    };
    const handleSetChromaColor = (color) => {
        setChromaColor(color);
        setGreenScreenImages({});
        setDetouredImages({});
    };

    // Generate a green screen / white bg version of a single image.
    // ALWAYS resolves — wraps everything in try/finally so state is cleaned
    // up even on fetch error / timeout.
    //
    // `trackSingle` controls regeneratingIdx behaviour :
    //   - true (default, used by single-tile retry) : sets regeneratingIdx to
    //     idx during the call, clears it after. UI shows that tile as
    //     "regenerating".
    //   - false (used by batch parallel) : skips regeneratingIdx entirely so
    //     concurrent calls don't fight over the single shared state. UI relies
    //     on `loading=true` to mark every batch tile as in-progress.
    const generateGreenScreen = async (idx, { trackSingle = true } = {}) => {
        const img = generatedImages[idx];
        if (!img) return false;

        const CHROMA_COLORS = { green: "#00FF00", magenta: "#FF00FF", blue: "#0000FF" };
        const prompt = bgMode === "white"
            ? PROMPTS.whiteBg
            : PROMPTS.chromaKeyBg(CHROMA_COLORS[chromaColor], chromaColor);

        if (trackSingle) setRegeneratingIdx(idx);
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 120_000);
        try {
            // Compress the source variant before sending to /api/generate.
            // Generated 2K PNGs can be 5-7MB base64 — exceeds Vercel's 4.5MB
            // body limit and triggers the cryptic "Request Entity Too Large"
            // / "Unexpected token 'R'" error. compressBase64Image downscales
            // to 2048px JPEG quality 0.85 → ~500-800KB, well under the limit.
            // Quality loss is fine here because NB2 regenerates the image
            // with a clean background anyway.
            const compressedImg = await compressBase64Image(img, "image/png");

            const res = await fetch("/api/generate", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ prompt, images: [compressedImg], model: MODELS.FLASH, resolution, aspectRatio }),
                signal: controller.signal,
            });
            const data = await parseResponseOrThrow(res, `Échec fond variante ${idx + 1}`);
            if (data.status === "success" && data.image) {
                setGreenScreenImages((prev) => ({ ...prev, [idx]: data.image }));
                setDetouredImages((prev) => { const next = { ...prev }; delete next[idx]; return next; });
                return true;
            }
            setError(`Échec fond variante ${idx + 1} : ${data.error || "pas d'image"}`);
            return false;
        } catch (err) {
            if (err.name === "AbortError") {
                setError(`Timeout fond variante ${idx + 1} (120s)`);
            } else {
                setError(`Échec fond variante ${idx + 1} : ${err.message || "erreur réseau"}`);
            }
            return false;
        } finally {
            clearTimeout(timer);
            if (trackSingle) setRegeneratingIdx(null);
        }
    };

    // Generate green screens for ALL selected images IN PARALLEL via Promise.all.
    // Previous version was sequential (for + await) which scaled linearly with
    // image count — 6 images = 6× the wait. Now they fire concurrently and
    // resolve as they come back. detourProgress shows the count completed so
    // far (e.g., "3/6"). State is always cleaned up in finally.
    const generateAllGreenScreens = async () => {
        setLoading(true);
        setError(null);
        try {
            const indices = getExportIndices();
            setDetourProgress(`0/${indices.length}`);
            let completed = 0;
            let failures = 0;

            await Promise.all(
                indices.map((idx) =>
                    generateGreenScreen(idx, { trackSingle: false }).then((ok) => {
                        completed++;
                        if (!ok) failures++;
                        setDetourProgress(`${completed}/${indices.length}`);
                        return ok;
                    }),
                ),
            );

            if (failures > 0 && failures < indices.length) {
                setError(`${failures} variante${failures > 1 ? "s ont" : " a"} échoué. Les autres sont disponibles.`);
            }
        } finally {
            setDetourProgress(null);
            setLoading(false);
        }
    };

    // Prepare images for export (apply chroma key if needed)
    const getExportImages = async (indices) => {
        const images = [];
        for (let n = 0; n < indices.length; n++) {
            const idx = indices[n];
            let img = generatedImages[idx];
            if (!img) continue;

            // White bg: AI already generated on white — use directly
            if (bgMode === "white") {
                if (greenScreenImages[idx]) {
                    img = greenScreenImages[idx];
                } else {
                    setError(`Préparez le fond blanc d'abord`);
                    continue;
                }
            }

            // Transparent: chroma key green/magenta/blue → transparent
            if (bgMode === "transparent") {
                if (detouredImages[idx]) {
                    img = detouredImages[idx];
                } else if (greenScreenImages[idx]) {
                    setDetourProgress(`${n + 1}/${indices.length} — détourage...`);
                    const chromaRes = await fetch("/api/chromakey", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ image: greenScreenImages[idx], color: chromaColor }),
                    });
                    const chromaData = await parseResponseOrThrow(chromaRes, `Échec chromakey variante ${idx + 1}`);
                    if (chromaData.result) {
                        img = chromaData.result;
                        setDetouredImages((prev) => ({ ...prev, [idx]: img }));
                    } else {
                        setError(`Chromakey échoué pour variante ${idx + 1}`);
                        continue;
                    }
                } else {
                    setError(`Préparez le détourage d'abord`);
                    continue;
                }
            }

            // Resize only if explicit size selected
            const needsResize = exportSize && exportSize.includes("x");
            if (needsResize) {
                const res = await fetch("/api/export", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        images: [img],
                        format: exportSize,
                        background: bgMode === "transparent" ? "transparent" : "white",
                    }),
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.results?.[0]) img = data.results[0];
                }
            }

            images.push({ b64: img, index: idx });
        }
        setDetourProgress(null);
        return images;
    };

    // Build descriptive filename
    const getFileName = (idx, ext = "png") => {
        const dims = imageDims[idx];
        const dimStr = dims ? `${dims.w}x${dims.h}` : resolution;
        const bgStr = bgMode === "white" ? "_white_background" : bgMode === "transparent" ? "_transparent" : "";
        return `packshot_${idx + 1}_${dimStr}${bgStr}.${ext}`;
    };

    // Helper to get export indices
    const getExportIndices = () => {
        return selectedImages.size > 0
            ? [...selectedImages].sort()
            : generatedImages.map((img, i) => (img ? i : -1)).filter((i) => i >= 0);
    };

    // Export as PNG (download)
    const handleExport = async () => {
        const indices = getExportIndices();
        if (!indices.length) { setError("Aucune image à télécharger"); return; }
        setLoading(true);
        setError(null);
        try {
            const images = await getExportImages(indices);
            for (let n = 0; n < images.length; n++) {
                downloadB64(images[n].b64, getFileName(images[n].index, "png"));
                if (n < images.length - 1) await new Promise((r) => setTimeout(r, 300));
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Export as JPG (white background, optional resize to 1560x2000)
    const handleExportJPG = async () => {
        const indices = getExportIndices();
        if (!indices.length) { setError("Aucune image à télécharger"); return; }
        setLoading(true);
        setError(null);
        try {
            const images = await getExportImages(indices);
            const b64List = images.map((img) => img.b64);
            const body = { images: b64List, output: "jpg", background: "white" };
            if (exportSize && exportSize.includes("x")) body.format = exportSize;
            const res = await fetch("/api/export", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!data.results?.length) { setError("Export JPG échoué"); return; }
            for (let n = 0; n < data.results.length; n++) {
                downloadB64(data.results[n], getFileName(images[n].index, "jpg"));
                if (n < data.results.length - 1) await new Promise((r) => setTimeout(r, 300));
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Export as PDF
    const handleExportPDF = async () => {
        const indices = getExportIndices();
        if (!indices.length) { setError("Aucune image à télécharger"); return; }
        setLoading(true);
        setError(null);
        try {
            const images = await getExportImages(indices);
            const { jsPDF } = await import("jspdf");
            const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
            const pageW = pdf.internal.pageSize.getWidth();
            const pageH = pdf.internal.pageSize.getHeight();
            const margin = 10;

            for (let n = 0; n < images.length; n++) {
                if (n > 0) pdf.addPage();
                const maxW = pageW - margin * 2;
                const maxH = pageH - margin * 2;
                const imgSize = Math.min(maxW, maxH);
                const x = (pageW - imgSize) / 2;
                const y = (pageH - imgSize) / 2;
                pdf.addImage(`data:image/png;base64,${images[n].b64}`, "PNG", x, y, imgSize, imgSize);
            }

            pdf.save("noukies_packshots.pdf");
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return {
        bgMode, setBgMode: handleSetBgMode,
        chromaColor, setChromaColor: handleSetChromaColor,
        greenScreenImages, setGreenScreenImages,
        detouredImages, setDetouredImages,
        detourProgress,
        regeneratingIdx,
        exportSize, setExportSize,
        refLightboxSrc, setRefLightboxSrc,
        generateGreenScreen, generateAllGreenScreens,
        getExportImages, getFileName, getExportIndices,
        handleExport, handleExportJPG, handleExportPDF,
        // Exposed for ExportPanel to detect aspect-ratio mismatch warnings.
        generationAspectRatio: aspectRatio,
    };
}
