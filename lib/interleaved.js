/**
 * Interleaved content builder for multi-image prompts.
 *
 * Instead of sending [text, img, img, img] to the API, this builds
 * [label, img, label, img, ..., instruction] — each image is immediately
 * preceded by its role + user description, so NB2 knows exactly what
 * each image represents before processing it.
 *
 * This is the core solution to prevent hallucination when the client
 * sends multiple diverse inputs: the model receives a manifest upfront
 * and each image arrives with context.
 */

/**
 * @typedef {Object} ImageInput
 * @property {string}  role        - Standardized role key (see IMAGE_ROLES)
 * @property {string}  data        - Base64-encoded image data
 * @property {string}  [description] - User-provided description of what the image shows
 */

/**
 * Standardized image roles with labels and extraction instructions.
 * Used across all agents to ensure consistent role assignment.
 */
export const IMAGE_ROLES = {
    product: {
        label: "PRODUIT REFERENCE (identite)",
        labelEn: "TARGET PRODUCT (identity)",
        extract: "colour, pattern, material, branding, hardware, proportions",
        ignore: null, // source of truth — nothing to ignore
    },
    sketch: {
        label: "CROQUIS / DESSIN",
        labelEn: "SKETCH / DRAWING",
        extract: "structural shape, silhouette, proportions, construction details, design intent",
        ignore: "colour, texture, material finish — these are rough drawings, not colour references",
    },
    structure: {
        label: "REFERENCE STRUCTURELLE",
        labelEn: "STRUCTURAL REFERENCE",
        extract: "3D shape, construction, seams, closures, angles",
        ignore: "colour, pattern, material — apply the target product's appearance instead",
    },
    pattern: {
        label: "MOTIF / PATTERN",
        labelEn: "SEAMLESS PATTERN TILE",
        extract: "repeating pattern design, colours, scale",
        ignore: "image dimensions, background",
    },
    fabric: {
        label: "SWATCH TEXTILE",
        labelEn: "FABRIC SWATCH",
        extract: "material texture, weave, grain, sheen, colour",
        ignore: "image composition, background",
    },
    embroidery: {
        label: "DESIGN BRODERIE",
        labelEn: "EMBROIDERY DESIGN",
        extract: "thread colours, stitch design, motif shape",
        ignore: "background, scale — will be adapted to product",
    },
    scene: {
        label: "REFERENCE AMBIANCE",
        labelEn: "SCENE / ENVIRONMENT REFERENCE",
        extract: "setting, mood, lighting, colour palette, composition",
        ignore: "objects and products in the scene — only use for atmosphere",
    },
    style: {
        label: "REFERENCE DE STYLE",
        labelEn: "STYLE REFERENCE",
        extract: "artistic style, colour grading, mood, photographic treatment",
        ignore: "subject, composition — only borrow the visual style",
    },
    photo: {
        label: "PHOTO PRODUIT (smartphone/non-quali)",
        labelEn: "PRODUCT PHOTO (smartphone / low quality)",
        extract: "product identity, colour, pattern, materials, real-world appearance",
        ignore: "background noise, poor lighting, low resolution artefacts",
    },
    technical: {
        label: "FICHE TECHNIQUE",
        labelEn: "TECHNICAL SHEET",
        extract: "product structure, dimensions, construction blueprint, shape",
        ignore: "flat rendering style — reconstruct into realistic 3D form",
    },
    arrangement: {
        label: "REFERENCE DE PLIAGE / DISPOSITION",
        labelEn: "FOLDING / ARRANGEMENT REFERENCE",
        extract: "layout composition, folding style, how garments overlap, spacing, angles, overall arrangement aesthetic",
        ignore: "the specific garments, their colours, patterns, and materials — only use for layout and folding style",
    },
    garment: {
        label: "VETEMENT A PLIER",
        labelEn: "GARMENT TO FOLD / ARRANGE",
        extract: "full product identity: shape, colour, pattern, material, hardware, labels, stitching, every visual detail",
        ignore: null,
    },
    existingProduct: {
        label: "PRODUIT EXISTANT (reference)",
        labelEn: "EXISTING PRODUCT REFERENCE",
        extract: "ONLY what the user description specifies (e.g., fabric material, colour, hardware finish, texture). Read the user description carefully.",
        ignore: "everything NOT mentioned in the user description — do NOT borrow shape, silhouette, or structure from this image",
    },
    roomProduct: {
        label: "PRODUIT A PLACER DANS LA CHAMBRE",
        labelEn: "PRODUCT TO PLACE IN THE ROOM",
        extract: "full product identity: shape, colour, pattern, material, hardware, labels, proportions, every visual detail",
        ignore: null,
    },
};

/**
 * Build an image manifest block that tells NB2 what it's about to receive.
 * This goes at the very top of the prompt, before any images are shown.
 *
 * @param {ImageInput[]} inputs - Array of image inputs with roles
 * @returns {string} - Manifest text block
 */
export function buildManifest(inputs) {
    const lines = inputs.map((input, i) => {
        const role = IMAGE_ROLES[input.role];
        if (!role) return `${i + 1}. IMAGE ${i + 1}: ${input.description || "unspecified role"}`;

        let line = `${i + 1}. ${role.labelEn}`;
        if (input.description) {
            line += `: ${input.description}`;
        }
        line += `\n   → Extract: ${role.extract}`;
        if (role.ignore) {
            line += `\n   → IGNORE: ${role.ignore}`;
        }
        return line;
    });

    return `IMAGE MANIFEST — You will receive ${inputs.length} image${inputs.length > 1 ? "s" : ""} in this exact order:
${lines.join("\n")}

CRITICAL: Only extract what is specified for each image role. Do NOT cross-contaminate
attributes between images. Colour and material ALWAYS come from the identity reference only,
unless explicitly stated otherwise.`;
}

/**
 * Build an interleaved content parts array for the API.
 *
 * Structure: [manifest] → [role_label, image, role_label, image, ...] → [instruction]
 *
 * @param {ImageInput[]} inputs       - Array of image inputs with roles and base64 data
 * @param {string}       instruction  - The main prompt instruction (goes after all images)
 * @returns {Array<{type: string, text?: string, data?: string}>} - Parts array for the API
 */
export function buildInterleavedParts(inputs, instruction) {
    const parts = [];

    // 1. Manifest — tells NB2 what's coming
    parts.push({ type: "text", text: buildManifest(inputs) });

    // 2. Interleaved role labels + images
    for (const input of inputs) {
        const role = IMAGE_ROLES[input.role];
        let label = role ? role.labelEn : "REFERENCE IMAGE";
        if (input.description) {
            label += ` — ${input.description}`;
        }
        label += ":";

        parts.push({ type: "text", text: label });
        parts.push({ type: "image", data: input.data });
    }

    // 3. Main instruction (after all images)
    parts.push({ type: "text", text: instruction });

    return parts;
}

/**
 * Build a legacy-compatible prompt + images payload from interleaved inputs.
 * Use this as a fallback if the API route hasn't been updated yet.
 *
 * Produces the same manifest + role context but in a single text block,
 * with images passed as a flat array in positional order.
 *
 * @param {ImageInput[]} inputs       - Array of image inputs with roles and base64 data
 * @param {string}       instruction  - The main prompt instruction
 * @returns {{ prompt: string, images: string[] }}
 */
export function buildLegacyPayload(inputs, instruction) {
    const manifest = buildManifest(inputs);
    const images = inputs.map((input) => input.data);

    const prompt = `${manifest}

${instruction}`;

    return { prompt, images };
}
