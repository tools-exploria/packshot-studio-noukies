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

// ── Brand brief (Feature 7) ───────────────────────────
// Source: Google Cloud "Ultimate prompting guide for Nano Banana" — narrative > keywords
const BRAND_BRIEF = `
BRAND CONTEXT — NOUKIES:
Noukies is a Belgian premium baby brand embodying douceur (softness), tendresse (tenderness),
and qualité (quality). Every generated image must reflect this brand identity:
- COLOR PALETTE: Soft pastels — cream (#F5F0E8), powder pink (#F0D4D8), sage green (#B5C9A8),
  warm grey (#C4BAB0), lavender (#D4C8E0), soft sky blue (#BDD5E8). No saturated or neon colors.
- LIGHTING: Soft diffused natural light, as if filtered through sheer curtains. No harsh shadows,
  no dramatic contrast. Gentle warm tone (slightly golden).
- PHOTOGRAPHIC STYLE: High-end editorial baby brand — clean, airy, inviting. Think Bonpoint or
  Petit Bateau campaign photography.
- MATERIALS: Must read as premium, tactile — soft cotton, organic jersey, plush velvet.
  Never synthetic-looking or cheap.
- MOOD: Calm, reassuring, warm. Evokes safety and comfort for a newborn.`.trim();

// ── Logo/label preservation module (Feature 3) ────────
// Source: Google DeepMind Gemini prompt guide — explicit preservation prevents drift
const LOGO_PRESERVE_RULES = `
LOGO & LABEL PRESERVATION:
- IF and ONLY IF a brand logo, label, tag, or woven label is visible in the reference image,
  preserve it EXACTLY: same position, same size, same orientation, same text, same stitching style.
- Do NOT invent, add, or hallucinate any label, logo, or tag that is not clearly visible
  in the reference image.
- If no label or logo is visible in the reference, do NOT add one.`.trim();

// ── Baby realism rules (Feature 5) ────────────────────
// Sources: Content Authenticity Initiative (uncanny valley), fashn.ai (AI child models)
const BABY_REALISM_RULES = `
BABY REALISM (critical — avoid uncanny valley):
- The baby must be FULLY PHOTOREALISTIC — real skin texture with subtle pores and natural color variation.
- HANDS: Exactly 5 fingers per hand, naturally proportioned for the baby's age. Fingers must be
  slightly chubby with visible knuckle creases. No extra, missing, or fused fingers.
- EYES: Natural gaze direction, realistic iris detail with catchlight, age-appropriate eye size.
  No glassy, oversized, or doll-like eyes.
- SKIN: Soft, smooth with natural translucency. Subtle pink undertones on cheeks, knees, elbows.
  No plastic or wax-like texture.
- PROPORTIONS: Head-to-body ratio must match the specified age. Limbs must be naturally chubby
  for baby age.
- EXPRESSION: Natural, unstaged — a real moment, not a posed doll.`.trim();

const BABY_AGE_PROPS = {
    newborn: "0-1 month old newborn: very small, curled posture, head nearly same width as shoulders, minimal neck visible, tiny delicate features",
    "3-6-months": "3-6 month old baby: beginning to hold head up, rounder face, chubbier limbs, can sit with support, curious expression",
    "6-12-months": "6-12 month old baby: sitting independently, active and alert, proportionally larger body vs head, may be crawling or pulling up",
};

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

    // ─── Embroidery ────────────────────────────────────────
    // Used by: app/broderie/page.js
    // Images: [product, embroidery design]
    // Source: Google Cloud ref formula [Ref1: product] + [Ref2: embroidery] + [Relationship: stitch at placement]
    applyEmbroidery: (placement, notes) => `
INSTRUCTION:
The first image is the EXACT product reference. The second image is an embroidery design.
Apply the embroidery design from the second image onto the product, placed at: ${placement}.

${CRITICAL_RULES}
${LOGO_PRESERVE_RULES}
${withNotes(notes)}
EMBROIDERY APPLICATION:
- The embroidery must look PHYSICALLY STITCHED into the fabric — not printed, not overlaid,
  not digitally pasted.
- Reproduce the thread colors from the second image exactly. Render visible stitch texture:
  satin stitch for filled areas, backstitch or chain stitch for outlines.
- The embroidery must follow the curvature and folds of the fabric at the placement area
  (${placement}). If the fabric is curved or creased, the stitching must curve and crease with it.
- Scale the design proportionally to the placement area — it should look intentional and
  professionally sized, not too large or too small for the product.
- The surrounding fabric must show the slight puckering and texture change that real machine
  or hand embroidery creates on fabric.
- Maintain the fabric texture visible between and around the embroidered area.

${PRESERVE_RULES}
- All fabric areas outside the embroidery placement remain completely unchanged.

${OUTPUT_QUALITY}
    `,

    // ─── Alternate Angles ──────────────────────────────────
    // Used by: app/angles/page.js
    // Images: [product photo 1, product photo 2, ...] — 1 to N reference views
    // Source: Google Cloud multi-ref role assignment + Claid AI e-commerce angles guide
    alternateAngle: (angleType, detailFocus, notes, refDescriptions) => {
        const ANGLE_INSTRUCTIONS = {
            "front": "Generate a perfectly straight FRONT VIEW of this exact product, camera perpendicular to the product face, symmetrical framing.",
            "3/4-face": "Generate a THREE-QUARTER FRONT VIEW (approximately 45 degrees from front-left), showing both the front face and the left side of the product, slight perspective depth.",
            "profile": "Generate a clean SIDE PROFILE VIEW (90 degrees from front), showing the product's depth and side construction details.",
            "3/4-dos": "Generate a THREE-QUARTER BACK VIEW (approximately 45 degrees from back-right), showing both the back and the right side of the product.",
            "dos": "Generate a perfectly straight BACK VIEW of this exact product, camera perpendicular to the back, showing rear construction and closures if any.",
            "flat-lay": "Generate a FLAT LAY / TOP-DOWN VIEW of this product laid flat on a white surface, as if photographed directly from above. The product should be neatly arranged, slightly open if applicable, showing its full surface area.",
            "bottom": "Generate a BOTTOM VIEW of this product, camera directly underneath looking up. Show the underside, base, or sole of the product — seams, stitching, care labels if any.",
            "detail-macro": `Generate a MACRO DETAIL SHOT focusing closely on: ${detailFocus || "the most distinctive detail of the product"}. Shallow depth of field, extreme close-up showing fabric texture, stitching quality, and material detail.`,
        };
        const instruction = ANGLE_INSTRUCTIONS[angleType] || ANGLE_INSTRUCTIONS["front"];

        // Build reference role assignments from descriptions
        // refDescriptions is an array like [{label: "front view", role: "identity"}, ...]
        // role can be "identity" (color/pattern/material source) or "structure" (shape/construction reference only)
        let refBlock;
        if (refDescriptions && refDescriptions.length > 1) {
            const roles = refDescriptions.map((ref, i) => {
                if (i === 0) {
                    return `- Image 1 is the TARGET PRODUCT (${ref.label}): this defines the color, pattern, material, branding, and visual identity. The output must match THIS image's appearance.`;
                }
                if (ref.role === "structure") {
                    return `- Image ${i + 1} is a STRUCTURAL REFERENCE (${ref.label}): use it ONLY to understand the product's 3D shape, construction, and what the ${ref.label} looks like. IGNORE its color, pattern, and material — apply the TARGET PRODUCT's appearance instead.`;
                }
                return `- Image ${i + 1} shows the same product's ${ref.label}: use it to understand this angle's details while maintaining the target product's identity.`;
            }).join('\n');
            refBlock = `REFERENCE IMAGES:
${roles}

CRITICAL: Image 1 is ALWAYS the source of truth for visual identity (color, pattern, material,
branding). Other images provide structural/shape information only — their colors and materials
may differ and must NOT contaminate the output.`;
        } else {
            refBlock = `REFERENCE IMAGE:
The attached image is the product identity reference — it defines color, pattern, material, and shape.`;
        }

        return `
${refBlock}

INSTRUCTION:
${instruction}

PRODUCT IDENTITY (non-negotiable):
- The output must look like Image 1's product seen from the requested angle.
- Color, pattern, material, hardware, and branding must come from Image 1 ONLY.
- Use additional reference images to understand shape, construction, seams, closures,
  and 3D structure — but NEVER borrow their color or pattern.
${LOGO_PRESERVE_RULES}
${withNotes(notes)}
ANGLE REQUIREMENTS:
- The camera angle must be precisely ${angleType} — do not approximate or blend angles.
- Maintain consistent studio lighting across all angles: soft diffused light from top-left,
  gentle fill from right, subtle contact shadow below.
- The product must occupy the same approximate proportion of the frame as Image 1.

${OUTPUT_QUALITY}
`;
    },

    // ─── Nursery Scene (no baby) ───────────────────────────
    // Used by: app/ambiance/page.js (new scene type)
    // Images: [product]
    nurseryScene: (placement, mood, notes) => `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of this EXACT product in a cozy baby nursery scene. NO BABY in the scene.

SCENE SETUP:
- The product is placed: ${placement}.
- Mood: ${mood || "warm and serene, morning light"}.
- Setting: A beautifully styled modern nursery — light wood furniture (oak or birch), soft textiles,
  minimal tasteful decor. Walls in soft cream or very pale sage. A few curated accessories
  (wooden toys, a small plant, a knit blanket) but not cluttered.
- Lighting: Soft natural light from a nearby window, filtered through sheer linen curtains.
  Warm golden-hour tone. Gentle shadows, no harsh contrast.
- Color palette of the environment must complement the Noukies brand: soft pastels, cream, natural
  wood tones. No bright primary colors, no dark or moody tones.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference image — same shape, colors, pattern,
  materials, proportions. Do NOT modify, recolor, or simplify the product.
- The product is the HERO of the image — it should be the clear focal point, well-lit, sharp.
${LOGO_PRESERVE_RULES}
${withNotes(notes)}
OUTPUT:
Photorealistic interior photography, editorial quality, warm natural tones, shallow depth of field
with product in sharp focus. High-end baby brand campaign aesthetic.
    `,

    // ─── Baby Scene ────────────────────────────────────────
    // Used by: app/ambiance/page.js (new scene type)
    // Images: [product]
    // Sources: fashn.ai child models, Content Authenticity Initiative (anti-uncanny valley)
    babyScene: (babyAge, mood, notes) => `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of a real baby with this EXACT product.

BABY:
- Age: ${BABY_AGE_PROPS[babyAge] || BABY_AGE_PROPS["3-6-months"]}.
${BABY_REALISM_RULES}

SCENE:
- Mood: ${mood || "tender and peaceful"}.
- Setting: A warm, luminous nursery or living room with soft natural light.
- The baby is naturally interacting with the product — holding it, cuddling it, wearing it,
  or sitting/lying near it, depending on the product type and baby's age.
- Lighting: Soft diffused natural light, warm tone. The baby's skin must glow naturally.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same colors, pattern, materials,
  shape, proportions. It is the co-star of the image alongside the baby.
- Do NOT modify, recolor, simplify, or obscure the product.
${LOGO_PRESERVE_RULES}
${withNotes(notes)}
OUTPUT:
Photorealistic lifestyle photography, editorial baby brand quality, warm natural tones,
shallow depth of field. The image should evoke tenderness and comfort — a real moment
between a baby and their favorite object.
    `,

    // ─── Outdoor Scene ─────────────────────────────────────
    // Used by: app/ambiance/page.js (new scene type)
    // Images: [product]
    outdoorScene: (sceneType, mood, notes) => {
        const SCENE_SETTINGS = {
            "garden": "A lush private garden with soft green grass, flowering bushes in soft pastels (hydrangeas, peonies), a wicker basket nearby. Dappled sunlight through tree canopy.",
            "park-walk": "A tree-lined park path with soft morning light, a modern stroller visible in the background. Blurred bokeh of green foliage and golden light.",
            "morning-terrace": "A bright morning terrace with light stone flooring, a bistro chair, a cup of coffee, potted plants. Soft golden morning light streaming in.",
        };
        const setting = SCENE_SETTINGS[sceneType] || SCENE_SETTINGS["garden"];

        return `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of this EXACT product in a beautiful outdoor setting.

SCENE:
- Setting: ${setting}
- Mood: ${mood || "fresh and serene, early morning light"}.
- The product is naturally placed in the scene — on a blanket, in a basket, draped over
  furniture, or held by a parent's hands (hands only, no full person unless natural).
- Lighting: Natural outdoor light — soft, diffused, slightly golden. No harsh midday sun.
  If dappled light, keep it gentle and flattering on the product.
- Environment colors: Natural greens, soft earth tones, complementing the Noukies pastel palette.
  No harsh urban elements, no concrete, no artificial colors.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same colors, pattern, materials,
  shape, proportions. It is the hero of the scene.
${LOGO_PRESERVE_RULES}
${withNotes(notes)}
OUTPUT:
Photorealistic outdoor lifestyle photography, editorial baby brand quality, warm natural tones,
shallow depth of field with product in focus. Evokes a beautiful, calm moment outdoors.
`;
    },

    // ─── Ambiance scenes (legacy presets, upgraded) ───────────
    // Used by: app/ambiance/page.js
    // Images: [product]
    ambiance: {
        baby_sitting: `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of a happy 8-month-old baby sitting with this EXACT product.

BABY:
- Age: ${BABY_AGE_PROPS["6-12-months"]}.
- The baby is sitting upright, naturally interacting with the product — holding it, touching it,
  or sitting in/on it depending on the product type.
${BABY_REALISM_RULES}

SCENE:
- Setting: A bright modern nursery with warm natural light from a window.
  Light wood furniture, soft textiles, minimal decor. Walls in soft cream.
- Lighting: Soft diffused natural light, warm golden tone.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same pattern, colors, materials,
  shape, proportions. Do NOT modify, recolor, or simplify the product.
${LOGO_PRESERVE_RULES}

OUTPUT:
Photorealistic lifestyle photography, editorial baby brand quality, warm natural tones,
shallow depth of field. Tender, joyful moment.
`,
        baby_sleeping: `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of a peaceful sleeping baby cuddling with this EXACT product.

BABY:
- Age: ${BABY_AGE_PROPS["3-6-months"]}.
- The baby is sleeping peacefully, cuddling or wrapped in the product.
  Relaxed posture, eyes closed, serene expression.
${BABY_REALISM_RULES}

SCENE:
- Setting: A cozy nursery, soft morning light filtering through sheer curtains.
  Warm muted tones, plush bedding, calm atmosphere.
- Lighting: Very soft, diffused, warm. No harsh light on the baby's face.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same pattern, colors, materials,
  shape, proportions. Do NOT modify, recolor, or simplify the product.
${LOGO_PRESERVE_RULES}

OUTPUT:
Photorealistic lifestyle photography, editorial baby brand quality, warm tender tones,
shallow depth of field. Evokes peace and comfort.
`,
        parent_carrying: `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of a young mother carrying or holding this EXACT product
while in a bright, airy living room.

- The mother's hands must be realistic — correct finger count, natural proportions.
- The product is clearly visible and the focal point of the image.
- The mother is partially visible (torso/arms) or seen from behind — the focus is on the product,
  not the parent's face.

SCENE:
- Setting: A bright, airy living room with natural light. Modern, warm decor.
- Lighting: Soft natural light, warm editorial tone.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same pattern, colors, materials,
  shape, proportions. Do NOT modify, recolor, or simplify the product.
${LOGO_PRESERVE_RULES}

OUTPUT:
Photorealistic lifestyle photography, editorial baby brand quality, warm natural tones.
`,
        nursery_decor: `
${BRAND_BRIEF}

TASK: Generate an interior design photo of this EXACT product placed in a beautifully styled
modern nursery. NO BABY in the scene.

SCENE:
- Setting: An elegant modern nursery — light wood furniture (oak or birch), soft textiles,
  curated accessories (wooden toys, small plant, knit blanket). Walls in soft cream or pale sage.
- The product is the HERO of the image — prominently placed, well-lit, sharp focus.
- Lighting: Soft natural light from a window, warm golden-hour tone.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same pattern, colors, materials,
  shape, proportions. Do NOT modify, recolor, or simplify the product.
${LOGO_PRESERVE_RULES}

OUTPUT:
Photorealistic interior photography, editorial quality, warm natural tones, shallow depth of field
with product in sharp focus. High-end baby brand campaign aesthetic.
`,
        in_situation: `
${BRAND_BRIEF}

TASK: Generate a lifestyle photo of this EXACT product installed and in realistic use —
on a dining chair, in a stroller, in a car seat, or another natural usage context
appropriate for the product type.

SCENE:
- Setting: A realistic everyday environment — clean, well-lit, warm tones.
  Natural context where a parent would actually use this product.
- Lighting: Natural light, soft and warm. No studio feel — real-life atmosphere.

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same pattern, colors, materials,
  shape, proportions. Do NOT modify, recolor, or simplify the product.
${LOGO_PRESERVE_RULES}

OUTPUT:
Photorealistic lifestyle photography, natural setting, warm tones. The product must be
clearly recognizable and the focal point.
`,
    },

    // ─── Custom ambiance wrapper ────────────────────────────
    // Used by: app/ambiance/page.js  (mode = prompt personnalisé)
    // Wraps user input in a system prompt that enforces product fidelity.
    ambianceCustom: (userPrompt) => `
${BRAND_BRIEF}

TASK: Generate a lifestyle/ambiance photo featuring this EXACT product.

SCENE DESCRIPTION:
${userPrompt}

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference image — same shape, colors, materials,
  pattern, proportions. Do NOT modify, recolor, or alter the product in any way.
- The product should be naturally integrated into the scene, with realistic lighting and perspective.
${LOGO_PRESERVE_RULES}

OUTPUT:
Photorealistic, editorial quality, warm natural tones.`.trim(),

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

// New structured scene labels (separate from legacy presets)
export const STRUCTURED_SCENE_LABELS = {
    nursery_scene: "Chambre bébé (sans bébé)",
    baby_scene: "Scène avec bébé",
    outdoor_scene: "Scène extérieur",
};
