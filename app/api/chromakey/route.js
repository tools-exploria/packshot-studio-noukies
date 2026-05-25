import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/chromakey
 *
 * Production-grade chroma key → transparency.
 * Pipeline: Vlahos color-difference keyer → Average despill → luma restore
 *           → alpha erode → Gaussian feather. Mirrors what Keylight / Ultimatte do.
 *
 * Body:
 *   image:     base64 string (required)
 *   color:     "green" | "magenta" | "blue" (default "green")
 *   clipBlack: 0..1 — below this key strength the pixel is fully opaque (default 0.05)
 *   clipWhite: 0..1 — above this key strength the pixel is fully transparent (default 0.50)
 *   despill:   0..1 — strength of channel suppression on contaminated edges (default 1.0)
 *   edgeErode: 0..1 — bites back the matte boundary to kill fringe (default 0.10)
 *   feather:   px  — Gaussian sigma applied to alpha only (default 0.8)
 *
 * Response: { result: base64 PNG with straight (unassociated) alpha }
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            image,
            color = "green",
            clipBlack = 0.05,
            clipWhite = 0.50,
            despill = 1.0,
            edgeErode = 0.10,
            feather = 0.8,
        } = body;

        if (!image) {
            return NextResponse.json({ error: "No image provided" }, { status: 400 });
        }

        const inputBuffer = Buffer.from(image, "base64");

        // Decode to raw RGBA
        const { data, info } = await sharp(inputBuffer)
            .ensureAlpha()
            .raw()
            .toBuffer({ resolveWithObject: true });
        const { width, height } = info;
        const pixels = Buffer.from(data); // mutable copy

        const cbMinusCw = Math.max(0.001, clipWhite - clipBlack);

        // Vlahos color-difference key + Average despill + luma restore, single pass
        for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i];
            const g = pixels[i + 1];
            const b = pixels[i + 2];

            // Color-difference key in [0, 255], then normalized to [0, 1].
            // Green:   key = G − max(R, B)
            // Blue:    key = B − max(R, G)
            // Magenta: key = (R + B)/2 − G   (magenta = high R+B, low G)
            let keyRaw;
            if (color === "blue") {
                keyRaw = b - Math.max(r, g);
            } else if (color === "magenta") {
                keyRaw = (r + b) * 0.5 - g;
            } else {
                keyRaw = g - Math.max(r, b);
            }
            const keyNorm = keyRaw > 0 ? keyRaw / 255 : 0;

            // Soft matte: ramp between clipBlack and clipWhite, then invert.
            let t = (keyNorm - clipBlack) / cbMinusCw;
            if (t < 0) t = 0; else if (t > 1) t = 1;
            const newAlpha = Math.round((1 - t) * 255);
            // Preserve any pre-existing transparency (take the min)
            if (newAlpha < pixels[i + 3]) pixels[i + 3] = newAlpha;

            // Despill: only act on pixels with actual screen contamination (key > 0)
            // and that aren't fully transparent (no point fixing color of invisible px).
            if (keyRaw > 0 && despill > 0 && pixels[i + 3] > 0) {
                let rN = r, gN = g, bN = b;
                if (color === "blue") {
                    const cap = (r + g) * 0.5;
                    bN = b + (Math.min(b, cap) - b) * despill;
                } else if (color === "magenta") {
                    const cap = g;
                    rN = r + (Math.min(r, cap) - r) * despill;
                    bN = b + (Math.min(b, cap) - b) * despill;
                } else {
                    const cap = (r + b) * 0.5;
                    gN = g + (Math.min(g, cap) - g) * despill;
                }

                // Luma restore: rescale RGB so perceived brightness matches original.
                // Rec. 709 luma weights. Cap scale to avoid blowing out highlights.
                const yOrig = 0.2126 * r + 0.7152 * g + 0.0722 * b;
                const yNew = 0.2126 * rN + 0.7152 * gN + 0.0722 * bN;
                if (yNew > 1 && yOrig > yNew) {
                    const k = Math.min(1.5, yOrig / yNew);
                    rN *= k; gN *= k; bN *= k;
                }

                pixels[i]     = rN < 0 ? 0 : rN > 255 ? 255 : Math.round(rN);
                pixels[i + 1] = gN < 0 ? 0 : gN > 255 ? 255 : Math.round(gN);
                pixels[i + 2] = bN < 0 ? 0 : bN > 255 ? 255 : Math.round(bN);
            }
        }

        // Refine alpha channel only (never blur RGB — causes color bleeding at edges).
        const needsAlphaRefine = feather > 0 || edgeErode > 0;
        if (needsAlphaRefine) {
            // Extract current alpha as single-channel raw buffer.
            const alphaIn = Buffer.alloc(width * height);
            for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
                alphaIn[j] = pixels[i + 3];
            }

            let alphaPipe = sharp(alphaIn, { raw: { width, height, channels: 1 } });

            // Feather: Gaussian blur on alpha. sharp.blur requires sigma >= 0.3.
            if (feather > 0) {
                const sigma = Math.max(0.3, feather);
                alphaPipe = alphaPipe.blur(sigma);
            }

            // Erode-like: linear shift `a*x + b` pulls mid-alpha values down,
            // shrinking the matte boundary (kills fringe pixels).
            // a = 1 + edgeErode, b = -edgeErode*255 → output clamped by sharp.
            if (edgeErode > 0) {
                alphaPipe = alphaPipe.linear(1 + edgeErode, -edgeErode * 255);
            }

            // Force single-channel output. Without this, sharp's blur/linear ops
            // silently promote the buffer to 3-channel sRGB → we'd be reading
            // interleaved RGB bytes instead of alpha values.
            const alphaOut = await alphaPipe.toColourspace("b-w").raw().toBuffer();
            for (let i = 0, j = 0; i < pixels.length; i += 4, j++) {
                pixels[i + 3] = alphaOut[j];
            }
        }

        // Re-encode as PNG with straight (non-premultiplied) alpha — what
        // Photoshop, Figma, Affinity, Lightroom all expect.
        const resultBuffer = await sharp(pixels, {
            raw: { width, height, channels: 4 },
        }).png({ compressionLevel: 9 }).toBuffer();

        const resultB64 = resultBuffer.toString("base64");
        console.log(
            `[chromakey] ${color} cb=${clipBlack} cw=${clipWhite} des=${despill} ` +
            `ero=${edgeErode} fea=${feather} — ${width}x${height} — ${Math.round(resultB64.length / 1024)}KB`
        );

        return NextResponse.json({ result: resultB64 });
    } catch (err) {
        console.error("[chromakey] Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
