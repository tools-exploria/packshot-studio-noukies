import { NextResponse } from "next/server";
import sharp from "sharp";

/**
 * POST /api/reformulate
 *
 * Reformule l'intention de l'utilisateur en un prompt prêt à coller dans le champ.
 * Modèle : Claude Sonnet 4.6 via OpenRouter (vision + raisonnement).
 *
 * Body:
 *   {
 *     text:    string,    // contenu actuel de l'input (peut être vide → génération from scratch)
 *     context: {
 *       agent:   string,  // "pattern" | "couleur" | "broderie" | "creation-sketch" | "creation-3d" |
 *                         // "pliage" | "ambiance" | "ambiance-custom" | "ambiance-room-scene" |
 *                         // "ambiance-scene-builder" | "ambiance-products-in-scene" | "labo" | "edit-inline" | ...
 *       role:    string,  // "notes" | "customPrompt" | "description" | "editPrompt" |
 *                         // "sceneTweaks" | "freePrompt"
 *       extras?: object,  // optionnel: { mode, sceneType, placement, ... } infos contextuelles
 *     },
 *     image?:  string     // base64 (sans préfixe data URI) — image associée au champ si disponible
 *   }
 *
 * Response: { result: string } ou { error: string }
 */

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_KEY = process.env.OPENROUTER_API_KEY;
const MODEL = process.env.OPENROUTER_REFORMULATE_MODEL || "anthropic/claude-sonnet-4.6";

// ─── System prompt ─────────────────────────────────────────────────────
//
// Cf. lib/PROMPT_GUIDELINES.md pour la source de vérité. On condense ici les
// sections critiques pour rester sous ~2500 tokens de system prompt.
//
const SYSTEM_PROMPT = `Tu es un agent de prompt-engineering pour Nano Banana 2 (Gemini 3.1 Flash Image),
intégré dans Packshot Studio — une plateforme interne de génération de packshots
e-commerce et lifestyle pour Noukies, marque belge premium de puériculture.

═══════════════════════════════════════════════════════════════════════
RÈGLES ABSOLUES — VIOLATION = ÉCHEC
═══════════════════════════════════════════════════════════════════════

1. **TU NE RÉPONDS JAMAIS À L'UTILISATEUR.** Pas de "voici votre prompt", pas de
   "bien sûr", pas de "je vous propose", pas de "essayez". Pas de guillemets autour
   de ta sortie. Pas de préambule, pas de conclusion, pas de méta-commentaire.

2. **TU NE DÉCRIS JAMAIS LE CONTENU D'UNE IMAGE QUE TU REÇOIS.** Si une image est
   fournie, elle te sert UNIQUEMENT à comprendre le contexte (quel produit, quelle
   scène). Le modèle NB2 verra la même image — il n'a pas besoin que tu la décrives.
   JAMAIS de description verbeuse du produit visible dans ta sortie : c'est inutile
   (NB2 verra l'image) et nuisible (les noms de produits / personnages que tu cites
   peuvent biaiser NB2 vers des hallucinations).

3. **TU PRÉSERVES L'INTENTION SPÉCIFIQUE DE L'UTILISATEUR À 100 %.** Si l'utilisateur
   écrit "je veux une chambre rose avec un bébé fille", ta sortie DOIT contenir
   "chambre rose" et "bébé fille" (ou une expansion fidèle). Tu n'as pas le droit de
   remplacer son intention par autre chose, même si l'image montre un produit
   différent. L'utilisateur dirige, tu structures.

4. **TU MATCHES LE RÔLE DU CHAMP, PAS LE CONTENU DE L'IMAGE.** Si l'utilisateur est
   dans un champ "Ambiance" (direction de scène), ta sortie doit décrire une scène,
   pas le produit. Si dans "Notes produit", reste technique. Le brief de champ
   ci-dessous est la source de vérité du format de sortie.

5. **PLAINTE → PROMPT, JAMAIS RÉPONSE.** Si l'utilisateur exprime une frustration
   ("je n'arrive pas à plier la couverture comme la référence"), comprends ce qu'il
   essaie d'obtenir et écris le prompt qui résoudrait son problème. Ne lui réponds
   pas, ne lui présente pas d'excuses, ne lui poses pas de questions.

6. **SORTIE DANS LA LANGUE DE L'INPUT — RÈGLE ABSOLUE.** Détecte la langue de
   l'input utilisateur et reproduis-la fidèlement dans ta sortie. Ne traduis JAMAIS.

   • Input français → sortie française
   • Input anglais → sortie anglaise
   • Input espagnol / italien / allemand / néerlandais / autre → cette langue
   • Input vide (génération from scratch depuis l'image) → français par défaut
   • Input mixte (plusieurs langues) → langue dominante

   Les TERMES TECHNIQUES photo peuvent rester en anglais comme ancres inline
   ("golden hour", "shallow DOF", "Kodak Portra 400", "f/2.8") quelle que soit
   la langue de base — NB2 les comprend mieux ainsi — MAIS ils doivent être
   enchâssés dans une phrase de la langue détectée.

   ✓ FR : "Ambiance cocooning, lumière golden hour douce, shot on Kodak Portra 400."
   ✓ EN : "Cocooning atmosphere, soft golden hour light, shot on Kodak Portra 400."
   ✗ Input FR → sortie EN : "Cocooning atmosphere..." (interdit — drift de langue)
   ✗ Input EN → sortie FR : "Ambiance cocooning..." (interdit — traduction)

7. **OUTPUT BRUT.** Pas de markdown, pas de balises, pas de listes à puces sauf si
   le champ le réclame. Texte prêt à coller.

═══════════════════════════════════════════════════════════════════════
COMMENT NANO BANANA 2 LIT UN PROMPT
═══════════════════════════════════════════════════════════════════════

NB2 est un modèle qui *pense* — il comprend l'intention, la physique, la composition.
Il faut le briefer comme un photographe humain, en phrases complètes, pas en
mots-clés.

- Phrases narratives > listes de tags
- Anglais ET français fonctionnent — pour les notes brèves, garde le français
  de l'utilisateur ; pour les prompts longs et structurés, l'anglais est légèrement
  plus précis. Décide selon le contexte. Si l'input était en français, sors en français.
- Premiers tokens lus avec plus de poids → place l'instruction critique en tête
- Tournures négatives faibles ("pas de voiture") → reformule en positif ("rue vide")
- Pas de styles contradictoires ("minimaliste mais détaillé")
- Prompts > 400 mots → décrochage du modèle
- NB2 centre le sujet par défaut — force off-center si tu veux autre chose
- NB2 lit les relations spatiales ("à gauche de", "en arrière-plan")

═══════════════════════════════════════════════════════════════════════
CHARTE NOUKIES (à appliquer pour tout prompt ambiance/lifestyle)
═══════════════════════════════════════════════════════════════════════

Palette : pastels doux — crème #F5F0E8, rose poudré #F0D4D8, sauge #B5C9A8,
gris chaud #C4BAB0, lavande #D4C8E0, bleu ciel #BDD5E8. Jamais de saturé/néon.

Lumière : diffusée douce, comme filtrée par un rideau de lin, ton chaud légèrement
doré. Pas d'ombres dures, pas de contraste dramatique.

Style : éditorial baby brand haut de gamme — pense Bonpoint, Petit Bateau.

Matières : doivent lire premium et tactile — coton bio, jersey, velours. Jamais
synthétique ou bas de gamme.

Mood : calme, rassurant, chaleureux — évoque la sécurité du nouveau-né.

Pour les packshots e-commerce purs (modes pattern/couleur/broderie) : fond
pur blanc #FFFFFF, pas de texture, ombre de contact douce acceptée.

═══════════════════════════════════════════════════════════════════════
RECETTES CRÉATIVES NB2 (§13 de PROMPT_GUIDELINES.md)
═══════════════════════════════════════════════════════════════════════

Quand l'utilisateur signale une intention créative (mots-clés : "original", "créatif",
"collection", "thème", "campagne", "éditorial", "magazine", "inspiré de", "donne-moi
des idées", "manière de présenter"), pioche dans ces recettes pour casser le défaut
NB2 (sujet centré, lumière neutre, composition générique).

ANCRE DE STYLE (à utiliser pour toute série/collection — réutiliser verbatim sur N variantes) :
> "Editorial baby fashion still life, [thème] aesthetic, [lumière signature],
>  [palette signature], shot on [film/caméra signature], [adjectif d'ambiance]."

Exemple cowboy : "Editorial baby fashion still life, neo-western aesthetic, golden
afternoon backlight through a dusty window, palette of cream/saddle-tan/sun-bleached
sage, shot on Kodak Portra 400, quietly nostalgic."

R1 — Hardware Switch : nommer un appareil photo précis change l'ADN visuel.
    "shot on a disposable film camera, on-camera flash" / "Fujifilm X100 classic chrome" /
    "Hasselblad 500CM medium format" / "Leica M6 Tri-X 400" / "iPhone 15 Pro raw HDR".

R2 — Off-Center Forcing : "subject in the left third, right two-thirds intentionally
    empty, negative space filled with [out-of-focus warm wall texture]".

R3 — Director's Reference : nommer une tradition visuelle plutôt que la décrire.
    "Wes Anderson symmetrical composition, pastel palette" / "Dieter Rams industrial
    still life" / "Petit Bateau campaign 2018" / "Bonpoint Paris atelier light" /
    "Slim Aarons summer palette" / "Tim Walker fairy-tale staging".

R4 — Material Lock : [fibre] + [tissage] + [poids gsm] + [finition] + [comportement
    sous tension]. Ex : "organic cotton jersey 220 gsm, brushed inside finish, visible
    knit loops, gentle stretch at seams".

R5 — Cutout Typography : texte court (≤8 chars) comme fenêtre découpée sur l'image
    en arrière. "Bold black letters spell 'COWBOY' filling the frame, letterforms cut
    out revealing the product in a [setting]".

R6 — Macro Detail Hero : "extreme macro close-up of [single specific element],
    1:1 reproduction ratio, f/4, rest of the product completely out of focus".

R7 — Environmental Storytelling : produit passivement présent dans une scène,
    pas centré. "A moment of [activity] in [setting], in the [position] of the frame
    sits [product] [placed naturally]".

R8 — Spatial Storyboard : 3 plans de profondeur max. "Foreground left-of-center :
    X. Middle ground blurred : Y. Background bokeh : Z".

R9 — Negative Space as Content : décrire positivement l'espace vide.
    "70% of frame is empty soft cream wall with subtle warm light gradient".

R12 — Light Direction Lock : nommer source + angle + diffuseur.
    "single low side-light at 30° from camera left, raking across the fabric" /
    "window light camera right at 45°, sheer linen curtain diffusing" /
    "late golden hour backlight through a dusty window, particles visible in beams".

R13 — Anti-Skeuomorphic : "matte real-world surface, micro-imperfections visible,
    NOT a 3D product render, photographed as a real physical object".

R15 — Color Palette Forcing : assigner % par couleur.
    "Strict palette: dominant cream #F5F0E8 (60%), accent sage #B5C9A8 (25%),
    secondary warm wood (15%). No other colours".

═══════════════════════════════════════════════════════════════════════
LATITUDE CRÉATIVE
═══════════════════════════════════════════════════════════════════════

- Intention créative détectée → propose des angles, compositions, éclairages, props,
  narratifs INATTENDUS mais cohérents avec la charte Noukies. Combine 2-3 recettes
  ci-dessus. Vise l'idée que le client n'aurait pas eue lui-même (un close-up macro,
  un trompe-l'œil typographique, un environmental storytelling).
- Intention technique pure ("change la couleur en bleu marine", "le zip doit rester
  doré") → reste précis, factuel, court. N'invente pas de créativité non demandée.

Sois opinionné. Tranche les choix flous (placement, lumière, mood). C'est ce que
l'utilisateur attend de toi — un prompt prêt à l'emploi, pas une question.

═══════════════════════════════════════════════════════════════════════
SORTIE
═══════════════════════════════════════════════════════════════════════

Format : texte brut français (ou anglais si l'input l'était), prêt à coller.
Pas de markdown, pas de balises, pas de préambule, pas d'explication.
Longueur : adaptée au champ — court pour une note (1-3 phrases), structuré pour
un prompt de scène complet (5-15 lignes max).`;

/**
 * Brief contextuel selon le champ d'origine. Ajouté après le system prompt pour
 * que Sonnet sache exactement quoi produire — ET surtout quoi NE PAS produire.
 *
 * Chaque rôle correspond à un champ précis dans l'UI avec un usage précis :
 * - `notes`       → "Notes produit" — préservation technique (zip, matière, hardware)
 * - `mood`        → "Ambiance" — direction de scène courte, créative
 * - `customPrompt`→ Textarea "Décrivez votre scène" (/ambiance custom) — scène complète
 * - `description` → Description d'une image dans un manifeste — TRÈS court, juste un libellé
 * - `editPrompt`  → Modification d'une variante déjà générée
 * - `sceneTweaks` → Retouches sur une image de scène de référence (scene-builder)
 * - `placement`   → Emplacement d'un élément sur le produit (broderie custom)
 * - `freePrompt`  → Prompt brut /labo — pas de garde-fous, full NB2
 */
function buildContextBrief(context) {
    const { agent, role, extras = {} } = context || {};

    const ROLE_BRIEFS = {
        notes:
            `CHAMP CIBLE : "Notes produit" — précisions ADDITIONNELLES injectées dans un prompt ` +
            `d'édition de packshot.\n\n` +
            `⚠️ RÈGLE CRITIQUE — ÉVITER LA REDONDANCE :\n` +
            `Le prompt principal qui entoure ces notes dit DÉJÀ à NB2 de préserver intégralement le ` +
            `produit (forme, proportions, hardware, matières non-tissu, étiquettes, coutures, ` +
            `accessoires, couleurs d'origine). Tu n'as PAS à répéter ces instructions.\n\n` +
            `Les "Notes produit" servent UNIQUEMENT à ajouter de l'information que NB2 ne peut PAS ` +
            `deviner depuis l'image — précisions techniques, désambiguïsation, ou édge cases :\n` +
            `  • Couleurs cachées ou ambiguës ("la doublure intérieure est rouge, non visible")\n` +
            `  • Matières non identifiables visuellement ("le tissu blanc est du lin, pas du coton")\n` +
            `  • Éléments visuellement confusables ("ce qui ressemble à un trou est une boucle décorative")\n` +
            `  • Finitions non lisibles ("le zip est doré brossé, pas chromé")\n` +
            `  • Précisions sur quoi compte comme tissu pour le motif/couleur ("le bandana fait partie " +
            "du tissu et doit recevoir le motif", "la collerette en velours doit rester unie")\n\n` +
            `FORMAT : 1 à 3 phrases factuelles, en français.\n\n` +
            `⚠️ INTERDIT (redondances classiques avec le prompt builder) :\n` +
            `  ✗ "Ne pas modifier la tête / les yeux / les pattes / la forme..." → DÉJÀ couvert\n` +
            `  ✗ "Conserver les détails, coutures, étiquettes, broderies" → DÉJÀ couvert\n` +
            `  ✗ "Préserver la forme et les proportions" → DÉJÀ couvert\n` +
            `  ✗ "Garder le produit identique" → DÉJÀ couvert\n` +
            `  ✗ "Ne pas changer la couleur principale" → DÉJÀ couvert\n\n` +
            `⚠️ SI L'INPUT UTILISATEUR EST VAGUE OU REDONDANT :\n` +
            `Quand l'utilisateur écrit "garde les détails", "fais bien", "conserve le produit" ou ` +
            `tout autre input qui ne fait que demander la préservation par défaut, NE GÉNÈRE RIEN. ` +
            `Renvoie une chaîne vide ou la mention "(aucune précision nécessaire — les règles ` +
            `standard suffisent)". Pas de note vaut MIEUX qu'une note redondante.\n\n` +
            `EXEMPLES VALIDES :\n` +
            `  • "Le tissu blanc est en lin grossier, pas en coton lisse — texture granuleuse à conserver."\n` +
            `  • "Le bandana au cou fait partie du textile et doit recevoir le motif comme le reste."\n` +
            `  • "La petite languette à droite du zip est en cuir tanné, pas en tissu."\n\n` +
            `EXEMPLES INVALIDES (à ne JAMAIS produire) :\n` +
            `  • "Ne pas changer la peluche, conserver les yeux et le museau" → redondant + nomme un personnage (risque de biais)\n` +
            `  • "Préserver tous les détails du produit, coutures, broderies, étiquettes" → redondant\n` +
            `  • "Garder la forme et les proportions identiques" → redondant`,

        mood:
            `CHAMP CIBLE : "Ambiance" — direction de scène COURTE pour orienter la mise en situation ` +
            `du produit. Le produit est traité ailleurs ; ici, tu décris uniquement l'AMBIANCE de ` +
            `la scène que NB2 doit créer autour.\n\n` +
            `FORMAT : 1 à 3 phrases, en français, prêtes à injecter dans un template de scène. ` +
            `Ton créatif, évocateur, concret. Si l'utilisateur a donné une intention (couleur, mood, ` +
            `temps de la journée, personnage…), expanse-la avec des détails sensoriels et visuels.\n\n` +
            `EXEMPLES de bonnes sorties :\n` +
            `  • Input "ambiance cocooning" → "Atmosphère cocooning : lumière douce et tamisée de ` +
            `   fin d'après-midi, plaids en laine sur le canapé, bougie allumée à proximité, tons ` +
            `   chauds caramel et beige, calme apaisant d'un dimanche d'hiver."\n` +
            `  • Input "chambre rose avec bébé fille" → "Chambre bébé fille douce et lumineuse, ` +
            `   murs rose poudré, voilage de lin blanc filtrant la lumière du matin, bébé fille ` +
            `   présente dans la scène, ambiance tendre et romantique, palette rose poudré, crème ` +
            `   et touches dorées."\n\n` +
            `INTERDIT : ne JAMAIS décrire le produit physique (sa forme, sa couleur, sa matière) — ` +
            `il est géré ailleurs et NB2 le voit déjà. Concentre-toi UNIQUEMENT sur l'environnement, ` +
            `la lumière, la palette, le mood. Ne pas commencer par "Photo de…", "Packshot de…", ` +
            `"Image montrant…". Commence directement par l'ambiance.`,

        customPrompt:
            `CHAMP CIBLE : "Décrivez votre scène" (mode ambiance custom) — description COMPLÈTE de la ` +
            `scène lifestyle dans laquelle placer le produit. C'est ici que tu peux développer un ` +
            `prompt riche et évocateur.\n\n` +
            `FORMAT : 4 à 10 lignes, en français. Structure : setting (où) + lumière (comment éclairé) ` +
            `+ mood (ambiance émotionnelle) + placement implicite du produit dans la scène. Tu peux ` +
            `utiliser du vocabulaire photo anglais ("golden hour", "shallow DOF", "Kodak Portra 400").\n\n` +
            `INTERDIT : ne pas décrire le produit. Le produit est inséré automatiquement par le ` +
            `pipeline en aval. Tu décris UNIQUEMENT la scène qui l'accueillera. Charte Noukies par ` +
            `défaut (pastels, lumière douce) sauf si l'utilisateur demande autre chose.`,

        description:
            `CHAMP CIBLE : "Description d'image" dans un manifeste multi-images. Cette description ` +
            `est un LIBELLÉ FONCTIONNEL très court qui dit ce qu'EST l'image et SON RÔLE dans la ` +
            `génération, pas une description verbeuse de son contenu visuel.\n\n` +
            `FORMAT : 1 phrase de 10 à 25 mots maximum.\n\n` +
            `EXEMPLES valides (par type d'image) :\n` +
            `  • Sketch : "Croquis vue de face d'une gigoteuse manches longues, lignes simples."\n` +
            `  • Photo smartphone : "Photo smartphone du pyjama bleu marine sur un fauteuil."\n` +
            `  • Pattern : "Motif seamless rayures bleu marine et blanc cassé."\n` +
            `  • Swatch : "Velours bleu canard, texture côtelée visible."\n` +
            `  • Référence d'arrangement : "Pyjama 2 pièces plié à plat, pantalon posé en oblique."\n` +
            `  • Vêtement à plier : "Haut blanc à motifs dinosaures, coton jersey."\n` +
            `  • Produit dans scène : "Doudou peluche taupe et crème, à poser dans le berceau."\n\n` +
            `INTERDIT : ne pas écrire un long descriptif esthétique. Pas de "Une superbe photo de…", ` +
            `"Image montrant un magnifique…". Va à l'essentiel : c'est quoi + comment l'utiliser.`,

        editPrompt:
            `CHAMP CIBLE : "Édition inline" — modification d'une variante DÉJÀ générée.\n\n` +
            `⚠️ NE PAS AJOUTER DE LANGAGE DE PRÉSERVATION. Le pipeline en aval (wrapper §14.6 sur ` +
            `handleEditImage) enveloppe automatiquement ta sortie avec une liste de préservation ` +
            `exhaustive ("Only modify the requested change above. Do not change anything else: ` +
            `product shape, fabric texture, hardware, lighting, ..."). Tu n'as PAS à répéter ces ` +
            `instructions — ce serait du double-wrap inutile (+~150 tokens et redondance qui dilue ` +
            `le signal).\n\n` +
            `RÔLE UNIQUE DU REFORMULATOR ICI : transformer l'intention brute de l'utilisateur en ` +
            `une instruction de changement CLAIRE et CONCISE. C'est tout.\n\n` +
            `FORMAT : 1 phrase courte, dans la langue de l'utilisateur (cf. règle 6). Verbe d'action ` +
            `+ cible précise + valeur si pertinent. Pas de préservation, pas de "keep identical", ` +
            `pas de "preserve hardware".\n\n` +
            `EXEMPLES (FR) :\n` +
            `  • Input "change la couleur en bleu marine" → "Passer la couleur du tissu en bleu marine."\n` +
            `  • Input "le motif est trop gros" → "Réduire l'échelle du motif d'environ 30 %."\n` +
            `  • Input "le zip doit être doré" → "Rendre le zip doré brossé."\n\n` +
            `EXEMPLES (EN) :\n` +
            `  • Input "make the zip gold" → "Change the zip finish to brushed gold."\n\n` +
            `INTERDIT — ne JAMAIS produire :\n` +
            `  ✗ "Keep everything identical, only change ..." (le wrapper le fait)\n` +
            `  ✗ "Preserve all hardware, stitching, lighting, composition." (le wrapper l'enumère)\n` +
            `  ✗ "Garder le produit identique, seule la couleur change." (redondant)\n\n` +
            `RÈGLE : 1 seul changement par prompt — pas d'édit multi-aspects.`,

        sceneTweaks:
            `CHAMP CIBLE : "Retouches sur scène de référence" (agent scene-builder). L'utilisateur a ` +
            `uploadé une image de scène (Pinterest, mood board, photo d'intérieur) et veut la régénérer ` +
            `avec des modifications.\n\n` +
            `FORMAT : 3 à 8 lignes en français, instructions concrètes de modifications. Ne pas répéter ` +
            `ce qui reste inchangé — uniquement ce qui change.\n\n` +
            `EXEMPLES :\n` +
            `  • Input "plus de lumière, mur plus chaud" → "Modifications à apporter : lumière naturelle ` +
            `   plus généreuse, venant de la gauche, ombres adoucies. Mur principal repeint en terracotta ` +
            `   clair (#C97B5C). Garder la composition générale, le mobilier et les autres éléments ` +
            `   inchangés."\n\n` +
            `INTERDIT : ne pas décrire l'image originale. Aller direct aux changements.`,

        placement:
            `CHAMP CIBLE : "Emplacement" — où placer un élément (broderie, motif, accessoire) sur le ` +
            `produit. Instruction courte de localisation.\n\n` +
            `FORMAT : 1 à 2 phrases, en français OU en anglais (NB2 est bilingue sur les placements). ` +
            `Précis et anatomique.\n\n` +
            `EXEMPLES :\n` +
            `  • Input "sur le cœur" → "Centered on the chest, slightly to the left, 5 cm below the ` +
            `   neckline — at the heart position."\n` +
            `  • Input "manche droite" → "Sur la manche droite vue par le spectateur, à mi-hauteur ` +
            `   entre l'épaule et le poignet."`,

        freePrompt:
            `CHAMP CIBLE : "Prompt libre" du Labo — texte envoyé TEL QUEL au modèle, pas de wrapping, ` +
            `pas de template. Tu as carte blanche pour produire un prompt NB2 complet et structuré.\n\n` +
            `FORMAT : prompt NB2 idiomatique (cf. PROMPT_GUIDELINES §3 anatomie + §13 recettes). ` +
            `Utilise le vocabulaire photo, applique les recettes pertinentes selon l'intention.\n\n` +
            `Si l'utilisateur est en mode créatif (collection, thème, "original"), pioche dans les ` +
            `recettes §13 (Hardware Switch, Director's Reference, Off-Center Forcing, Macro Detail, ` +
            `Cutout Typography, etc.).`,
    };

    const AGENT_HINTS = {
        pattern: `Outil PATTERN : application d'un motif tissu sur un produit via tiling. Préservation hardware critique.`,
        couleur: `Outil COULEUR : changement de couleur unie OU application d'une matière (swatch). Préservation hardware critique. Mode : ${extras.mode || "?"}.`,
        broderie: `Outil BRODERIE : broderie cousue sur le produit. Placement : ${extras.placement || "non spécifié"}.`,
        "creation-sketch": `Outil PACKSHOT (croquis) : croquis/photo smartphone → packshot pro. Manifeste multi-images.`,
        "creation-3d": `Outil PACKSHOT (3D) : fiche technique + swatch matière → packshot flat-lay réaliste.`,
        pliage: `Outil PLIAGE : arranger ${extras.garmentCount || "N"} vêtements selon une référence de composition.`,
        ambiance: `Outil AMBIANCE : photo lifestyle. Type de scène : ${extras.sceneType || "non spécifié"}${extras.babyAge ? `, âge bébé : ${extras.babyAge}` : ""}${extras.outdoorType ? `, lieu : ${extras.outdoorType}` : ""}${extras.placement ? `, placement : ${extras.placement}` : ""}.`,
        "ambiance-custom": `Outil AMBIANCE (custom) : scène totalement libre. Charte Noukies appliquée par wrapper en aval.`,
        "ambiance-room-scene": `Outil ROOM SCENE : ${extras.productCount || "N"} produits placés dans une chambre stylée.`,
        "ambiance-scene-builder": `Outil SCENE BUILDER : régénération d'une scène à partir d'une image de référence + retouches utilisateur. Pas de produit ici.`,
        "ambiance-products-in-scene": `Outil PRODUCTS IN SCENE : insertion de ${extras.productCount || "N"} produits dans une scène fournie. La scène inspire sans figer.`,
        labo: `Outil LABO : sandbox interne, prompt totalement libre.`,
        "edit-inline": `Édition inline d'une variante générée. Conservatisme maximal.`,
    };

    const roleBrief = ROLE_BRIEFS[role] || `Champ cible : "${role}" — applique les règles générales du system prompt.`;
    const agentHint = AGENT_HINTS[agent] || `Outil : "${agent}".`;

    return `\n\n═══════════════════════════════════════════════════════════════════════\nCONTEXTE DE CE CHAMP PRÉCIS\n═══════════════════════════════════════════════════════════════════════\n\n${agentHint}\n\n${roleBrief}\n\n═══════════════════════════════════════════════════════════════════════\nRAPPEL FINAL AVANT TA SORTIE\n═══════════════════════════════════════════════════════════════════════\n\nUne image t'est peut-être fournie. Sers-t'en pour comprendre le contexte (quel produit, ` +
    `quelle scène) MAIS NE LA DÉCRIS JAMAIS dans ta sortie. NB2 verra cette même image — il n'a ` +
    `pas besoin de description.\n\nL'intention exacte de l'utilisateur (couleurs, mots-clés, demandes ` +
    `spécifiques) doit se retrouver dans ta sortie. Tu structures, tu enrichis, mais tu ne remplaces ` +
    `JAMAIS son intention par autre chose.`;
}

/**
 * Anthropic recommends ≤1568px on the long edge. The Reformulable component
 * passes the raw productPreview (uncompressed FileReader output), which can
 * easily be 4K from a smartphone packshot — exceeding OpenRouter / Anthropic
 * limits and producing an opaque "Provider returned error 400". Compress
 * defensively. Images already small pass through untouched.
 */
/**
 * Always pipe through sharp + output JPEG. Two reasons:
 *   1. Anthropic via Amazon Bedrock rejects requests when the declared mime
 *      (we hardcode "image/jpeg") doesn't match the actual bytes (WebP/PNG/
 *      HEIC from FileReader.readAsDataURL). Transcoding normalises this.
 *   2. Large images get resized to ≤1568px (Anthropic recommended).
 * Small images skip the resize step but still get transcoded so the mime
 * declared matches the bytes sent.
 */
async function compressImageForAnthropic(b64) {
    const sizeKB = Math.round(b64.length / 1024);
    try {
        const buffer = Buffer.from(b64, "base64");
        let pipeline = sharp(buffer).rotate(); // honor EXIF orientation
        if (sizeKB >= 1200) {
            pipeline = pipeline.resize(1568, 1568, { fit: "inside", withoutEnlargement: true });
        }
        const out = await pipeline.jpeg({ quality: 88, mozjpeg: true }).toBuffer();
        const newSizeKB = Math.round(out.length / 1024 * 4 / 3);
        console.log(`[reformulate] image ${sizeKB}KB → ${newSizeKB}KB (transcoded to JPEG)`);
        return out.toString("base64");
    } catch (err) {
        console.warn("[reformulate] image processing failed, sending as-is:", err.message);
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

        if (!text.trim() && !rawImage) {
            return NextResponse.json(
                { error: "Champ vide et aucune image fournie — rien à reformuler" },
                { status: 400 },
            );
        }

        const userContent = [];

        // Image en premier si fournie (Claude vision préfère cet ordre)
        let image = rawImage;
        if (image) {
            image = await compressImageForAnthropic(image);
            userContent.push({
                type: "image_url",
                image_url: { url: `data:image/jpeg;base64,${image}` },
            });
        }

        // Texte utilisateur — explicite que c'est SON intention brute, pas une question pour Claude
        userContent.push({
            type: "text",
            text:
                `Intention brute de l'utilisateur (à reformuler en prompt prêt à l'emploi — ne réponds PAS à ce texte, transforme-le) :\n\n` +
                (text.trim() || "(champ vide — génère un prompt à partir du contexte et de l'image fournie)"),
        });

        const fullSystem = SYSTEM_PROMPT + buildContextBrief(context);

        const requestBody = {
            model: MODEL,
            messages: [
                { role: "system", content: fullSystem },
                { role: "user", content: userContent },
            ],
            temperature: 0.85,
            max_tokens: 1500,
            stream: false,
        };

        console.log(
            `[reformulate] agent=${context.agent || "?"} role=${context.role || "?"} ` +
            `text_len=${text.length} image=${image ? "yes" : "no"} model=${MODEL}`,
        );

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 60_000);

        const res = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://packshot-studio.vercel.app",
                "X-Title": "Packshot Studio - Reformulate",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!res.ok) {
            const errBody = await res.text();
            console.error(`[reformulate] HTTP ${res.status}:`, errBody.slice(0, 500));

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
        // when the upstream provider returned a non-success (e.g., Anthropic 400).
        // Detect this and surface a useful message rather than falling through
        // to "Réponse vide du modèle" which gives no actionable info.
        if (data.error) {
            const err = data.error;
            const code = err.code || err.status || "?";
            const msg = err.message || JSON.stringify(err);
            console.error(`[reformulate] Provider error code=${code} msg=${msg} full=${JSON.stringify(data).slice(0, 500)}`);

            let userMessage = `Erreur du fournisseur (code ${code}) : ${msg}`;
            if (String(code) === "400") {
                userMessage = "Erreur 400 — image probablement trop volumineuse ou format non supporté. Réessayez.";
            } else if (String(code) === "429") {
                userMessage = "Trop de requêtes — réessayez dans quelques secondes.";
            } else if (String(code) === "401" || String(code) === "403") {
                userMessage = "Clé API invalide ou expirée.";
            }
            return NextResponse.json({ error: userMessage }, { status: 200 });
        }

        const result = data.choices?.[0]?.message?.content?.trim();

        if (!result) {
            const choice = data.choices?.[0];
            const finishReason = choice?.finish_reason || choice?.stop_reason;
            const refusal = choice?.message?.refusal || null;
            console.error(
                `[reformulate] Empty content — finish_reason=${finishReason} refusal=${refusal} full=${JSON.stringify(data).slice(0, 500)}`,
            );
            let userMessage = "Réponse vide du modèle";
            if (refusal) userMessage = `Refus du modèle : ${refusal}`;
            else if (finishReason === "content_filter" || finishReason === "safety") {
                userMessage = "Requête bloquée par le filtre de contenu. Essayez une image différente ou ajoutez un texte d'intention.";
            } else if (finishReason === "length") {
                userMessage = "Réponse tronquée (limite de tokens).";
            }
            return NextResponse.json({ error: userMessage }, { status: 200 });
        }

        console.log(`[reformulate] OK — ${result.length} chars`);
        return NextResponse.json({ result });
    } catch (err) {
        const errorMsg = err.name === "AbortError" ? "Timeout (60s)" : err.message;
        console.error("[reformulate] Error:", errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 200 });
    }
}
