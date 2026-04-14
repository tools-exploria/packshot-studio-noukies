# Nano Banana 2 — Prompt Guidelines for Noukies Packshot Studio

> Reference document for writing and reviewing all AI prompts in this project.
> Every prompt in `prompts.js` must follow these guidelines.
> Model: Nano Banana 2 (Google Gemini 3.1 Flash Image) via OpenRouter.

---

## 1. How NB2 Reads Prompts

Nano Banana 2 is a **thinking model**. It does not match tags — it understands intent,
physics, and composition. Write every prompt as if you were briefing a **human photographer
or retoucher** in full sentences with proper grammar.

**DO:**
> Using this image as the exact structural reference, replace only the fabric surfaces with
> a uniform solid colour #B5C9A8 (sage green). The colour must interact naturally with the
> product's 3D volume: lighter on highlights, darker in folds and creases, exactly as a
> real dyed fabric would behave under studio lighting.

**DON'T:**
> sage green, product, fabric, realistic, 4k, studio lighting

### Key mental model
NB2 processes a prompt like a creative brief. The more context you give about **why** and
**for whom**, the better the output. Generic keywords produce generic images.

---

## 2. Multi-Image Input: How to Bind Images to Your Prompt

### 2.1 How the model sees images

The Gemini API has **no formal labeling system** for images. There is no `image_id`,
no `[Image 1]` tag, no bracket syntax. The model identifies images by:

1. **Position** — the order images appear in the `content` array
2. **Semantic context** — what your prompt text says about each image

This means your prompt text is the **only mechanism** to tell the model what each image
represents and what role it plays.

### 2.2 Current architecture (text-first)

Our API route (`app/api/generate/route.js`) currently builds the content array as:

```
content: [
  { type: "text",      text: prompt },        ← all text first
  { type: "image_url", image_url: image_1 },  ← then images in order
  { type: "image_url", image_url: image_2 },
  ...
]
```

With this structure, images are referenced **by ordinal position** in the prompt text:
- "the first image" / "Image 1" → first image in the array
- "the second image" / "Image 2" → second image in the array

**This works** and is what all current prompts use. The model correctly maps ordinal
references to positional images.

### 2.3 Interleaved architecture (recommended for complex multi-input)

For 3+ images or when roles are complex, **interleaving** text and images produces
significantly better results. Instead of all text then all images, you alternate:

```
content: [
  { type: "text",      text: "This is the product reference:" },
  { type: "image_url", image_url: product_image },
  { type: "text",      text: "Apply this seamless pattern:" },
  { type: "image_url", image_url: pattern_image },
  { type: "text",      text: "Place the result in this environment:" },
  { type: "image_url", image_url: scene_reference },
  { type: "text",      text: "INSTRUCTIONS:\n..." },
]
```

**Why interleaving is better:**
- Each image is **immediately preceded** by its role description — no ambiguity
- The model processes images in context rather than retroactively mapping ordinals
- Scales cleanly to 5, 10, 14 images without confusing numbering
- Matches how the Gemini API docs recommend structuring complex multi-modal prompts

**Trade-off:** Requires splitting the prompt into segments and modifying the API route
to accept structured content instead of a flat `{ prompt, images }` payload.

**Status:** Implemented. See `lib/interleaved.js` for the builder utilities, and
`app/api/generate/route.js` for the backward-compatible API route that supports both formats.

### 2.4 Image role assignment patterns

Regardless of architecture (text-first or interleaved), **always assign an explicit role**
to every image in the prompt text. Never assume the model will "figure it out."

#### Pattern A: Ordinal reference (current, for 2-3 images)

```
The first image is the EXACT product reference — it defines shape, colour, pattern,
materials, and all hardware elements.
The second image is the seamless pattern tile to apply to all fabric surfaces.
```

#### Pattern B: Named role reference (recommended for 3+ images)

```
REFERENCE IMAGES:
- Image 1 is the TARGET PRODUCT: defines colour, pattern, material, branding.
  The output must match THIS image's appearance.
- Image 2 is a STRUCTURAL REFERENCE (back view): use it ONLY to understand
  3D shape and construction. IGNORE its colour and material.
- Image 3 is the FABRIC SWATCH: defines the target textile material and colour.
```

#### Pattern C: Inline role labels (best with interleaving)

Each image is preceded by a one-line role label in the content array:
```
"TARGET PRODUCT — this defines the visual identity (colour, pattern, material):"
[image]
"STRUCTURAL REFERENCE (side view) — use only for 3D shape, ignore colours:"
[image]
"FABRIC SWATCH — apply this material to all textile surfaces:"
[image]
```

### 2.5 Role categories

When assigning roles, use these standardized categories:

| Role              | What the model should extract            | What to IGNORE          |
|-------------------|------------------------------------------|-------------------------|
| **Target product** (identity) | Colour, pattern, material, branding, hardware | — (source of truth) |
| **Structural reference**      | 3D shape, construction, seams, closures        | Colour, pattern, material |
| **Pattern / texture source**  | Repeating pattern, tile, colour palette         | Image dimensions, background |
| **Fabric swatch**             | Material texture, weave, sheen, colour          | Image composition |
| **Embroidery design**         | Thread colours, stitch design, motif            | Background, scale |
| **Scene / environment ref**   | Setting, mood, lighting, composition            | Objects in the scene |
| **Style reference**           | Artistic style, colour grading, mood            | Subject, composition |
| **Pose reference**            | Body position, gesture, spatial arrangement     | Identity, clothing |
| **Product photo** (smartphone) | Product identity, colour, pattern, real-world appearance | Background noise, poor lighting artefacts |
| **Sketch / drawing**          | Structural shape, silhouette, proportions, design intent | Colour, texture — rough drawings aren't colour refs |
| **Arrangement reference**     | Layout composition, folding style, overlap, spacing | Specific garments, their colours and materials |
| **Garment to arrange**        | Full product identity: shape, colour, pattern, material, hardware | — (source of truth for that garment) |
| **Existing product reference** | ONLY what user description specifies (fabric, colour, hardware…) | Everything NOT mentioned — never borrow shape/structure |

### 2.6 Critical rules for multi-image prompts

1. **Image 1 is always the identity source.** Other images provide supplementary
   information. State this explicitly: "Image 1 is ALWAYS the source of truth for
   visual identity. Other images provide structural/shape information only."

2. **State what to ignore.** For each non-identity reference, explicitly say what
   the model should NOT borrow: "IGNORE its colour and material — apply the TARGET
   PRODUCT's appearance instead."

3. **Be redundant about contamination.** Multi-image prompts are where colour/pattern
   drift happens most often. Repeat the preservation rule:
   "CRITICAL: colours and materials must come from Image 1 ONLY."

4. **Limit to 6 high-fidelity references.** NB2 supports up to 14 images, but fidelity
   drops after 6. For best results, use 2-4 images with clear roles.

5. **Match aspect ratios when possible.** The model tends to adopt the aspect ratio of
   the last image provided. If this conflicts with your desired output, specify the
   target aspect ratio explicitly in the prompt AND in the API config.

### 2.7 The Image Manifest Pattern (anti-hallucination)

**Problem:** The client sends N diverse images (smartphone photo, sketch, swatch, etc.)
without context. NB2 doesn't know what to extract from each image and cross-contaminates
attributes — borrowing colours from a sketch, or shape from a fabric swatch.

**Solution:** The **Image Manifest** pattern. Before showing any image to the model,
we send a structured manifest that describes every image it's about to receive,
what to extract from each, and what to ignore.

```
IMAGE MANIFEST — You will receive 3 images in this exact order:
1. TARGET PRODUCT (identity): Smartphone photo of a grey cotton sleeping bag
   → Extract: colour, pattern, material, branding, hardware, proportions
2. SKETCH / DRAWING: Hand-drawn croquis of the desired shape with longer sleeves
   → Extract: structural shape, silhouette, proportions, construction details
   → IGNORE: colour, texture — these are rough drawings, not colour references
3. FABRIC SWATCH: Close-up of sage green velvet
   → Extract: material texture, weave, grain, sheen, colour
   → IGNORE: image composition, background

CRITICAL: Only extract what is specified for each image role. Do NOT
cross-contaminate attributes between images.
```

This manifest is generated automatically by `buildManifest()` in `lib/interleaved.js`
from the structured image inputs. The utility also provides `buildInterleavedParts()`
which produces the full content array: manifest → [label, image]... → instruction.

**Why this prevents hallucination:**
- NB2 knows **what** each image is before seeing it
- NB2 knows **what to extract** and **what to ignore** per image
- The user's description adds semantic context that pure role labels can't provide
- Cross-contamination is explicitly forbidden at the manifest level
- Works with any number of images (1 to 14) without confusion

**Three pillars of the approach:**
1. **Forced role assignment** (UI) — every image must have a role before entering the pipeline
2. **User description** (UI) — optional free text that the user writes to describe each image
3. **Interleaved delivery** (API) — each image arrives with its context label in the content array

### 2.8 Using `lib/interleaved.js`

The interleaved content builder provides:

| Export                    | Purpose                                                  |
|---------------------------|----------------------------------------------------------|
| `IMAGE_ROLES`             | Standardized role definitions with extract/ignore rules  |
| `buildManifest(inputs)`   | Generates the text manifest block from structured inputs |
| `buildInterleavedParts(inputs, instruction)` | Full interleaved content array for the API |
| `buildLegacyPayload(inputs, instruction)`    | Fallback: manifest as prompt prefix + flat images array |

```javascript
import { IMAGE_ROLES, buildInterleavedParts } from "@/lib/interleaved";

const inputs = [
    { role: "photo", data: base64_product, description: "Gigoteuse grise vue de face" },
    { role: "sketch", data: base64_sketch, description: "Croquis avec manches longues" },
];

const parts = buildInterleavedParts(inputs, PROMPTS.sketchToPackshot(notes));
// → Send { parts } to /api/generate instead of { prompt, images }
```

Available roles: `product`, `photo`, `sketch`, `structure`, `pattern`, `fabric`,
`embroidery`, `scene`, `style`, `technical`, `arrangement`, `garment`,
`existingProduct`. See `IMAGE_ROLES` in `lib/interleaved.js` for full definitions.

### 2.9 Implementation: API support

The API route (`app/api/generate/route.js`) supports both formats:

```javascript
// Interleaved (new — recommended for 2+ images with diverse roles)
{ parts: [
    { type: "text", text: "TARGET PRODUCT:" },
    { type: "image", data: "b64_1" },
    { type: "text", text: "SKETCH:" },
    { type: "image", data: "b64_2" },
    { type: "text", text: "INSTRUCTIONS:\n..." },
]}

// Legacy flat (still works — fine for simple 1-2 image modes)
{ prompt: "string", images: ["b64_1", "b64_2"] }
```

The `generateImages()` function in `lib/api.js` also supports `{ parts }` as
an alternative to `{ prompt, images }`. Both formats are fully backward compatible.

The API route would then map `parts` directly to the OpenRouter `content` array
instead of concatenating text + images. This is a backward-compatible change if the
route falls back to the current `{ prompt, images }` format when `parts` is absent.

---

## 3. Prompt Anatomy (6 elements)

Every generation prompt should address these six elements, in order of importance.
Not every element is required for every mode — packshot edits may skip Setting, for example.

| # | Element                  | Description                                                                 | Example                                                              |
|---|--------------------------|-----------------------------------------------------------------------------|----------------------------------------------------------------------|
| 1 | **Subject + Details**    | What the image shows. Be specific about materials, textures, construction.  | "A baby sleeping bag in organic cotton jersey, sage green, with a front zip" |
| 2 | **Action / Transformation** | What to do with the subject. The core instruction.                       | "Replace only the fabric surfaces with the pattern from the second image" |
| 3 | **Setting + Environment** | Where the subject exists. Only for lifestyle/ambiance prompts.             | "In a bright modern nursery with light oak furniture and sheer linen curtains" |
| 4 | **Composition + Camera** | Framing, angle, lens. NB2 responds strongly to real camera references.     | "Shot on a Sony A7IV with an 85mm f/1.4 lens, eye-level, centered framing" |
| 5 | **Lighting + Mood**      | Direction, quality, colour temperature, emotional tone.                    | "Soft diffused natural light from a window, warm golden tone, no harsh shadows" |
| 6 | **Style + Quality**      | Output style, resolution intent, reference aesthetic.                      | "Photorealistic studio packshot, commercial e-commerce quality" |

---

## 4. Photography Language

NB2 responds exceptionally well to real-world photographic vocabulary. Use it to control
the output with precision.

### 3.1 Lenses & cameras
| Term                | Visual effect                                      |
|---------------------|----------------------------------------------------|
| 85mm f/1.4          | Portrait isolation, creamy bokeh, natural perspective |
| 50mm f/1.8          | Standard perspective, slight bokeh                 |
| 35mm f/2            | Wider context, environmental portrait              |
| 100mm macro         | Extreme close-up, shallow DOF, texture detail      |
| 24mm wide-angle     | Expansive scenes, environmental context            |

**When to use:** Lifestyle/ambiance scenes, alternate angles (especially macro detail),
and any prompt where depth-of-field control matters.

**Not needed for:** Packshot edits (pattern, colour, embroidery) where the camera angle
is inherited from the reference image.

### 3.2 Film stocks (for mood control)
| Film stock          | Visual signature                                   |
|---------------------|----------------------------------------------------|
| Kodak Portra 400    | Warm skin tones, pastel palette, fine grain — **best match for Noukies** |
| Fujifilm Pro 400H   | Cool-neutral pastels, soft highlights, airy        |
| Kodak Ektar 100     | Saturated, high contrast — **avoid for Noukies**   |

**When to use:** Lifestyle/ambiance prompts only. Naming a film stock gives NB2 a holistic
colour/mood reference in two words.

### 3.3 Lighting vocabulary
| Term                     | Effect                                           |
|--------------------------|--------------------------------------------------|
| Soft diffused light      | Even, gentle, minimal shadows — **Noukies default** |
| Golden hour              | Warm, low-angle, flattering                      |
| Window light             | Directional but soft, natural                    |
| Three-point lighting     | Studio control: key, fill, rim                   |
| Rim / back lighting      | Separation from background, halo effect          |
| High-key                 | Bright, minimal shadows, airy                    |
| Split lighting           | Dramatic half-face — **avoid for Noukies**       |

### 3.4 Depth of field
| Aperture range | Effect                    | Use for                           |
|----------------|---------------------------|-----------------------------------|
| f/1.4 – f/2.8  | Shallow — subject isolation | Lifestyle, baby scenes, detail    |
| f/4 – f/5.6    | Balanced                   | Nursery scenes, outdoor           |
| f/8 – f/16     | Deep — everything sharp    | Packshots, flat lays, 3D renders  |

---

## 5. Noukies Brand Rules (non-negotiable)

These rules apply to **every prompt** in the project, regardless of mode.

### 4.1 Product fidelity
The product in the output must be **identical** to the reference image:
- Same shape, proportions, silhouette, 3D form
- Same colours, pattern, materials
- Same hardware: straps, buckles, zippers, buttons, snaps, ribbons, labels, stitching
- **Never invent** elements not present in the reference
- **Never simplify** or stylize the product

### 4.2 Brand identity (for lifestyle/ambiance modes)
| Attribute       | Specification                                                                 |
|-----------------|-------------------------------------------------------------------------------|
| Colour palette  | Soft pastels: cream `#F5F0E8`, powder pink `#F0D4D8`, sage green `#B5C9A8`, warm grey `#C4BAB0`, lavender `#D4C8E0`, soft sky blue `#BDD5E8` |
| Lighting        | Soft diffused natural light, warm golden tone, no harsh shadows               |
| Photo style     | High-end editorial baby brand (Bonpoint, Petit Bateau aesthetic)              |
| Materials       | Must read as premium and tactile — soft cotton, organic jersey, plush velvet  |
| Mood            | Calm, reassuring, warm. Evokes safety and comfort.                            |
| Forbidden       | Saturated/neon colours, harsh contrast, dark moods, synthetic-looking textures |

### 4.3 Baby realism (when babies are present)
- Fully photorealistic — real skin texture, subtle pores, natural colour variation
- **Hands**: Exactly 5 fingers, naturally proportioned, slightly chubby with knuckle creases
- **Eyes**: Natural gaze, realistic iris with catchlight, age-appropriate size
- **Skin**: Soft, smooth, subtle pink undertones on cheeks/knees/elbows
- **Proportions**: Head-to-body ratio matching specified age
- **Expression**: Natural, unstaged — a real moment, not a posed doll

### 4.4 Packshot background
- **Pure white `#FFFFFF`** for all packshot/e-commerce modes
- No texture, no shadow bleed, no colour contamination
- Gentle contact shadow allowed (not drop shadow)

---

## 6. Prompt Architecture in This Project

### 5.1 Shared building blocks

All prompts are assembled from reusable constants defined at the top of `prompts.js`.
When creating a new agent, **reuse these blocks** — don't rewrite equivalent rules inline.

| Block              | Purpose                                         | Use in                        |
|--------------------|-------------------------------------------------|-------------------------------|
| `CRITICAL_RULES`   | Non-negotiable preservation rules               | All packshot edit modes       |
| `PRESERVE_RULES`   | Shape, materials, lighting preservation          | All packshot edit modes       |
| `OUTPUT_QUALITY`   | Studio packshot output standard                  | All packshot edit modes       |
| `BRAND_BRIEF`      | Noukies brand identity + colour palette          | All lifestyle/ambiance modes  |
| `BABY_REALISM_RULES` | Anti-uncanny-valley rules for babies           | Any mode with a baby          |
| `BABY_AGE_PROPS`   | Age-specific baby descriptions (newborn, 3-6m, 6-12m) | Baby scene modes        |
| `withNotes(notes)` | Injects optional product-specific notes          | All modes                     |

### 5.2 Prompt template pattern

Every prompt in `prompts.js` follows this structure:

```
[REFERENCE IMAGE ROLE ASSIGNMENT]   ← What each uploaded image represents

INSTRUCTION:                         ← The core task in 1-2 sentences
[What to do with the reference]

[SHARED RULES BLOCK]                 ← CRITICAL_RULES / BRAND_BRIEF / etc.

[MODE-SPECIFIC RULES]                ← Detailed rules specific to this mode
                                       (pattern application, colour rules, etc.)

[PRESERVE / FIDELITY BLOCK]          ← What must not change

[OUTPUT BLOCK]                       ← Expected output quality and style
```

### 5.3 Reference image role assignment

When a prompt uses multiple images, **always** assign explicit roles:

```
- Image 1 is the TARGET PRODUCT: defines colour, pattern, material, branding.
- Image 2 is the [PATTERN / TEXTURE / EMBROIDERY DESIGN]: defines [what it provides].
```

For multi-reference modes (like angles), use structured role assignment:
- **Identity reference**: Source of truth for colour, pattern, material
- **Structure reference**: Shape/construction info only — ignore its colours

**Critical rule**: Image 1 is ALWAYS the identity source. Other images provide
supplementary information only.

---

## 7. Writing Rules for New Prompts

### 6.1 Language & tone
- Write in **English** (the model performs best in English)
- Use **full sentences**, not comma-separated keywords
- Be **imperative and direct**: "Replace the fabric" not "You should replace the fabric"
- Use **uppercase labels** for section headers: `INSTRUCTION:`, `CRITICAL RULES:`, `OUTPUT:`
- Use **bold constraints** with explicit negation: "Do NOT invent", "NEVER add"

### 6.2 Specificity over ambiguity
- Name exact colours with hex codes: `#F5F0E8 (cream)` not "a light colour"
- Name exact materials: "organic cotton jersey with visible knit loops" not "soft fabric"
- Name exact placements: "center chest, 5cm below the neckline" not "on the front"
- Name exact lighting: "soft diffused light from top-left, gentle fill from right" not "nice lighting"

### 6.3 Constraint ordering
NB2 gives more weight to instructions that appear **earlier** in the prompt.
Order your sections by priority:

1. **Image role assignment** (what each image is)
2. **Core instruction** (the task)
3. **Critical constraints** (non-negotiable rules)
4. **Mode-specific details** (technique-specific rules)
5. **Preservation rules** (what to keep)
6. **Output quality** (final quality expectations)

### 6.4 Negative instructions
NB2 handles negative instructions well. Use them to prevent common failure modes:
- "Do NOT add elements not present in the reference"
- "No harsh shadows, no dramatic contrast"
- "NEVER modify hardware elements (zippers, buttons, snaps)"

Place negatives **immediately after** the related positive instruction, not in a separate
"don't" section at the end.

### 6.5 Prompt length
- **Packshot edits** (pattern, colour, embroidery): 150–300 words. Focused and precise.
- **Lifestyle/ambiance**: 200–400 words. More descriptive, richer setting context.
- **Complex multi-reference** (angles, 3D): 250–400 words. Detailed role assignments.

Avoid exceeding ~400 words total — NB2 starts losing focus on late instructions
beyond that length. **Tested and confirmed:** a 50-line pliage prompt caused colour
drift and fabric changes; shortening to 20 lines with "PIXEL-PERFECT" solved it.
When in doubt, one strong directive beats ten detailed rules.

---

## 8. Mode-Specific Guidelines

### 7.1 Packshot edits (pattern, colour, texture, embroidery)

These modes **transform a product image** while preserving everything else.

- Always include `CRITICAL_RULES` + `PRESERVE_RULES` + `OUTPUT_QUALITY`
- The instruction must clearly delineate **what changes** vs **what stays**
- Describe the expected physical behaviour of the transformation:
  - Colour: "lighter on highlights, darker in folds, as real dyed fabric would behave"
  - Pattern: "wrap naturally around curves, folds, and 3D volume"
  - Embroidery: "physically stitched into the fabric, not printed or overlaid"
  - Texture: "reproduce both colour AND physical texture (weave, grain, sheen)"
- Background: always pure white `#FFFFFF`

### 7.2 Lifestyle / ambiance scenes

These modes **place the product in a context scene**.

- Always include `BRAND_BRIEF`
- Include `BABY_REALISM_RULES` + `BABY_AGE_PROPS` when a baby is present
- Structure the scene description as a **narrative brief**:
  - Setting: physical space, furniture, decor, colour palette
  - Lighting: source, quality, colour temperature
  - Mood: emotional tone, time of day
  - Product placement: where and how the product appears in the scene
- Use photography language: lens, depth of field, film stock reference
- Product is always the **hero** — well-lit, sharp focus, prominent placement
- End with a **output vision** sentence that captures the overall aesthetic

### 7.3 Alternate angles

This mode **generates new camera angles** from reference images.

- Assign explicit roles to each reference image (identity vs structure)
- Be precise about the target angle — NB2 needs exact specifications:
  - "camera perpendicular to the product face" not "front view"
  - "approximately 45 degrees from front-left" not "three-quarter view"
- Maintain consistent lighting specification across all angle prompts
- For macro detail: specify what to focus on and request shallow DOF

### 7.4 3D product rendering

This mode **reconstructs 3D form** from technical sheets.

- Image 1 = structural blueprint (technical sheet / flat reference)
- Image 2 = material source (fabric swatch)
- Describe expected physical material behaviour under light:
  - "matte for cotton, subtle sheen for satin, soft pile for velvet"
- Request realistic gravity and tension effects on fabric

### 8.5 Sketch to Packshot (multi-input)

This mode **generates a clean packshot** from a mix of inputs (sketch, photo, packshot).

- Uses the **Image Manifest pattern** (section 2.7) via `lib/interleaved.js`
- Inputs split into two sections:
  - **Base images** (1+ required): sketch, smartphone photo, or packshot — what defines the product
  - **Existing product references** (optional): packshots of other catalogue products to borrow
    specific attributes from (fabric, colour, hardware). Each has a **user description** that
    tells the model exactly what to extract.
- The prompt must handle variable input combinations: sketch alone, photo alone, sketch + photo,
  sketch + photo + existing product ref, etc.
- When both sketch and photo are provided: **structure from sketch, visual identity from photo**
- The `existingProduct` role extracts ONLY what the user description says — this prevents
  cross-contamination between reference products

### 8.6 Pliage & Disposition (arrangement)

This mode **arranges/folds garments** according to a layout reference.

- Uses the **Image Manifest pattern** (section 2.7) via `lib/interleaved.js`
- Two input sections:
  - **Arrangement reference** (1 required): a packshot showing the desired layout/composition.
    The model extracts ONLY the layout — positioning, overlap, angles. It must IGNORE the
    specific garments in this image.
  - **Garments** (1+ required): individual packshots of each garment to arrange.
- **Garment count is injected** into the prompt as a hard constraint: "EXACTLY N garments".
  This prevents hallucination of extra garments.
- **Key lesson learned**: NB2 interprets "fold" very literally. Use "laid out and arranged"
  instead. Add "match the degree of openness from the reference" to prevent over-folding.
- **Key lesson learned**: NB2 tends to borrow colours from the arrangement reference image.
  The prompt must explicitly say "the arrangement reference is ONLY a layout guide — ignore
  its garments entirely".
- **Key lesson learned**: Keep the prompt SHORT (~20 lines). Long prompts (~50 lines) caused
  NB2 to lose focus, resulting in colour drift and fabric changes. "PIXEL-PERFECT" as a
  single directive is more effective than 10 lines of preservation rules.
- Always use `OUTPUT_QUALITY` (not a custom output block) to ensure pure white background.

---

## 9. Iteration & Editing Strategy

NB2 excels at **conversational editing**. When a result is close but not perfect:

1. **Don't regenerate from scratch** — edit the existing output
2. Use the Pro model (`google/gemini-3-pro-image-preview`) for edits
3. Write edit prompts as **specific corrections**:
   - "Keep everything the same but make the pattern scale 20% smaller"
   - "The lighting is too warm — shift to neutral daylight while keeping the composition"
4. Reference what's **already correct** to anchor the model:
   - "The product shape and colours are perfect. Only adjust the background shadow."

---

## 10. Common Failure Modes & Fixes

| Problem                           | Cause                                    | Fix                                                      |
|-----------------------------------|------------------------------------------|----------------------------------------------------------|
| Product colours drift             | Insufficient preservation rules          | Add explicit hex codes and "preserve exact colours from reference" |
| Hardware elements change          | Generic preservation instruction         | List every element type: "straps, buckles, zippers, buttons, snaps, ribbons, labels" |
| Background not pure white         | Missing explicit background rule         | Add: "Background must be PURE WHITE #FFFFFF. No texture, no shadow, no colour bleed." |
| Baby looks uncanny                | Missing realism rules                    | Add `BABY_REALISM_RULES` block. Specify age with `BABY_AGE_PROPS`. |
| Pattern stretched or distorted    | No 3D wrapping instruction               | Add: "Pattern must wrap naturally around curves, folds, and 3D volume" |
| Model invents new elements        | Missing negative constraint              | Add: "Do NOT invent or add new elements not present in the reference" |
| Labels/logos hallucinated         | Over-specifying logo preservation        | Use general `CRITICAL_RULES` only. Avoid dedicated logo rules (triggers hallucination). |
| Flat, lifeless fabric             | Missing material interaction rules       | Describe light interaction: "lighter on highlights, darker in folds and creases" |
| Inconsistent lighting across angles | No lighting specification in angle prompt | Add: "consistent studio lighting: soft diffused light from top-left, gentle fill from right" |
| Low detail / generic output       | Keyword-style prompt                     | Rewrite as full narrative sentences with specific material and lighting descriptions |
| White fabric turns yellow         | Colour drift from warm lighting bias     | Add: "A white garment must remain pure white. Do NOT warm/yellow whites." |
| Fabric texture changes            | Insufficient material preservation       | Add: "Do NOT change fabric texture" — name the exact material if known |
| Extra garments hallucinated       | No count constraint in prompt            | Inject exact garment count: "EXACTLY N garments — no more, no less" |
| Garments over-folded              | Word "fold" interpreted too literally    | Use "laid out and arranged" instead. Add "match the degree of openness from the reference" |
| Prompt too long, model loses focus | Prompt exceeds ~400 words               | Shorten. "PIXEL-PERFECT" > 10 lines of preservation rules. Prioritise constraints at top. |
| Colours borrowed from wrong image | Cross-contamination in multi-image mode  | Use Image Manifest (section 2.7). Add "ONLY a layout guide — ignore its garments entirely" |

---

## 11. Checklist for New Prompts

Before adding a new prompt to `prompts.js`, verify:

- [ ] Written in full English sentences (not keyword lists)
- [ ] Core instruction is clear in the first 2 sentences
- [ ] Uses shared building blocks where applicable (`CRITICAL_RULES`, `BRAND_BRIEF`, etc.)
- [ ] Each reference image has an explicit role assignment (see section 2.4–2.5)
- [ ] Specifies what changes AND what must be preserved
- [ ] Includes negative constraints for known failure modes
- [ ] Material/texture behaviour described physically (light interaction, folds, wrapping)
- [ ] Background rule explicit (pure white for packshots, described for lifestyle)
- [ ] Product fidelity section present ("EXACTLY as shown in the reference")
- [ ] Output quality section present with style and quality expectations
- [ ] Total length under ~500 words
- [ ] Follows the established section order (see 6.3)
- [ ] Parameters are injected via function arguments (not hardcoded)
- [ ] `withNotes(notes)` used for optional product-specific notes
- [ ] Tested with at least 2 different product types before shipping

---

## 12. Quick Reference — Prompt Template

```javascript
// ─── [Mode Name] ──────────────────────────────────────
// Used by: app/[page]/page.js
// Images: [image 1 role, image 2 role, ...]
myNewPrompt: (param1, param2, notes) => `
INSTRUCTION:
[Core task in 1-2 sentences using the reference images.]

${CRITICAL_RULES}
${withNotes(notes)}

[MODE NAME] APPLICATION:
- [Specific rule 1 — describe physical behaviour]
- [Specific rule 2 — describe expected visual result]
- [Specific rule 3 — constraint or negative instruction]

${PRESERVE_RULES}

${OUTPUT_QUALITY}
`,
```

For lifestyle/ambiance modes, replace `CRITICAL_RULES` + `PRESERVE_RULES` + `OUTPUT_QUALITY`
with `BRAND_BRIEF` + product fidelity section + narrative output description.
