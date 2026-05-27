import { NextResponse } from "next/server";
import { appendFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";

const LOG_FILE = join(process.cwd(), "generations.log");

// Vercel serverless functions cap the response body at ~4.5MB on Hobby plan.
// 4K NB2 outputs can exceed this in PNG, producing "Unterminated string in
// JSON at position 10MB" errors client-side because the JSON gets truncated
// mid-stream. We re-encode to JPEG q92 above this threshold — JPEG q92 is
// visually identical to PNG for photographic content but roughly 1/5 the
// size, so a 10MB PNG comfortably fits as a 1-2MB JPEG.
const RESPONSE_SIZE_THRESHOLD_BYTES = 4 * 1024 * 1024;
const JPEG_FALLBACK_QUALITY = 92;

// Chroma flatten — used when the caller is preparing a green-screen-style
// image for chromakey. NB2 / Gemini Flash Image is known to be unreliable
// at producing perfectly uniform chroma backgrounds (see DEV.to Google AI
// account: "asking Nano Banana to make the image transparent directly is
// unreliable") — at 4K it produces a mottled checker-like pattern of
// near-green tones (#00FF00, #80E080, #C0E0C0…). Our chromakey then leaves
// alpha holes on the lighter greens.
//
// Fix: any pixel whose chroma-key score exceeds FLATTEN_THRESHOLD is
// replaced by the pure chroma RGB. This guarantees a uniform background
// before chromakey runs.
//
// Threshold 30 was chosen after analysing the Noukies palette: the most
// at-risk colour is sage green #B5C9A8 which has a green key of +20 — under
// the threshold, so it stays as product. The lightest damier green pixels
// observed (#C0E5C0 type) are around +37, above the threshold, so they get
// flattened. 10-point safety margin.
const FLATTEN_THRESHOLD = 30;
const CHROMA_PURE_RGB = {
    green: [0, 255, 0],
    magenta: [255, 0, 255],
    blue: [0, 0, 255],
};

async function flattenChromaBackground(b64, chromaColor) {
    if (!CHROMA_PURE_RGB[chromaColor]) return b64; // unknown colour → pass-through

    const [pureR, pureG, pureB] = CHROMA_PURE_RGB[chromaColor];
    const buffer = Buffer.from(b64, "base64");

    // Decode to raw RGBA so we can manipulate pixels directly.
    const { data, info } = await sharp(buffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const pixels = Buffer.from(data);

    let flattenedCount = 0;
    for (let i = 0; i < pixels.length; i += channels) {
        const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
        let keyRaw;
        if (chromaColor === "blue") keyRaw = b - Math.max(r, g);
        else if (chromaColor === "magenta") keyRaw = (r + b) * 0.5 - g;
        else keyRaw = g - Math.max(r, b);

        if (keyRaw > FLATTEN_THRESHOLD) {
            pixels[i] = pureR;
            pixels[i + 1] = pureG;
            pixels[i + 2] = pureB;
            flattenedCount++;
        }
    }

    const totalPixels = width * height;
    const flattenedPct = Math.round((flattenedCount / totalPixels) * 100);
    console.log(`[generate] Flatten ${chromaColor}: ${flattenedPct}% of pixels flattened (${flattenedCount}/${totalPixels})`);

    // Re-encode as PNG. The JPEG q92 fallback that runs after this will
    // re-encode if needed for size. JPEG can introduce tiny block artifacts
    // on the flat areas but they're well within the chromakey tolerance.
    const out = await sharp(pixels, { raw: { width, height, channels } })
        .png({ compressionLevel: 9 })
        .toBuffer();
    return out.toString("base64");
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY;
const DEFAULT_MODEL = process.env.OPENROUTER_MODEL || "google/gemini-3-pro-image-preview";
const ALLOWED_MODELS = [
    "google/gemini-3-pro-image-preview",
    "google/gemini-3.1-flash-image-preview",
];

/**
 * POST /api/generate
 * Body: { prompt: string, images: string[] }
 * Response: { status: "success", image: string } or { status: "error", error: string }
 *
 * Generates a SINGLE image variant. The client fires multiple
 * parallel calls for progressive loading + avoids timeout issues.
 */
export async function POST(request) {
    try {
        if (!API_KEY) {
            return NextResponse.json({ status: "error", error: "OPENROUTER_API_KEY not configured" }, { status: 500 });
        }

        const body = await request.json();
        const { prompt, images, parts, resolution, aspectRatio, model: requestedModel, flattenChroma } = body;

        // Support two formats:
        // 1. Interleaved parts: { parts: [{type:"text",text:"..."},{type:"image",data:"b64"},…] }
        // 2. Legacy flat:       { prompt: "...", images: ["b64_1","b64_2"] }
        const useInterleaved = Array.isArray(parts) && parts.length > 0;

        if (!useInterleaved) {
            if (!prompt) {
                return NextResponse.json({ status: "error", error: "Missing prompt" }, { status: 400 });
            }
            if (!images || !images.length) {
                return NextResponse.json({ status: "error", error: "Missing images" }, { status: 400 });
            }
        }

        const imageSize = ["0.5K", "1K", "2K", "4K"].includes(resolution) ? resolution : "2K";
        const ratio = ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "4:5", "5:4"].includes(aspectRatio) ? aspectRatio : "1:1";
        const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;

        console.log(`[generate] Calling OpenRouter (model: ${model}) — ${imageSize} ${ratio} — ${useInterleaved ? "interleaved" : "legacy"}`);

        // Build content array
        let content;
        if (useInterleaved) {
            // Interleaved format: [{type:"text",text:...},{type:"image",data:...},...]
            content = parts.map((part) => {
                if (part.type === "image") {
                    return { type: "image_url", image_url: { url: `data:image/jpeg;base64,${part.data}` } };
                }
                return { type: "text", text: part.text };
            });
            const firstText = parts.find((p) => p.type === "text");
            console.log(`[generate] Prompt (first 200 chars): ${(firstText?.text || "").slice(0, 200)}`);
        } else {
            // Legacy format: text prompt + image(s)
            content = [
                { type: "text", text: prompt },
                ...images.map((b64) => ({
                    type: "image_url",
                    image_url: { url: `data:image/jpeg;base64,${b64}` },
                })),
            ];
            console.log(`[generate] Prompt (first 200 chars): ${prompt.slice(0, 200)}`);
        }

        const requestBody = {
            model: model,
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            image_config: { image_size: imageSize, aspect_ratio: ratio },
            stream: false,
        };

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 120_000);

        const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://packshot-studio.vercel.app",
                "X-Title": "Packshot Studio",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        clearTimeout(timeout);

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[generate] HTTP ${res.status}:`, errBody.slice(0, 300));
            return NextResponse.json({ status: "error", error: `API error ${res.status}` }, { status: 200 });
        }

        const data = await res.json();

        // Extract the generated image
        const imageUrl = data.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (!imageUrl) {
            console.error("[generate] No image in response");
            return NextResponse.json({ status: "error", error: "No image in API response" }, { status: 200 });
        }

        // Extract base64 from data URL
        let b64 = imageUrl.includes("base64,") ? imageUrl.split("base64,")[1] : imageUrl;
        const originalSizeKB = Math.round(b64.length / 1024);
        console.log(`[generate] Success — image size: ${originalSizeKB}KB`);

        // Optional chroma flatten — caller passes flattenChroma="green"|"magenta"|"blue"
        // when preparing a green-screen image for chromakey. Forces uniform
        // chroma background so the downstream chromakey gets a clean input.
        if (flattenChroma && CHROMA_PURE_RGB[flattenChroma]) {
            try {
                b64 = await flattenChromaBackground(b64, flattenChroma);
            } catch (err) {
                console.warn(`[generate] Flatten failed, sending original:`, err.message);
            }
        }

        // Conditional JPEG q92 re-encode when the response would exceed Vercel's
        // ~4.5MB body cap. Only kicks in for 4K outputs typically (1K/2K stay
        // well under, passed through unchanged). JPEG q92 of a photograph is
        // visually identical to the PNG source but ~5x smaller.
        if (b64.length > RESPONSE_SIZE_THRESHOLD_BYTES) {
            try {
                const buffer = Buffer.from(b64, "base64");
                const compressed = await sharp(buffer)
                    .jpeg({ quality: JPEG_FALLBACK_QUALITY, mozjpeg: true })
                    .toBuffer();
                b64 = compressed.toString("base64");
                console.log(`[generate] Output ${originalSizeKB}KB → ${Math.round(b64.length / 1024)}KB (JPEG q${JPEG_FALLBACK_QUALITY} fallback, was >4MB)`);
            } catch (err) {
                console.warn(`[generate] JPEG re-encode failed, sending original ${originalSizeKB}KB (may be truncated by Vercel):`, err.message);
            }
        }

        // Log to file for tracking
        try {
            const line = `${new Date().toISOString()} | model=${model} | res=${imageSize} | ratio=${ratio} | size=${Math.round(b64.length / 1024)}KB\n`;
            appendFileSync(LOG_FILE, line);
        } catch (_) { /* ignore write errors */ }

        return NextResponse.json({ status: "success", image: b64 });
    } catch (err) {
        const errorMsg = err.name === "AbortError" ? "Timeout (120s)" : err.message;
        console.error("[generate] Error:", errorMsg);
        return NextResponse.json({ status: "error", error: errorMsg }, { status: 200 });
    }
}
