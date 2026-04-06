import { NextResponse } from "next/server";
import sharp from "sharp";

// Resize & export images
// Query params: format (WxH), background (white|transparent), output (png|jpg)
export async function POST(request) {
    try {
        const body = await request.json();
        const { images, format, background = "white", output = "png" } = body;

        if (!images || !images.length) {
            return NextResponse.json({ error: "No images provided" }, { status: 400 });
        }

        // Parse target size if provided
        let targetW, targetH;
        if (format) {
            [targetW, targetH] = format.split("x").map(Number);
            if (!targetW || !targetH) {
                return NextResponse.json({ error: "Invalid format" }, { status: 400 });
            }
        }

        const bg = background === "transparent"
            ? { r: 0, g: 0, b: 0, alpha: 0 }
            : { r: 255, g: 255, b: 255, alpha: 1 };

        const results = [];
        for (const imgB64 of images) {
            const buffer = Buffer.from(imgB64, "base64");
            let pipeline = sharp(buffer);

            if (targetW && targetH) {
                pipeline = pipeline.resize(targetW, targetH, { fit: "cover", position: "centre" });
            }

            // JPG or non-transparent: flatten onto white background
            if (output === "jpg" || background !== "transparent") {
                pipeline = pipeline.flatten({ background: { r: 255, g: 255, b: 255 } });
            }

            if (output === "jpg") {
                const result = await pipeline.jpeg({ quality: 95 }).toBuffer();
                results.push(result.toString("base64"));
            } else {
                const result = await pipeline.png().toBuffer();
                results.push(result.toString("base64"));
            }
        }

        return NextResponse.json({ results, format: format || "native", output, count: results.length });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

