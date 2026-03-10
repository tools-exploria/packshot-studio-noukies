import { NextResponse } from "next/server";
import { appendFileSync } from "fs";
import { join } from "path";

const LOG_FILE = join(process.cwd(), "generations.log");

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
        const { prompt, images, resolution, aspectRatio, model: requestedModel } = body;

        if (!prompt) {
            return NextResponse.json({ status: "error", error: "Missing prompt" }, { status: 400 });
        }
        if (!images || !images.length) {
            return NextResponse.json({ status: "error", error: "Missing images" }, { status: 400 });
        }

        const imageSize = ["0.5K", "1K", "2K", "4K"].includes(resolution) ? resolution : "2K";
        const ratio = ["1:1", "4:3", "3:4", "16:9", "9:16", "2:3", "3:2", "4:5", "5:4"].includes(aspectRatio) ? aspectRatio : "1:1";
        const model = ALLOWED_MODELS.includes(requestedModel) ? requestedModel : DEFAULT_MODEL;

        console.log(`[generate] Calling OpenRouter (model: ${model}) — ${imageSize} ${ratio}`);
        console.log(`[generate] Prompt (first 200 chars): ${prompt.slice(0, 200)}`);

        // Build content array: text prompt + image(s)
        const content = [
            { type: "text", text: prompt },
            ...images.map((b64) => ({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${b64}` },
            })),
        ];

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
        const b64 = imageUrl.includes("base64,") ? imageUrl.split("base64,")[1] : imageUrl;
        console.log(`[generate] Success — image size: ${Math.round(b64.length / 1024)}KB`);

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
