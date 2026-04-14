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
// LOGO_PRESERVE_RULES — disabled: model tends to hallucinate labels when this is active.
// The existing CRITICAL_RULES already covers label preservation via "every label visible
// in the reference must appear identically". Uncomment if needed in the future.
//
// const LOGO_PRESERVE_RULES = `
// LOGO & LABEL PRESERVATION:
// - IF and ONLY IF a brand logo, label, tag, or woven label is visible in the reference image,
//   preserve it EXACTLY: same position, same size, same orientation, same text, same stitching style.
// - Do NOT invent, add, or hallucinate any label, logo, or tag that is not clearly visible
//   in the reference image.
// - If no label or logo is visible in the reference, do NOT add one.`.trim();

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
    "0-3-months": "0-3 month old baby lying down: very small, naturally curled posture, head nearly same width as shoulders, minimal neck visible, tiny delicate features, thin translucent skin with subtle mottling, tiny curled fists, sleeping peacefully or drowsy with half-open eyes",
    "6-12-months": "6-12 month old baby sitting upright independently: round chubby face with filled-out cheeks, visible arm rolls and wrist creases, bright alert eyes, palmar grasp on objects, may have 1-2 tiny teeth, fine baby hair, stable sitting posture with legs in butterfly position",
    "2-3-years": "2-3 year old toddler standing confidently: leaner limbs but still rounded, proportionally larger head (1/5 of body length), characteristic slight pot belly with belly-forward stance, full set of small baby teeth, fuller hair, animated expressive face, slightly wide-legged gait",
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
${withNotes(notes)}
OUTPUT:
Photorealistic interior photography, editorial quality, warm natural tones, shallow depth of field
with product in sharp focus. High-end baby brand campaign aesthetic.
    `,

    // ─── Baby Scene ────────────────────────────────────────
    // Used by: app/ambiance/page.js (new scene type)
    // Images: [product]
    // Sources: fashn.ai child models, Content Authenticity Initiative (anti-uncanny valley)
    babyScene: (babyAge, mood, notes) => {
        const AGE_SCENES = {
            "0-3-months": {
                pose: `The baby is lying down on a soft surface — on their back or gently on their side in a natural curled posture. The product is placed next to the baby, draped over them, or the baby is wrapped/cuddled in it, depending on the product type.`,
                setting: `A cozy nursery with soft morning light filtering through sheer linen curtains. Plush cream bedding, warm muted tones, calm and hushed atmosphere.`,
                camera: `Shot slightly from above at a 30-40 degree angle looking down at the baby, 85mm f/1.8 lens, shallow depth of field with baby's face in sharp focus.`,
                defaultMood: "peaceful and intimate, a quiet tender moment",
            },
            "6-12-months": {
                pose: `The baby is sitting upright on the floor or on a soft blanket, naturally interacting with the product — holding it with both chubby hands, examining it with curiosity, or sitting in/on it depending on the product type. Slight natural wobble in posture, not rigidly upright.`,
                setting: `A bright modern nursery with warm natural light from a large window. Light oak furniture, soft textiles, minimal decor. Walls in soft cream or pale sage.`,
                camera: `Shot at eye-level with the sitting baby, 50mm f/2.0 lens, shallow depth of field with baby and product both in focus.`,
                defaultMood: "joyful and curious, a playful moment of discovery",
            },
            "2-3-years": {
                pose: `The toddler is standing confidently, holding the product against their chest, carrying it, or naturally interacting with it while standing. Characteristic toddler posture: slight belly-forward stance, slightly wide-legged. The child looks natural and unposed — a real candid moment, not a stiff studio portrait.`,
                setting: `A warm, beautifully styled children's bedroom with soft natural light. Light wood furniture, a small bookshelf with picture books, soft rug on the floor, walls in warm cream or soft pastel tones.`,
                camera: `Shot at the toddler's eye level or slightly below, 35mm f/2.8 lens, soft depth of field capturing the full standing figure with a gently blurred background.`,
                defaultMood: "warm and lively, a spontaneous moment of childhood",
            },
        };

        const scene = AGE_SCENES[babyAge] || AGE_SCENES["6-12-months"];

        return `
${BRAND_BRIEF}

TASK: Generate a photorealistic lifestyle photo of a real baby with this EXACT product.

BABY:
- ${BABY_AGE_PROPS[babyAge] || BABY_AGE_PROPS["6-12-months"]}.
- ${scene.pose}
${BABY_REALISM_RULES}

SCENE:
- Mood: ${mood || scene.defaultMood}.
- Setting: ${scene.setting}
- Lighting: Soft diffused natural light, warm golden tone. The baby's skin must glow naturally with real skin texture — subtle pores, natural translucency, pink undertones on cheeks. No plastic or waxy look.
- Camera: ${scene.camera}

PRODUCT FIDELITY:
- The product must appear EXACTLY as shown in the reference — same colors, pattern, materials,
  shape, proportions. It is the co-star of the image alongside the baby.
- Do NOT modify, recolor, simplify, or obscure the product.
${withNotes(notes)}
OUTPUT:
Photorealistic lifestyle photography, Kodak Portra 400 color science, editorial baby brand quality.
A real, unstaged moment between a child and their favorite object.
`;
    },

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
${withNotes(notes)}
OUTPUT:
Photorealistic outdoor lifestyle photography, editorial baby brand quality, warm natural tones,
shallow depth of field with product in focus. Evokes a beautiful, calm moment outdoors.
`;
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

OUTPUT:
Photorealistic, editorial quality, warm natural tones.`.trim(),

    // ─── 3D Product Generation ───────────────────────────────
    // Used by: app/3d-produit/page.js
    // Images: [product technical sheet, fabric swatch]
    product3D: (notes) => `
INSTRUCTION:
The first image is a product technical sheet or flat reference showing the product's structure,
shape, and construction. The second image is a fabric swatch showing the material to apply.

Using the first image as the EXACT structural blueprint, and the second image as the textile
material, generate a high-fidelity 3D product render that combines both.
${withNotes(notes)}
3D RENDERING:
- Reconstruct the product from the technical sheet into a realistic three-dimensional form,
  as if photographed in a professional studio.
- Apply the fabric material from the second image to all textile surfaces of the product,
  reproducing both its color AND physical texture (weave, grain, sheen, surface relief).
- The material must wrap naturally around the product's 3D volume — folds, curves, seams,
  and edges must behave as real fabric would under gravity and tension.
- Render realistic light interaction matching the fabric type: matte for cotton, subtle sheen
  for satin, soft pile for velvet, visible ribs for corduroy, knit loops for jersey.

PRESERVE:
- All structural details from the technical sheet: dimensions, proportions, closures, straps,
  snaps, zippers, elastic, stitching lines, and construction elements.
- The exact colors and texture of the fabric swatch — do not shift, saturate, or alter them.

${OUTPUT_QUALITY}
    `,

    // ─── Sketch to Packshot ───────────────────────────────────
    // Used by: app/labo/sketch-to-packshot/page.js
    // Images: interleaved via lib/interleaved.js (manifest + role labels)
    // Typical inputs: [product photo (smartphone/packshot), sketch/croquis]
    // Optional: existing product references (to borrow material, colour, hardware, etc.)
    //
    // NOTE: This prompt is the INSTRUCTION block only. The image manifest and
    // per-image role labels are generated by buildInterleavedParts() and placed
    // BEFORE this instruction in the content array.
    sketchToPackshot: (notes) => `
INSTRUCTION:
You have received one or more reference images with explicit roles described above.
Your task is to generate a PROFESSIONAL STUDIO PACKSHOT using the information
from each image according to its assigned role.

WORKFLOW:
1. READ THE MANIFEST above carefully — it tells you what each image is and what to
   extract from it. Follow it strictly.
2. If a PHOTO REFERENCE is provided, extract its real-world appearance: colours,
   patterns, materials, textures, hardware, branding elements.
3. If a SKETCH/DRAWING is provided, interpret it as a STRUCTURAL GUIDE — extract the
   desired shape, silhouette, proportions, and construction. The sketch is a design
   intent, not a literal rendering. Translate its rough lines into clean, realistic
   product geometry.
4. If BOTH a photo and a sketch are provided, combine them: use the STRUCTURE from
   the sketch and the VISUAL IDENTITY (colour, pattern, material) from the photo.
5. If only ONE image is provided, use it as the sole reference — extract everything
   you can from it (structure + visual identity) and generate a clean packshot.
6. If EXISTING PRODUCT REFERENCES are provided, they are packshots of other products
   from the same catalogue. Read their description carefully — it tells you exactly
   what to borrow (e.g., "the green velvet fabric", "the gold zip"). Extract ONLY
   what the description says. Do NOT borrow shape or structure from these images.

${CRITICAL_RULES}
${withNotes(notes)}
SKETCH INTERPRETATION:
- The sketch may be rough, hand-drawn, or low-fidelity — this is expected.
- Extract DESIGN INTENT, not literal rendering: if lines are wobbly, the real product
  should still have clean, professional construction.
- If the sketch shows annotations, arrows, or text notes, interpret them as design
  instructions (e.g., "zip here" means add a zipper at that location).
- If the sketch contradicts the photo reference on STRUCTURE (shape, proportions),
  follow the sketch — it represents the desired design evolution.
- If the sketch contradicts the photo reference on VISUAL IDENTITY (colour, material),
  follow the photo — the sketch is structural only.

PHOTO REFERENCE INTERPRETATION:
- If the photo is a smartphone shot with poor lighting or busy background, focus on
  the PRODUCT ITSELF — ignore the environment, lighting artefacts, and background noise.
- Extract: exact colours (match them), pattern/print, fabric texture and weave,
  hardware finish (metal colour, plastic type), label/branding placement.

${PRESERVE_RULES}

${OUTPUT_QUALITY}
`,

    // ─── Pliage / Arrangement ─────────────────────────────────
    // Used by: app/labo/pliage/page.js
    // Images: interleaved via lib/interleaved.js (manifest + role labels)
    // Inputs: [arrangement reference] + [garment 1, garment 2, ...]
    //
    // NOTE: This prompt is the INSTRUCTION block only. The image manifest and
    // per-image role labels are generated by buildInterleavedParts() and placed
    // BEFORE this instruction in the content array.
    pliage: (garmentCount, notes) => `
INSTRUCTION:
Reproduce the LAYOUT from the arrangement reference using the ${garmentCount} garment${garmentCount > 1 ? "s" : ""}
provided. The arrangement reference is ONLY a composition guide — ignore its garments
entirely, use only its positioning, layering and angles.

EXACTLY ${garmentCount} garment${garmentCount > 1 ? "s" : ""} in the output. No more, no less. Do NOT add or invent garments.

GARMENT FIDELITY (non-negotiable):
- Each garment must be PIXEL-PERFECT to its reference image: same exact colours,
  same exact pattern/print, same exact fabric texture and material, same hardware.
- Do NOT shift colours, do NOT warm/yellow whites, do NOT change fabric texture.
- Do NOT add or remove labels, tags, or stitching.
- A white garment must remain pure white. A blue garment must remain the exact same blue.
${withNotes(notes)}
LAYOUT:
- Follow the arrangement reference for positioning, overlap, and layering order.
- Match the degree of openness: if garments are spread flat, keep them spread flat.
- The background must be PURE WHITE (#FFFFFF) with no texture or colour bleed.

${OUTPUT_QUALITY}
`,

    // ─── Room Scene (multi-product) ─────────────────────────
    // Used by: app/labo/room-scene/page.js
    // Images: interleaved via lib/interleaved.js (manifest + role labels)
    // Inputs: [product 1, product 2, ..., product N] — all with role "roomProduct"
    //
    // NOTE: This prompt is the INSTRUCTION block only. The image manifest and
    // per-image role labels are generated by buildInterleavedParts() and placed
    // BEFORE this instruction in the content array.
    roomScene: (productCount, mood, notes) => `
INSTRUCTION:
You have received ${productCount} product packshot${productCount > 1 ? "s" : ""} described in the manifest above.
Generate a WIDE-ANGLE interior photograph of a beautifully styled baby nursery with ALL
${productCount} products naturally placed inside the room.

${BRAND_BRIEF}

SCENE:
- Setting: A spacious, elegantly styled modern baby nursery — light wood furniture (oak or birch),
  soft textiles, curated accessories (wooden toys, a small plant, picture books, a knit blanket).
  Walls in soft cream or very pale sage. The room feels real, lived-in, and warm — not a showroom.
- Mood: ${mood || "warm and serene, soft morning light"}.
- Lighting: Soft diffused natural light from a large window, filtered through sheer linen curtains.
  Warm golden tone. Gentle shadows that give depth to the room. No harsh contrast.
- Camera: Wide-angle shot (24-35mm lens, f/4-f/5.6) capturing the full room. The composition
  should feel like an editorial interior design photograph — balanced, inviting, aspirational.
- Color palette: Soft pastels, cream, natural wood tones. No bright primary colours, no dark
  or moody tones. Must complement the Noukies brand aesthetic.

PRODUCT PLACEMENT:
- Place ALL ${productCount} products naturally in the room — on the bed, in the crib, on a shelf,
  draped over a chair, on a changing table, on the floor, or wherever makes visual and logical sense
  for each product type.
- Every product must be clearly visible and identifiable — no product should be hidden or obscured.
- Arrange the products so the scene looks natural and curated, like a real styled nursery photoshoot.
  Do NOT pile products together. Distribute them across the room.

PRODUCT FIDELITY (non-negotiable):
- Each product must appear EXACTLY as shown in its reference image — same colours, same pattern,
  same materials, same shape, same proportions, same hardware.
- Do NOT modify, recolor, simplify, or obscure any product.
- Do NOT invent or add products not provided in the references.
- EXACTLY ${productCount} product${productCount > 1 ? "s" : ""} visible. No more, no less.
${withNotes(notes)}
OUTPUT:
Photorealistic wide-angle interior photography, editorial baby brand campaign quality.
Kodak Portra 400 colour science, warm natural tones, balanced depth of field with all
products in focus. The image should feel like a high-end catalogue spread — a beautifully
styled nursery where every Noukies product has its place.
`,

    // ─── Export backgrounds ─────────────────────────────────
    // Used by: hooks/useExportPipeline.js
    whiteBg:
        "Place this EXACT product on a perfectly PURE WHITE (#FFFFFF) background. No shadow. Keep the product EXACTLY as-is: same shape, colors, materials, angle. Professional e-commerce packshot quality.",

    chromaKeyBg: (hex, colorName) =>
        `Place this EXACT product on a perfectly UNIFORM, FLAT ${hex} pure ${colorName} background. NO shadows, NO reflections, NO gradient — just solid ${hex} everywhere around the product. Keep the product EXACTLY as-is: same shape, colors, materials, angle. The ${colorName} must extend to every edge of the image.`,
};

// ─── Scene labels (for the ambiance UI) ─────────────────────
export const SCENE_LABELS = {
    nursery_scene: "Chambre bébé (sans bébé)",
    baby_scene: "Scène avec bébé",
    outdoor_scene: "Scène extérieur",
    room_scene: "Chambre multi-produits",
};
