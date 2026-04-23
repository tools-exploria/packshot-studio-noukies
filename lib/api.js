/**
 * Shared API utilities for Packshot Studio
 * Centralizes common patterns used across all pages.
 */

/**
 * Max longest edge (in pixels) for images sent to the API.
 * Keeps payloads under Vercel's 4.5 MB body limit. NB2 downscales
 * inputs internally anyway, so 2048px is plenty for references.
 */
const MAX_EDGE_PX = 2048;
const JPEG_QUALITY = 0.85;

/**
 * Convert a File object to a base64 JPEG string (without data URI prefix).
 * If the image is larger than MAX_EDGE_PX on its longest edge, it is downscaled.
 * Always re-encoded as JPEG to guarantee small payloads (< 4.5 MB for Vercel).
 *
 * @param {File} file
 * @returns {Promise<string>} base64-encoded JPEG content
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        // Non-image files: fall back to raw base64
        if (!file.type || !file.type.startsWith("image/")) {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(",")[1]);
            reader.onerror = reject;
            reader.readAsDataURL(file);
            return;
        }

        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = (e) => {
            const img = new Image();
            img.onerror = reject;
            img.onload = () => {
                const { naturalWidth: w, naturalHeight: h } = img;
                const maxEdge = Math.max(w, h);
                const scale = maxEdge > MAX_EDGE_PX ? MAX_EDGE_PX / maxEdge : 1;
                const targetW = Math.round(w * scale);
                const targetH = Math.round(h * scale);

                const canvas = document.createElement("canvas");
                canvas.width = targetW;
                canvas.height = targetH;
                const ctx = canvas.getContext("2d");
                // White background for transparent PNGs (JPEG doesn't support alpha)
                ctx.fillStyle = "#FFFFFF";
                ctx.fillRect(0, 0, targetW, targetH);
                ctx.drawImage(img, 0, 0, targetW, targetH);

                const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
                resolve(dataUrl.split(",")[1]);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

/**
 * Compress a base64-encoded image (e.g. a previously generated result) to a
 * smaller JPEG suitable for re-sending to the API. Same rules as fileToBase64:
 * downscale to MAX_EDGE_PX on longest edge, re-encode as JPEG.
 *
 * @param {string} b64 - raw base64 (no data URI prefix)
 * @param {string} [mimeType="image/png"] - MIME type of the source base64
 * @returns {Promise<string>} compressed base64 JPEG (no data URI prefix)
 */
export function compressBase64Image(b64, mimeType = "image/png") {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = reject;
        img.onload = () => {
            const { naturalWidth: w, naturalHeight: h } = img;
            const maxEdge = Math.max(w, h);
            const scale = maxEdge > MAX_EDGE_PX ? MAX_EDGE_PX / maxEdge : 1;
            const targetW = Math.round(w * scale);
            const targetH = Math.round(h * scale);

            const canvas = document.createElement("canvas");
            canvas.width = targetW;
            canvas.height = targetH;
            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, targetW, targetH);
            ctx.drawImage(img, 0, 0, targetW, targetH);

            const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
            resolve(dataUrl.split(",")[1]);
        };
        img.src = `data:${mimeType};base64,${b64}`;
    });
}

/**
 * Trigger a browser download of a base64-encoded PNG image.
 * @param {string} b64 - base64 image data
 * @param {string} filename - download filename
 */
export function downloadImage(b64, filename = "packshot.png") {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${b64}`;
    a.download = filename;
    a.click();
}

/** Default timeout for image generation requests (ms) */
export const GENERATION_TIMEOUT_MS = 90_000;

/** Available models */
export const MODELS = {
    FLASH: "google/gemini-3.1-flash-image-preview",
    PRO: "google/gemini-3-pro-image-preview",
};

/**
 * Generate N image variants in parallel with progressive loading.
 *
 * @param {Object} options
 * @param {string} [options.prompt] - Generation prompt (legacy format)
 * @param {string[]} [options.images] - Base64 images to include (legacy format)
 * @param {Array<{type: string, text?: string, data?: string}>} [options.parts] - Interleaved content parts (new format)
 * @param {number} [options.count=4] - Number of variants to generate
 * @param {string} [options.model] - Model identifier (from MODELS)
 * @param {string} [options.resolution] - Image resolution (1K/2K/4K)
 * @param {string} [options.aspectRatio] - Aspect ratio (1:1, 4:3, etc.)
 * @param {number} [options.timeoutMs=90000] - Timeout per request in ms
 * @param {(index: number, image: string) => void} [options.onProgress] - Called when each image completes
 * @returns {Promise<string[]>} Array of base64 images (nulls filtered out)
 */
export async function generateImages({
    prompt,
    images,
    parts,
    count = 4,
    model,
    resolution,
    aspectRatio,
    timeoutMs = GENERATION_TIMEOUT_MS,
    onProgress,
}) {
    // Support both interleaved parts and legacy prompt+images format
    const payload = parts
        ? { parts, ...(model && { model }), ...(resolution && { resolution }), ...(aspectRatio && { aspectRatio }) }
        : { prompt, images, ...(model && { model }), ...(resolution && { resolution }), ...(aspectRatio && { aspectRatio }) };
    const requestBody = JSON.stringify(payload);

    const results = Array(count).fill(null);

    const promises = Array.from({ length: count }, (_, i) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        return fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: requestBody,
            signal: controller.signal,
        })
            .then((r) => r.json())
            .then((data) => {
                if (data.status === "success" && data.image) {
                    results[i] = data.image;
                    onProgress?.(i, data.image);
                }
            })
            .catch((err) => {
                if (err.name === "AbortError") {
                    console.warn(`Variant ${i + 1} timed out (${timeoutMs / 1000}s)`);
                }
            })
            .finally(() => clearTimeout(timer));
    });

    await Promise.all(promises);
    return results.filter(Boolean);
}
