import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/tile
 * FormData: file (image), density (number), canvasWidth, canvasHeight
 *
 * Creates a seamless tiled image:
 * 1. Scale the tile uniformly (keep aspect ratio) so ~density tiles fit across the canvas width
 * 2. Compute how many whole tiles are needed to cover the canvas (ceil)
 * 3. Create an oversized canvas filled with whole tiles
 * 4. Crop the result to the target canvas dimensions
 *
 * The tile is NEVER distorted. Partial tiles on the right/bottom edges are cropped cleanly.
 */
export async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get("file");
        const density = parseInt(formData.get("density"), 10) || 3;
        const canvasWidth = parseInt(formData.get("canvasWidth"), 10) || 2048;
        const canvasHeight = parseInt(formData.get("canvasHeight"), 10) || 2048;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (density < 1 || density > 20) {
            return NextResponse.json({ error: "Density must be 1-20" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        const metadata = await sharp(buffer).metadata();
        const origW = metadata.width;
        const origH = metadata.height;

        // Scale tile uniformly so ~density tiles fit across the canvas width
        const scaledTileW = Math.round(canvasWidth / density);
        const scale = scaledTileW / origW;
        const scaledTileH = Math.round(origH * scale);

        // Resize tile uniformly (no distortion)
        const tileBuffer = await sharp(buffer)
            .resize(scaledTileW, scaledTileH, { fit: "fill" }) // uniform scale, both dims computed
            .png()
            .toBuffer();

        // Compute how many tiles needed to fully cover the canvas
        const cols = Math.ceil(canvasWidth / scaledTileW);
        const rows = Math.ceil(canvasHeight / scaledTileH);
        const overW = cols * scaledTileW;
        const overH = rows * scaledTileH;

        // Compose all tiles onto an oversized canvas
        const composites = [];
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                composites.push({ input: tileBuffer, left: c * scaledTileW, top: r * scaledTileH });
            }
        }

        const result = await sharp({
            create: {
                width: overW,
                height: overH,
                channels: 4,
                background: { r: 255, g: 255, b: 255, alpha: 1 },
            },
        })
            .composite(composites)
            .extract({ left: 0, top: 0, width: canvasWidth, height: canvasHeight }) // crop to target
            .png()
            .toBuffer();

        return new Response(result, {
            headers: {
                "Content-Type": "image/png",
                "Content-Disposition": `attachment; filename="tiled_x${density}_${canvasWidth}x${canvasHeight}.png"`,
                "X-Canvas-Width": String(canvasWidth),
                "X-Canvas-Height": String(canvasHeight),
                "X-Tile-Width": String(scaledTileW),
                "X-Tile-Height": String(scaledTileH),
                "X-Grid": `${cols}x${rows}`,
                "X-Tiles": String(cols * rows),
            },
        });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
