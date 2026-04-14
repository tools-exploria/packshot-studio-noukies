/**
 * Shared API utilities for Packshot Studio
 * Centralizes common patterns used across all pages.
 */

/**
 * Convert a File object to a base64 string (without data URI prefix).
 * @param {File} file
 * @returns {Promise<string>} base64-encoded content
 */
export function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
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
