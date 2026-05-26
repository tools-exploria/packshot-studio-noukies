import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/explore
 *
 * Génère 5 DIRECTIONS CRÉATIVES distinctes à partir d'une intention utilisateur
 * (souvent vague ou courte) et de l'image du produit. Chaque direction est
 * ancrée sur un élément visuel spécifique du produit ET s'appuie sur une recette
 * créative documentée du projet (R1-R15 dans PROMPT_GUIDELINES.md §13).
 *
 * Modèle : Claude Sonnet 4.6 via OpenRouter (vision + raisonnement + JSON output).
 *
 * Body:
 *   {
 *     text:    string,    // intention utilisateur (peut être vide)
 *     context: {
 *       agent: string,    // "ambiance" | "ambiance-custom" | "labo" | ...
 *       role:  string,    // "mood" | "customPrompt" | "freePrompt"
 *     },
 *     image?:  string     // base64 (sans préfixe data URI) — image du produit
 *   }
 *
 * Response:
 *   { cards: [{ title, recipe, anchor, prompt }, ...] }   // 5 cartes
 *   ou { error: string }
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_REFORMULATE_MODEL || "anthropic/claude-sonnet-4.6";

// ─── System prompt ─────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Tu es un Art Director créatif pour Packshot Studio (plateforme
Noukies, marque belge premium puériculture).

MISSION : à partir d'une intention utilisateur et de l'image du produit, propose
5 directions créatives DISTINCTES qui répondent FIDÈLEMENT à l'intention.

═══════════════════════════════════════════════════════════════════════
RÈGLES ABSOLUES
═══════════════════════════════════════════════════════════════════════

1. **OUTPUT JSON STRICT.** Premier caractère { dernier caractère }. Pas de markdown,
   pas de \`\`\`json, pas de préambule, pas de commentaire avant ou après.
   Format EXACT :

   { "cards": [
       { "title": "...", "anchor": "...", "prompt": "...", "recipe": "..." },
       { ... }, { ... }, { ... }, { ... }
     ] }

   Exactement 5 cartes. "title", "anchor" et "prompt" sont obligatoires. "recipe"
   est optionnel (à remplir uniquement si la direction utilise clairement une
   recette du catalogue ci-dessous, sinon omettre ou laisser vide).

2. **L'INTENTION UTILISATEUR EST LE FIL ROUGE — TRAHIR L'INTENTION = ÉCHEC TOTAL.**
   Si l'utilisateur dit "savane sauvage" → les 5 directions évoquent toutes une
   savane sauvage (lumière de savane, palette ocre / terre / sage, herbes hautes,
   silhouettes d'acacia, light dust in beams). PAS UN DÉTOUR Wes Anderson "parce
   que ça fait stylé". Si "Noël" → 5 directions de Noël. Si "minimal" → 5 directions
   minimales. Le thème prime ABSOLUMENT sur tes préférences stylistiques.

3. **LANGUE = LANGUE DE L'INPUT.** Détecte la langue de l'input et produis CHAQUE
   carte (title, anchor, prompt) dans cette langue. Aucune traduction. AUCUN drift
   vers l'anglais sous prétexte que "les recettes ont des noms anglais" — les noms
   R1-R15 sont des **identifiants internes au projet, pas une obligation stylistique**.
   Input français → 5 cartes en français. Input anglais → 5 en anglais. Input vide
   → français par défaut (projet français-natif).
   Les termes techniques photo en anglais sont OK comme ancres inline ("golden hour",
   "f/4", "Kodak Portra 400") MAIS enchâssés dans des phrases de la langue détectée.

4. **5 DIRECTIONS RÉELLEMENT DIFFÉRENTES.** Pas 5 variations d'une même idée — pense
   angles très distincts. Si la carte 1 est un macro détail, la carte 2 doit aller
   ailleurs (un wide environmental, un éditorial typographique, un documentaire
   intime, etc.). Le client doit voir d'un coup d'œil que les 5 cartes vont à des
   endroits différents.

5. **CHAQUE CARTE EST ANCRÉE SUR UN ÉLÉMENT VISUEL DU PRODUIT.** Inspecte l'image
   mentalement, identifie 5-8 éléments distinctifs (broderie, étiquette, hardware,
   matière, motif, couleur, accessoire, illustration, forme). Chaque carte exploite
   UN de ces éléments comme point d'ancrage. Le champ "anchor" décrit cet élément
   en 5-12 mots.

6. **TU NE DÉCRIS PAS L'IMAGE dans le champ "prompt".** Tu l'utilises pour identifier
   les ancrages, pas à la décrire. NB2 verra cette même image en aval — il n'a pas
   besoin de description du produit. Concentre le prompt sur la SCÈNE / l'ambiance
   / la composition qui accueille le produit (sauf pour role="freePrompt", voir
   plus bas).

═══════════════════════════════════════════════════════════════════════
RECETTES DISPONIBLES — À UTILISER LIBREMENT, AUCUNE N'EST OBLIGATOIRE
═══════════════════════════════════════════════════════════════════════

Ces recettes (PROMPT_GUIDELINES.md §13) sont des leviers connus pour NB2. Tu peux
en utiliser une, en combiner deux, ou n'en utiliser AUCUNE si une direction
purement créative sert mieux l'intention. NE PAS forcer une recette quand elle
ne sert pas le brief — c'est le piège n°1 que tu dois éviter.

- R1 Hardware Switch — caméra précise (Hasselblad 500CM, Leica M6, Fujifilm X100,
  iPhone 15 Pro raw, disposable film flash)
- R2 Off-Center Forcing — sujet dans le tiers + négatif décrit positivement
- R3 Director's Reference — référence visuelle nommée (Wes Anderson, Bonpoint,
  Slim Aarons, Tim Walker, Petit Bateau, Annie Leibovitz)
- R4 Material Lock — fibre + tissage + gsm + finition + comportement
- R5 Cutout Typography — mot court (≤8 chars) en cutout révélant l'image
- R6 Macro Detail Hero — extrême close-up f/4, reste flou
- R7 Environmental Storytelling — produit passif dans un moment de vie
- R8 Spatial Storyboard — 3 plans de profondeur explicites (foreground / mid / bg)
- R9 Negative Space as Content — 70% vide DÉCRIT positivement
- R12 Light Direction Lock — source + angle + diffuseur explicite
- R13 Anti-Skeuomorphic — "matte real-world, NOT a 3D render"
- R14 House Style Phrase — phrase Noukies réutilisée verbatim
- R15 Color Palette Forcing — 3 hexes assignés en % (60/25/15 typique)

═══════════════════════════════════════════════════════════════════════
CHARTE NOUKIES (par défaut, MAIS l'intention thématique prime)
═══════════════════════════════════════════════════════════════════════

Par défaut (intention neutre type "ambiance cocooning") : pastels Noukies (cream
#F5F0E8, rose poudré #F0D4D8, sauge #B5C9A8, gris chaud #C4BAB0, lavande #D4C8E0,
bleu ciel #BDD5E8), lumière douce diffusée, ton chaud doré, éditorial Bonpoint/
Petit Bateau, matières premium tactiles, mood calme et rassurant.

QUAND L'UTILISATEUR DEMANDE UN THÈME FORT (cowboy, savane, Noël, marine, halloween,
minimal, industriel…) :
- Le thème PRIME sur la charte par défaut.
- La charte teinte mais n'étouffe pas : la "savane Noukies" n'est pas une savane
  saturée National Geographic — c'est une savane premium éditoriale, palette
  ocre / terre / sage / cream, lumière golden hour douce, mood calme contemplatif.
- Pas de stéréotypes saturés : pas d'animaux jouets empilés, pas de symboles
  cousus partout, pas de couleurs néon. Le thème s'exprime par la LUMIÈRE, la
  PALETTE, le DÉCOR et le MOOD — pas par accumulation d'objets symboliques.

═══════════════════════════════════════════════════════════════════════
LONGUEUR DES PROMPTS PAR ROLE
═══════════════════════════════════════════════════════════════════════

• role="customPrompt" → 5-10 lignes par prompt (textarea ambiance custom).
  Structure libre : setting + lumière + mood + composition. Le produit s'insère
  automatiquement en aval — ne décris PAS le produit.

• role="freePrompt" → 6-15 lignes par prompt (sandbox /labo). Prompt NB2
  idiomatique complet : anatomie subject + composition + camera + lighting + style.
  Le produit peut être nommé ici puisque /labo est sandbox.

═══════════════════════════════════════════════════════════════════════
LES 2 PIÈGES À ÉVITER ABSOLUMENT
═══════════════════════════════════════════════════════════════════════

PIÈGE 1 : "piocher dans le catalogue R1-R15" sans engager avec l'intention.
Symptôme : 5 cartes qui appliquent 5 recettes différentes mais ne capturent pas
le brief. Exemple d'échec : input "savane sauvage", tu proposes du Wes Anderson
pastel parce que "c'est R3, ça marche toujours". NON. Si l'intention est savane,
les 5 directions sont toutes savane, et tu choisis les recettes qui SERVENT cette
intention (R7 Environmental Storytelling sous un acacia, R9 Negative Space avec
un ciel de savane, R12 Light Direction Lock avec backlight rasante…).

PIÈGE 2 : drift vers l'anglais "parce que les recettes ont des noms anglais".
Les recettes sont des étiquettes internes — le contenu de tes cartes doit être
dans la langue de l'utilisateur. Si l'input est "scene pour collection de savane
sauvage", les 5 cartes sont en FRANÇAIS, même si tu utilises R7 (Environmental
Storytelling) comme levier.

═══════════════════════════════════════════════════════════════════════
RAPPEL FINAL
═══════════════════════════════════════════════════════════════════════

L'image t'est fournie pour identifier les ancrages, PAS pour être décrite dans
ta sortie. NB2 verra la même image en aval.

Premier caractère { dernier caractère }. Pas de markdown. Pas de \`\`\`json.
Pas de préambule. Pas de commentaire après.`;

function buildContextBrief(context) {
    const { agent, role } = context || {};

    const ROLE_LENGTHS = {
        mood: "Format des 5 prompts : COURT, 2-3 phrases par prompt (input pour un champ 1-ligne).",
        customPrompt: "Format des 5 prompts : COMPLET, 5-10 lignes par prompt (textarea ambiance).",
        freePrompt: "Format des 5 prompts : NB2 IDIOMATIQUE COMPLET, 6-15 lignes par prompt (sandbox /labo).",
    };

    return `\n\n═══════════════════════════════════════════════════════════════════════
CONTEXTE DE CETTE REQUÊTE
═══════════════════════════════════════════════════════════════════════

Agent appelant : ${agent || "?"}
Champ cible : ${role || "?"}
${ROLE_LENGTHS[role] || "Format des prompts : adapter au contexte."}`;
}

/**
 * Anthropic recommends ≤1568px on the long edge. The Reformulable component
 * receives the raw productPreview (uncompressed FileReader output), which can
 * easily be 4K from a smartphone packshot — that exceeds OpenRouter / Anthropic
 * limits and produces an opaque "Provider returned error 400". We compress
 * defensively here. Already-small images pass through untouched.
 */
/**
 * Always pipe through sharp + output JPEG. Two reasons:
 *   1. Anthropic via Amazon Bedrock rejects requests when the declared mime
 *      (we hardcode "image/jpeg") doesn't match the actual bytes (WebP/PNG/
 *      HEIC from FileReader.readAsDataURL). Transcoding normalises this.
 *   2. Large images get resized to ≤1568px (Anthropic recommended).
 */
async function compressImageForAnthropic(b64) {
    const sizeKB = Math.round(b64.length / 1024);
    try {
        const buffer = Buffer.from(b64, "base64");
        let pipeline = sharp(buffer).rotate();
        if (sizeKB >= 1200) {
            pipeline = pipeline.resize(1568, 1568, { fit: "inside", withoutEnlargement: true });
        }
        const out = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
        const newSizeKB = Math.round(out.length / 1024 * 4 / 3);
        console.log(`[explore] image ${sizeKB}KB → ${newSizeKB}KB (transcoded to JPEG)`);
        return out.toString("base64");
    } catch (err) {
        console.warn("[explore] image processing failed, sending as-is:", err.message);
        return b64;
    }
}

export async function POST(request) {
    try {
        if (!API_KEY) {
            return NextResponse.json(
                { error: "OPENROUTER_API_KEY not configured" },
                { status: 500 },
            );
        }

        const body = await request.json();
        const { text = "", context = {}, image: rawImage } = body;

        const userContent = [];

        let image = rawImage;
        if (image) {
            image = await compressImageForAnthropic(image);
            userContent.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image}` },
            });
        }

        const userText = text.trim();
        userContent.push({
            type: "text",
            text: userText
                ? `Intention utilisateur (génère 5 directions créatives distinctes) :\n\n${userText}`
                : `Champ vide — l'utilisateur n'a fourni aucun texte d'intention.\n\n` +
                  `⚠️ LANGUE OBLIGATOIRE : FRANÇAIS pour les 5 cartes (titre, anchor, prompt). ` +
                  `Aucune carte en anglais. Termes techniques photo en anglais OK comme ancres inline ` +
                  `("golden hour", "f/4", "Kodak Portra 400") mais enchâssés dans des phrases françaises.\n\n` +
                  `Propose 5 directions créatives en français à partir de l'image fournie et de la charte Noukies.`,
        });

        const fullSystem = SYSTEM_PROMPT + buildContextBrief(context);

        const requestBody = {
            model: MODEL,
            messages: [
                { role: "system", content: fullSystem },
                { role: "user", content: userContent },
            ],
            temperature: 0.95, // higher than reformulator (0.85) for diversity across cards
            max_tokens: 3500,
            stream: false,
        };

        console.log(
            `[explore] agent=${context.agent || "?"} role=${context.role || "?"} ` +
            `text_len=${text.length} image=${image ? "yes" : "no"} model=${MODEL}`,
        );

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 90_000);

        const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://packshot-studio.vercel.app",
                "X-Title": "Packshot Studio - Explore",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[explore] HTTP ${res.status}:`, errBody.slice(0, 500));

            // OpenRouter wraps the provider's actual error message inside
            // data.error.metadata.raw (itself a JSON string). Surface it
            // instead of a generic "API error 400".
            let providerMessage = null;
            let providerName = null;
            try {
                const errData = JSON.parse(errBody);
                providerName = errData?.error?.metadata?.provider_name || null;
                const rawString = errData?.error?.metadata?.raw;
                if (rawString) {
                    try {
                        const parsed = JSON.parse(rawString);
                        providerMessage = parsed?.message || parsed?.error?.message || null;
                    } catch {
                        providerMessage = rawString.slice(0, 200);
                    }
                }
                if (!providerMessage) providerMessage = errData?.error?.message || null;
            } catch {
                // errBody was not JSON
            }

            const prefix = providerName ? `${providerName} (HTTP ${res.status})` : `HTTP ${res.status}`;
            const userMessage = providerMessage
                ? `${prefix} : ${providerMessage}`
                : `Erreur ${res.status} du fournisseur (sans détail).`;
            return NextResponse.json({ error: userMessage }, { status: 200 });
        }

        const data = await res.json();

        // OpenRouter can return HTTP 200 OK with an error object in the body
        // when the upstream provider (Anthropic) returned a non-success status.
        // Detect this and surface a useful message instead of falling through
        // to the "empty content" branch (which gives no actionable info).
        if (data.error) {
            const err = data.error;
            const code = err.code || err.status || "?";
            const msg = err.message || JSON.stringify(err);
            console.error(`[explore] Provider error code=${code} msg=${msg} full=${JSON.stringify(data).slice(0, 500)}`);

            let userMessage = `Erreur du fournisseur (code ${code}) : ${msg}`;
            if (String(code) === "400") {
                userMessage = "Erreur 400 — image probablement trop volumineuse ou format non supporté. " +
                    "La compression automatique vient d'être ajoutée — réessayez. " +
                    "Si l'erreur persiste, ajoutez un texte d'intention.";
            } else if (String(code) === "429") {
                userMessage = "Trop de requêtes — réessayez dans quelques secondes.";
            } else if (String(code) === "401" || String(code) === "403") {
                userMessage = "Clé API invalide ou expirée.";
            }
            return NextResponse.json({ error: userMessage }, { status: 200 });
        }

        const choice = data.choices?.[0];
        const message = choice?.message;
        const raw = message?.content?.trim();

        if (!raw) {
            // Diagnose WHY we got empty content. Common cases:
            //  1. Anthropic refusal (content moderation) — message.refusal or content_filter finish_reason
            //  2. finish_reason "length" — max_tokens hit before any output
            //  3. finish_reason "content_filter" — output filtered post-generation
            //  4. Tool-call response with no text (shouldn't happen here)
            const finishReason = choice?.finish_reason || choice?.stop_reason;
            const refusal = message?.refusal || null;

            console.error(
                "[explore] Empty content — finish_reason=%s refusal=%s full_response=%s",
                finishReason,
                refusal,
                JSON.stringify(data).slice(0, 800),
            );

            let userMessage = "Réponse vide du modèle";
            if (refusal) {
                userMessage = `Le modèle a refusé la requête : ${refusal}`;
            } else if (finishReason === "content_filter" || finishReason === "safety") {
                userMessage = "Requête bloquée par le filtre de contenu Anthropic. Essayez avec une image différente ou ajoutez un texte d'intention.";
            } else if (finishReason === "length") {
                userMessage = "Réponse tronquée (limite de tokens). Le prompt système est peut-être trop long pour le modèle.";
            } else if (finishReason && finishReason !== "stop") {
                userMessage = `Réponse interrompue (raison : ${finishReason})`;
            }

            return NextResponse.json({ error: userMessage }, { status: 200 });
        }

        // Sonnet may wrap JSON in ```json ... ``` despite the instruction.
        // Strip code fences defensively before parsing.
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, "")
            .replace(/\s*```\s*$/i, "")
            .trim();

        let parsed;
        try {
            parsed = JSON.parse(cleaned);
        } catch (e) {
            console.error("[explore] JSON parse error:", e.message, "— raw first 200:", cleaned.slice(0, 200));
            return NextResponse.json(
                { error: "Format de réponse invalide (JSON malformé)" },
                { status: 200 },
            );
        }

        if (!parsed.cards || !Array.isArray(parsed.cards) || parsed.cards.length === 0) {
            console.error("[explore] Missing or empty cards array");
            return NextResponse.json(
                { error: "Aucune direction générée" },
                { status: 200 },
            );
        }

        // Validate each card has the required fields; drop malformed ones.
        const validCards = parsed.cards.filter(
            (c) => c && typeof c.title === "string" && typeof c.prompt === "string",
        );

        if (validCards.length === 0) {
            return NextResponse.json(
                { error: "Aucune direction valide générée" },
                { status: 200 },
            );
        }

        console.log(`[explore] OK — ${validCards.length} cards generated`);
        return NextResponse.json({ cards: validCards });
    } catch (err) {
        const errorMsg = err.name === "AbortError" ? "Timeout (90s)" : err.message;
        console.error("[explore] Error:", errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 200 });
    }
}
