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
${BRAND_BRIEF}

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
            "detail-macro": `Generate a MACRO DETAIL SHOT focusing closely on: ${detailFocus || "the most distinctive detail of the product"}. Shallow depth of field, extreme close-up showing fabric texture, stitching quality, and material detail.`,
        };
        const instruction = ANGLE_INSTRUCTIONS[angleType] || ANGLE_INSTRUCTIONS["front"];

        // Build reference role assignments from descriptions
        // refDescriptions is an array like ["front view", "side view", "back detail"]
        let refBlock;
        if (refDescriptions && refDescriptions.length > 1) {
            const roles = refDescriptions.map((desc, i) => `- Image ${i + 1} shows the product's ${desc}.`).join('\n');
            refBlock = `REFERENCE IMAGES (${refDescriptions.length} views of the SAME product):
${roles}
Use ALL reference images together to understand the product's full 3D structure,
materials, colors, and construction details. The more views provided, the more
accurate your output should be — do NOT ignore any reference.`;
        } else {
            refBlock = `REFERENCE IMAGE:
The attached image is the product identity reference.`;
        }

        return `
${BRAND_BRIEF}

${refBlock}

INSTRUCTION:
${instruction}

PRODUCT IDENTITY (non-negotiable):
- This is the SAME product as in the references — not a similar one, not a recreation.
  Every color, pattern, material, hardware detail, and construction element must
  match the references EXACTLY.
- If the references show a pattern/print, it must appear consistently across all visible
  surfaces in the new angle, with correct continuity (no pattern breaks or misalignment).
- Use details visible in ANY of the reference images to inform the output.
  For example, if one reference shows the back and another shows the front, combine
  that knowledge to produce an accurate new angle.
${LOGO_PRESERVE_RULES}
${withNotes(notes)}
ANGLE REQUIREMENTS:
- The camera angle must be precisely ${angleType} — do not approximate or blend angles.
- Maintain consistent studio lighting across all angles: soft diffused light from top-left,
  gentle fill from right, subtle contact shadow below.
- The product must occupy the same approximate proportion of the frame as the first reference.

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

// New structured scene labels (separate from legacy presets)
export const STRUCTURED_SCENE_LABELS = {
    nursery_scene: "Chambre bébé (sans bébé)",
    baby_scene: "Scène avec bébé",
    outdoor_scene: "Scène extérieur",
};
