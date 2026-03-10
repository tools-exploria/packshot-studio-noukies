// Configuration for the app
export const API_CONFIG = {
    // Default generation count
    defaultCount: 4,

    // Max image size for upload (10MB)
    maxImageSize: 10 * 1024 * 1024,

    // Accepted image types
    acceptedTypes: ["image/png", "image/jpeg", "image/webp"],
};

/**
 * Compute canvas pixel dimensions from resolution + aspect ratio.
 * The "long edge" is determined by resolution, ratio determines shape.
 */
const RESOLUTION_BASE = { "1K": 1024, "2K": 2048, "4K": 4096 };
const RATIO_MAP = {
    "1:1": [1, 1],
    "4:3": [4, 3],
    "3:4": [3, 4],
    "16:9": [16, 9],
    "9:16": [9, 16],
    "2:3": [2, 3],
    "3:2": [3, 2],
    "4:5": [4, 5],
    "5:4": [5, 4],
};

export function getCanvasSize(resolution = "2K", aspectRatio = "1:1") {
    const base = RESOLUTION_BASE[resolution] || 2048;
    const [rw, rh] = RATIO_MAP[aspectRatio] || [1, 1];
    // Scale so the longest edge = base
    const maxSide = Math.max(rw, rh);
    const w = Math.round((rw / maxSide) * base);
    const h = Math.round((rh / maxSide) * base);
    return { width: w, height: h };
}
