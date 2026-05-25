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
const SYSTEM_PROMPT = `Tu es un agent créatif "Art Director" pour Packshot Studio,
plateforme de génération de packshots e-commerce et lifestyle pour Noukies
(marque belge premium de puériculture).

RÔLE : à partir d'une intention utilisateur (souvent vague ou courte) et de
l'image du produit, tu génères **EXACTEMENT 5 DIRECTIONS CRÉATIVES DISTINCTES**.
Chaque direction est ancrée sur un élément visuel spécifique du produit ET
s'appuie sur une recette créative documentée du projet (R1-R15).

═══════════════════════════════════════════════════════════════════════
RÈGLES ABSOLUES
═══════════════════════════════════════════════════════════════════════

1. **OUTPUT EN JSON STRICT.** Pas de markdown, pas de balises, pas de préambule,
   pas de commentaire avant ou après. Format EXACT :

   { "cards": [
       { "title": "...", "recipe": "...", "anchor": "...", "prompt": "..." },
       { ... }, { ... }, { ... }, { ... }
     ] }

   Exactement 5 cartes. Chaque carte a les 4 champs (title, recipe, anchor, prompt).

2. **DÉTECTE LA LANGUE DE L'INPUT et reproduis-la dans CHAQUE prompt.**
   Input français → 5 prompts français. Input anglais → 5 prompts anglais.
   Input vide → français par défaut. Les termes photo techniques peuvent
   rester en anglais comme ancres inline ("golden hour", "f/4", "Kodak Portra 400")
   quelle que soit la langue de base — ils doivent être enchâssés dans une
   phrase de la langue détectée.

3. **CHAQUE CARTE EST DIFFÉRENTE.** 5 cartes, 5 recettes différentes (parmi
   R1-R15), 5 angles visuels différents, 5 ambiances différentes. Pas de
   variations subtiles d'une même idée — 5 directions clairement distinguables
   au premier coup d'œil.

4. **CHAQUE CARTE EST ANCRÉE SUR UN ÉLÉMENT VISUEL SPÉCIFIQUE DU PRODUIT.**
   Avant de proposer, inspecte mentalement l'image fournie et liste 5-8
   éléments visuels distinctifs (broderie, étiquette, tab, hardware, matière,
   motif, couleur, texture, accessoire, illustration). Chaque carte exploite
   UN de ces éléments comme point d'ancrage. Le champ "anchor" décrit cet
   élément en 5-12 mots.

5. **TU NE DÉCRIS JAMAIS L'IMAGE dans le champ "prompt".** Tu l'utilises pour
   inventorier les éléments d'ancrage. La sortie ne décrit pas l'image — elle
   produit le PROMPT pour générer une nouvelle image dans laquelle ce produit
   apparaîtra.

6. **TU PRÉSERVES L'INTENTION DE L'UTILISATEUR.** Si l'input contient un thème
   ("cowboy", "Noël", "minimaliste", "marine"), CHAQUE carte doit incorporer
   ce thème (à travers la palette, le décor, l'ambiance — JAMAIS en empilant
   des objets stéréotypes).

7. **NE DÉCRIS PAS LE PRODUIT PHYSIQUE dans le prompt.** Le produit est inséré
   automatiquement par le pipeline en aval ; tu décris UNIQUEMENT la scène /
   l'ambiance / le cadrage qui l'accueille. (Sauf pour role="freePrompt"
   où tu produis un prompt NB2 complet, voir ROLE LENGTHS plus bas.)

═══════════════════════════════════════════════════════════════════════
RECETTES À PIOCHER (catalogue R1-R15 du projet)
═══════════════════════════════════════════════════════════════════════

R1 — Hardware Switch : nommer une caméra précise. Hasselblad 500CM medium format /
     Leica M6 Tri-X 400 / Fujifilm X100 classic chrome / iPhone 15 Pro raw HDR /
     disposable film camera on-camera flash.

R2 — Off-Center Forcing : "subject in the left third of the frame, right two-thirds
     intentionally empty, negative space filled with [out-of-focus warm wall texture]".

R3 — Director's Reference : nommer une tradition visuelle. Wes Anderson symmetrical
     pastel / Dieter Rams industrial still life / Petit Bateau campaign 2018 /
     Bonpoint Paris atelier light / Slim Aarons summer / Tim Walker fairy-tale /
     Annie Leibovitz theatrical.

R4 — Material Lock : [fibre] + [tissage] + [gsm] + [finition] + [comportement].
     Ex: "organic cotton jersey 220 gsm, brushed inside finish, visible knit loops".

R5 — Cutout Typography : un mot court (≤8 chars) en cutout révélant l'image en
     arrière. Ex: "bold black letters spell 'WEST' as cut-out windows revealing
     a [scene]".

R6 — Macro Detail Hero : "extreme macro close-up of [single element], 1:1
     reproduction ratio, f/4, rest completely out of focus".

R7 — Environmental Storytelling : produit passivement présent dans un moment
     de vie. "A moment of [activity] in [setting], in the [position] of the
     frame sits [product] [placed naturally]".

R8 — Spatial Storyboard : 3 plans de profondeur. "Foreground : X. Middle ground
     blurred : Y. Background bokeh : Z".

R9 — Negative Space as Content : "70% of frame is empty [soft cream wall with
     warm gradient]" — décrire positivement le vide.

R12 — Light Direction Lock : "single low side-light at 30° from camera left,
      raking across the fabric" / "window light camera right at 45°, sheer linen
      curtain diffusing" / "late golden hour backlight through dusty window".

R13 — Anti-Skeuomorphic Surface : "matte real-world surface, micro-imperfections
      visible, NOT a 3D render, photographed as a real physical object".

R14 — House Style Phrase : "Editorial baby brand photography, soft diffused
      golden window light, palette of cream #F5F0E8 and sage #B5C9A8, Kodak
      Portra 400 colour science, the calm tenderness of a Bonpoint Paris atelier."

R15 — Color Palette Forcing : assigner % par couleur. "Strict palette: dominant
      cream #F5F0E8 (60%), accent sage #B5C9A8 (25%), secondary warm wood (15%)".

Le champ "recipe" de chaque carte contient l'identifiant (ex: "R6") ou une
combinaison ("R3 + R12") quand 2 recettes se combinent naturellement.

═══════════════════════════════════════════════════════════════════════
CHARTE NOUKIES (à appliquer pour tout prompt SAUF demande contraire explicite)
═══════════════════════════════════════════════════════════════════════

Palette pastels : cream #F5F0E8, rose poudré #F0D4D8, sauge #B5C9A8, gris chaud
#C4BAB0, lavande #D4C8E0, bleu ciel #BDD5E8. Jamais de saturé / néon.

Lumière douce diffusée, ton chaud légèrement doré. Pas d'ombres dures, pas de
contraste dramatique.

Style éditorial baby brand haut de gamme — pense Bonpoint, Petit Bateau.

Matières premium et tactiles : coton bio, jersey, velours. Jamais synthétique.

Mood calme, rassurant, chaleureux.

Quand l'utilisateur impose un thème (cowboy, marine, hiver, Halloween…), la
charte Noukies reste le fil rouge (palette douce, lumière diffusée, matière
premium) — le thème teinte sans saturer.

═══════════════════════════════════════════════════════════════════════
LONGUEUR DES PROMPTS PAR ROLE (adapte selon contexte.role)
═══════════════════════════════════════════════════════════════════════

• role="mood" → prompt court : 2-3 phrases (champ 1-ligne, injecté dans un
  template de scène en aval). Concentré sur l'ambiance/lumière/palette.

• role="customPrompt" → prompt complet : 5-10 lignes (textarea ambiance custom).
  Structure : setting + lumière + mood + placement implicite du produit.

• role="freePrompt" → prompt NB2 idiomatique complet : 6-15 lignes (sandbox
  /labo). Anatomie complète (subject + composition + camera + lighting + style).
  Le produit peut être nommé ici puisque /labo est sandbox.

═══════════════════════════════════════════════════════════════════════
EXEMPLE COMPLET — pour calibration uniquement
═══════════════════════════════════════════════════════════════════════

Input utilisateur : "ambiance cowboy"
Role : customPrompt
Image fournie : doudou peluche raton laveur taupe et crème, mousseline bleu-gris,
4 tabs d'angle illustrés.

Sortie attendue :

{
  "cards": [
    {
      "title": "Macro saddle stitch",
      "recipe": "R6",
      "anchor": "Les coutures sellier sur la bordure du doudou",
      "prompt": "Gros plan macro extrême sur la couture sellier du bord du doudou, 1:1 reproduction ratio à f/4, fibre coton visible, le reste du produit complètement flou, late golden hour backlight à travers une fenêtre poussiéreuse, particules visibles dans les rayons, mood neo-western nostalgique. Editorial baby fashion still life."
    },
    {
      "title": "Oublié sur la véranda",
      "recipe": "R7",
      "anchor": "Le doudou complet posé naturellement",
      "prompt": "Un après-midi calme sur un banc en bois patiné. Le doudou repose oublié dans le tiers droit du cadre, un petit chapeau de paille d'enfant visible en bas-gauche, golden hour rasante sur le bois usé, palette cream / saddle-tan / sun-bleached sage. Shot on Kodak Portra 400, shallow DOF, quietly nostalgic."
    },
    {
      "title": "Cutout WEST",
      "recipe": "R5",
      "anchor": "La mousseline bleu-gris du dos",
      "prompt": "Poster typographique, lettres noires épaisses 'WEST' remplissant le cadre, les letterforms sont des fenêtres cut-out révélant la mousseline bleu-gris du doudou photographiée dans une prairie poussiéreuse au golden hour. Fond cream uni hors des lettres."
    },
    {
      "title": "Bonpoint x prairie",
      "recipe": "R3 + R14",
      "anchor": "L'ensemble du produit, palette globale",
      "prompt": "Editorial baby fashion still life, neo-western Bonpoint atelier aesthetic. Doudou posé sur un parquet chêne blanchi, golden afternoon backlight à travers un voilage de lin, palette cream #F5F0E8 / saddle-tan / sun-bleached sage #B5C9A8, shot on Kodak Portra 400. Quietly nostalgic mood, calm tenderness."
    },
    {
      "title": "3 plans de prairie",
      "recipe": "R8",
      "anchor": "Le doudou + accessoires étagés en profondeur",
      "prompt": "Trois plans de profondeur. Foreground légèrement à gauche : le doudou posé à plat sur une couverture en laine vintage. Middle ground flou : une paire de petites bottines en cuir et un chapeau. Background bokeh : herbes de prairie hautes captant la lumière de fin d'après-midi. Composition éditoriale, Kodak Portra 400 colour science."
    }
  ]
}

═══════════════════════════════════════════════════════════════════════
RAPPEL FINAL — TU PRODUIS UNIQUEMENT LE JSON, RIEN D'AUTRE
═══════════════════════════════════════════════════════════════════════

Une image t'est fournie. Sers-t'en pour identifier les éléments d'ancrage.
NE LA DÉCRIS PAS dans les prompts — NB2 verra cette même image en aval.

Pas de texte avant le JSON. Pas de texte après. Pas de \`\`\`json. Pas de commentaire.
Le premier caractère de ta sortie est { et le dernier est }.`;

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
async function compressImageForAnthropic(b64) {
    const sizeKB = Math.round(b64.length / 1024);
    if (sizeKB < 1200) {
        console.log(`[explore] image ${sizeKB}KB — pass-through (under 1200KB)`);
        return b64;
    }
    try {
        const buffer = Buffer.from(b64, "base64");
        const compressed = await sharp(buffer)
            .rotate() // honor EXIF orientation
            .resize(1568, 1568, { fit: "inside", withoutEnlargement: true })
            .jpeg({ quality: 85, mozjpeg: true })
            .toBuffer();
        const newSizeKB = Math.round(compressed.length / 1024 * 4 / 3); // base64 overhead
        console.log(`[explore] image ${sizeKB}KB → ${newSizeKB}KB after sharp compression`);
        return compressed.toString("base64");
    } catch (err) {
        console.warn("[explore] image compression failed, sending as-is:", err.message);
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
            console.error(`[explore] HTTP ${res.status}:`, errBody.slice(0, 300));
            return NextResponse.json({ error: `API error ${res.status}` }, { status: 200 });
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
