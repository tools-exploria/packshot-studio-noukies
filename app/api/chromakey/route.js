import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/chromakey
 * Replaces a chroma key color (green/magenta/blue) with transparency.
 *
 * Body: { image: string (base64), color?: "green"|"magenta"|"blue", tolerance?: number }
 * Response: { result: string (base64 PNG with alpha) }
 */
export async function POST(request) {
    try {
        const { image, color = "green", tolerance = 100 } = await request.json();

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        // Target chroma key colors
        const CHROMA_COLORS = {
            green: { r: 0, g: 255, b: 0 },
            magenta: { r: 255, g: 0, b: 255 },
            blue: { r: 0, g: 0, b: 255 },
        };

        const target = CHROMA_COLORS[color] || CHROMA_COLORS.green;
        const tol = Math.max(10, Math.min(200, tolerance));

        const inputBuffer = Buffer.from(image, "base64");

        // Ensure we have raw RGBA pixels
        const { data, info } = await sharp(inputBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });

        const { width, height, channels } = info;
        const pixels = new Uint8Array(data.buffer, data.byteOffset, data.length);

        // Replace chroma key pixels with transparent + despill edges
        for (let i = 0; i < pixels.length; i += channels) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Euclidean distance to target color
            const dist = Math.sqrt(
                (r - target.r) ** 2 +
                (g - target.g) ** 2 +
                (b - target.b) ** 2
            );

            if (dist < tol) {
                // Fully transparent
                pixels[i + 3] = 0;
            } else if (dist < tol * 2) {
                // Soft edge — partial transparency for anti-aliasing
                const alpha = Math.round(((dist - tol) / tol) * 255);
                pixels[i + 3] = Math.min(pixels[i + 3], alpha);

                // Despill: remove green tint from edge pixels
                if (color === "green" && g > r && g > b) {
                    pixels[i + 1] = Math.max(r, b); // cap green to max of R,B
                } else if (color === "magenta" && r > g && b > g) {
                    pixels[i] = g;     // cap red
                    pixels[i + 2] = g; // cap blue
                } else if (color === "blue" && b > r && b > g) {
                    pixels[i + 2] = Math.max(r, g); // cap blue
                }
            }
        }

        const resultBuffer = await sharp(Buffer.from(pixels.buffer), {
            raw: { width, height, channels: 4 },
        })
            .png()
            .toBuffer();

        const resultB64 = resultBuffer.toString("base64");
        console.log(`[chromakey] ${color} (tol=${tol}) — ${width}x${height} — ${Math.round(resultB64.length / 1024)}KB`);

        return NextResponse.json({ result: resultB64 });
    } catch (err) {
        console.error("[chromakey] Error:", err.message);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
