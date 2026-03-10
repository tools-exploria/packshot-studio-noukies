// ─────────────────────────────────────────────────────────────
// Centralized prompt templates for all generation modes.
// Every prompt used by the app lives here — no inline strings.
// ─────────────────────────────────────────────────────────────

// ── Shared building blocks ──────────────────────────────────

const CRITICAL_RULES = `
CRITICAL RULES (non-negotiable):
- Do NOT add, remove, or modify any non-fabric element. Every strap, buckle, zipper,
  button, snap, ribbon, label, stitching, and hardware visible in the reference must
  appear in the output IDENTICALLY — same position, same color, same material.
- Do NOT invent or add new elements that are not present in the reference.
- The background must remain PURE WHITE (#FFFFFF). No texture, no shadow, no color bleed.`.trim();

const PRESERVE_RULES = `
PRESERVE FROM THE REFERENCE:
- Product shape, proportions, silhouette, 3D form, and camera angle.
- All non-fabric materials: plastic, metal, wood, elastic, mesh — unchanged.
- Lighting direction and intensity.`.trim();

const OUTPUT_QUALITY = `
OUTPUT:
Ultra-realistic studio packshot on pure white seamless background, centered product,
soft diffused lighting, gentle contact shadow, commercial e-commerce quality.`.trim();

function withNotes(notes) {
    return notes ? `\nPRODUCT-SPECIFIC NOTES:\n${notes}\n` : '';
}

// ── Prompt builders ─────────────────────────────────────────

export const PROMPTS = {

    // ─── Pattern ────────────────────────────────────────────
    // Used by: app/pattern/page.js
    // Images: [product, tiled pattern]
    applyPattern: `
INSTRUCTION:
Using the first image as the EXACT structural reference, replace ONLY the printed/patterned
fabric surfaces with the seamless repeating pattern shown in the second image.

${CRITICAL_RULES}

{PRODUCT_NOTES}
PATTERN APPLICATION:
- Apply the pattern from the second image to ALL fabric surfaces at consistent scale.
- The pattern must wrap naturally around curves, folds, and 3D volume of the product.
- Preserve the exact colors of the pattern file — do not shift, saturate, or alter them.
- Seamless tiling with no visible repeat boundaries and no stretching.

${PRESERVE_RULES}

${OUTPUT_QUALITY}
    `,

    // ─── Solid color ────────────────────────────────────────
    // Used by: app/couleur/page.js  (mode = couleur unie)
    // Images: [product]
    solidColor: (hex, name, notes) => `
INSTRUCTION:
Using this image as the EXACT structural reference, replace ONLY the printed/patterned/colored
fabric surfaces with a uniform solid color: ${hex} (${name}).

${CRITICAL_RULES}
${withNotes(notes)}
COLOR APPLICATION:
- Apply the solid color ${hex} uniformly to ALL fabric surfaces.
- The color must interact naturally with the product's 3D volume: lighter on highlights,
  darker in folds and creases — exactly as a real dyed fabric would behave under studio lighting.
- Maintain realistic fabric texture and weave visible in the original — the surface should
  NOT look flat, painted, or digitally filled. It must read as real dyed textile.

${PRESERVE_RULES}
- Fabric texture/weave grain from the original (only the color changes, not the material).

${OUTPUT_QUALITY}
    `,

    // ─── Texture ────────────────────────────────────────────
    // Used by: app/couleur/page.js  (mode = texture uploadée)
    // Images: [product, texture swatch]
    applyTexture: (notes) => `
INSTRUCTION:
Using the first image as the EXACT structural reference, replace ONLY the fabric surfaces
with the textile material shown in the second image, matching both its color AND its
physical texture (weave, grain, sheen, surface relief).

${CRITICAL_RULES}
${withNotes(notes)}
MATERIAL APPLICATION:
- Apply the fabric material from the second image to ALL textile surfaces.
- Reproduce both the COLOR and the PHYSICAL TEXTURE of the material: if it is velvet,
  render velvet pile and sheen. If it is corduroy, render the ribs. If it is linen,
  render the coarse weave. If it is jersey, render the knit loops.
- The material must wrap naturally around curves, folds, and 3D volume of the product,
  with realistic light interaction matching the fabric type (matte for cotton, subtle
  sheen for satin, soft pile for velvet, etc.).
- Preserve the exact colors from the second image — do not shift, saturate, or alter them.

${PRESERVE_RULES}

${OUTPUT_QUALITY}
    `,

    // ─── Ambiance scenes ────────────────────────────────────
    // Used by: app/ambiance/page.js
    // Images: [product]
    ambiance: {
        baby_sitting:
            "A happy 8-month-old baby sitting in/with [this exact product], in a bright modern nursery with warm natural light. The product must look EXACTLY as shown in the reference image — same pattern, colors, proportions. Photorealistic, editorial style, soft warm tones.",
        baby_sleeping:
            "A peaceful sleeping baby cuddling with [this exact product], soft morning light filtering through sheer curtains, cozy nursery setting. The product must look EXACTLY as shown — same pattern, colors, proportions. Photorealistic, tender, warm tones.",
        parent_carrying:
            "A young mother carrying [this exact product] while walking in a bright, airy living room. Lifestyle photography, natural light. The product must look EXACTLY as shown — same pattern, colors. Photorealistic, warm editorial style.",
        nursery_decor:
            "This exact product placed in a beautifully styled modern nursery, surrounded by elegant decor — wooden furniture, soft textiles, plants. Interior design photography, natural light. The product is the hero, EXACTLY as shown — same pattern, colors, proportions.",
        in_situation:
            "This exact product installed and in use — on a dining chair / in a stroller / in a car seat, realistic usage context. The product must look EXACTLY as shown — same pattern, colors. Photorealistic, natural setting, warm tones.",
    },

    // ─── Custom ambiance wrapper ────────────────────────────
    // Used by: app/ambiance/page.js  (mode = prompt personnalisé)
    // Wraps user input in a system prompt that enforces product fidelity.
    ambianceCustom: (userPrompt) => `
TASK: Generate a lifestyle/ambiance photo featuring this EXACT product.

SCENE DESCRIPTION:
${userPrompt}

CRITICAL RULES:
- The product must appear EXACTLY as shown in the reference image — same shape, colors, materials, pattern, proportions.
- Do NOT modify, recolor, or alter the product in any way.
- The product should be naturally integrated into the scene, with realistic lighting and perspective.
- Photorealistic, editorial quality, warm natural tones.`.trim(),

    // ─── 3D Product Generation ───────────────────────────────
    // Used by: app/3d-produit/page.js
    // Images: [product technical sheet, fabric swatch]
    product3D:
        "Using the attached swaddle as the structure and the attached coton jacquard as the texture, transform this into a high-fidelity 3D swaddle render. Create a product shot for e-commerce, with white background.",

    // ─── Export backgrounds ─────────────────────────────────
    // Used by: hooks/useExportPipeline.js
    whiteBg:
        "Place this EXACT product on a perfectly PURE WHITE (#FFFFFF) background. No shadow. Keep the product EXACTLY as-is: same shape, colors, materials, angle. Professional e-commerce packshot quality.",

    chromaKeyBg: (hex, colorName) =>
        `Place this EXACT product on a perfectly UNIFORM, FLAT ${hex} pure ${colorName} background. NO shadows, NO reflections, NO gradient — just solid ${hex} everywhere around the product. Keep the product EXACTLY as-is: same shape, colors, materials, angle. The ${colorName} must extend to every edge of the image.`,
};

// ─── Scene labels (for the ambiance UI) ─────────────────────
export const SCENE_LABELS = {
    baby_sitting: "Bébé assis avec le produit",
    baby_sleeping: "Bébé dormant avec le produit",
    parent_carrying: "Parent portant le produit",
    nursery_decor: "Produit dans un décor chambre",
    in_situation: "Produit en situation",
};
