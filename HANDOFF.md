# Packshot Studio — État du projet

> **Date** : 18 mai 2026
> **Stack** : Next.js 16.1 + React 19.2 + Tailwind 4.2 + shadcn/ui + sharp 0.34
> **API** : OpenRouter (Gemini 3.1 Flash + 3 Pro image-preview)
> **Repo** : `/home/pigbenis/projects/Noukies/packshot-studio`
> **Auth** : Cookie session 30j protégé par `SITE_PASSWORD` (middleware `proxy.js`)

---

## 🎯 Objectif

Application web interne pour **Noukies** (marque belge premium de puériculture).
Plateforme de génération de packshots e-commerce et photos lifestyle via IA.
7 outils spécialisés, prompts centralisés, pipeline d'export commun.

---

## 📁 Architecture

```
app/
├── page.js                       # Homepage — 7 cartes outils
├── layout.js                     # AppShell + Outfit font + metadata FR
├── globals.css                   # Tailwind + design tokens Noukies
├── login/page.js                 # Page d'auth (sans header/footer)
│
├── pattern/page.js               # Outil 1 — Motif tissu via tiling
├── couleur/page.js               # Outil 2 — Couleur unie OU swatch matière
├── broderie/page.js              # Outil 3 — Broderie avec placement
├── creation/                     # Outil 4 — Création produit (2 onglets)
│   ├── page.js                   #   Switch d'onglets
│   ├── SketchTab.js              #   Produit → Packshot (photo/packshot/croquis → packshot, Image Manifest)
│   └── ProduitTab.js             #   Croquis → Packshot (fiche technique + swatch → flat-lay 3D)
├── pliage/page.js                # Outil 5 — Disposition multi-vêtements
├── ambiance/                     # Outil 6 — Lifestyle (2 sous-routes)
│   ├── page.js                   #   Scène produit (nursery / bébé / outdoor / custom)
│   └── room-scene/page.js        #   Scène chambre multi-produits
├── labo/page.js                  # Outil 7 — Prompt libre (sandbox interne)
├── angles/page.js                # (masqué homepage) Vues alternatives — code conservé
│
└── api/
    ├── generate/route.js         # Proxy OpenRouter (legacy + interleaved)
    ├── tile/route.js             # Tiling sharp (density 1-20)
    ├── export/route.js           # Resize + conversion PNG/JPG (sharp)
    ├── chromakey/route.js        # Détourage vert/magenta/bleu → transparent
    └── auth/route.js             # Login : compare password + set cookie

components/
├── AppShell.jsx                  # Header sticky + footer + bypass page login
├── NavLinks.jsx                  # Navigation principale (7 liens, angles masqué)
├── shared.jsx                    # LoadingDots, UploadZone, Stepper, (vieux ImageGrid)
├── ImageGrid.jsx                 # Grille post-génération : sélection, edit inline, regen Pro
├── GenerationControls.jsx        # Bloc preset + variants + res + ratio + notes + bouton ⚡
├── ExportPanel.jsx               # Fond original/blanc/transparent + resize + PNG/JPG/PDF
├── Lightbox.jsx                  # GalleryLightbox (zoom/pan) + SimpleLightbox (réfs)
└── ui/                           # shadcn/ui (button, card, dialog, input, label, badge…)

hooks/
├── useGenerationPage.js          # ★ ~70 % de l'état partagé entre outils
└── useExportPipeline.js          # ★ Tout le pipeline d'export (chroma key, sharp, dl)

lib/
├── api.js                        # fileToBase64, compressBase64Image, generateImages, MODELS
├── prompts.js                    # Tous les prompts (blocs partagés + builders par outil)
├── interleaved.js                # Image Manifest pattern (anti-hallucination multi-images)
├── config.js                     # API_CONFIG + getCanvasSize(resolution, aspectRatio)
├── utils.js                      # cn() — Tailwind merge
└── PROMPT_GUIDELINES.md          # Bible de prompting NB2 (646 lignes, 12 sections)

proxy.js                          # Middleware Next.js — gate auth global sauf /login + /api/auth
generations.log                   # Log append-only de chaque génération (timestamp/model/res)
```

---

## 🛠️ Les 7 outils

| # | Outil | Route | Étapes | Inputs spécifiques | Prompt |
|---|-------|-------|--------|--------------------|--------|
| 1 | **Motif / Pattern** | `/pattern` | 5 (Produit → Pattern → Tiling → Génération → Export) | produit + motif + slider densité (1-20) | `PROMPTS.applyPattern` |
| 2 | **Couleur / Matière** | `/couleur` | 4 (Produit → Couleur/Matière → Génération → Export) | mode **picker** (hex + 8 presets) OU **texture** (swatch upload) | `solidColor(hex, name, notes)` ou `applyTexture(notes)` |
| 3 | **Broderie** | `/broderie` | 5 (Produit → Broderie → Placement → Génération → Export) | produit + design broderie + placement (gauche/droite/custom) | `applyEmbroidery(placement, notes)` |
| 4a | **Produit → Packshot** | `/creation` (tab sketch, libellé UI « Produit → Packshot ») | 3 (Images → Génération → Export) | 1 image base (photo smartphone / packshot / croquis) + N refs complémentaires avec chips (Détail / Angle non visible / Texture) | `sketchToPackshot(notes)` via **Image Manifest** |
| 4b | **Croquis → Packshot** | `/creation` (tab produit, libellé UI « Croquis → Packshot ») | 4 (Produit → Matière → Génération → Export) | fiche technique (croquis du produit) + swatch matière | `product3D(notes)` — timeout 180s |
| 5 | **Pliage & Disposition** | `/pliage` | 3 (Images → Génération → Export) | 1 réf arrangement + N vêtements (avec descriptions) | `pliage(garmentCount, notes)` via **Image Manifest** |
| 6a | **Photo d'ambiance** | `/ambiance` | 4 (Produit → Scène → Génération → Export) | type scène : `nursery_scene`, `baby_scene` (3 âges), `outdoor_scene` (3 lieux), `custom` | `nurseryScene` / `babyScene` / `outdoorScene` / `ambianceCustom` |
| 6b | **Photo d'ambiance — Room scene** | `/ambiance/room-scene` | 3 (Produits → Génération → Export) | N produits + mood optionnel | `roomScene(productCount, mood, notes)` via **Image Manifest** |
| 7 | **Labo** | `/labo` | 3 (Setup → Génération → Export) | produit + N réfs + prompt brut libre | aucun template — texte direct |
| (cache) | **Angles alternatifs** | `/angles` (masqué) | 4 | produit + refs supplémentaires (same/structure) + angle type + detailFocus | `alternateAngle(angleType, detailFocus, notes, refDescriptions)` |

Tous les outils sont câblés sur les hooks partagés (`useGenerationPage` + `useExportPipeline`) et utilisent les composants partagés (`GenerationControls`, `ImageGrid`, `ExportPanel`, `Lightbox`, `Stepper`, `UploadZone`).

---

## 🔧 `lib/api.js` — Utilitaires partagés

| Export | Type | Usage |
|--------|------|-------|
| `fileToBase64(file)` | Async | Convertit un `File` → base64 JPEG (downscale longest edge ≤ 2048 px, qualité 0.85) — garantit < 4.5 MB Vercel |
| `compressBase64Image(b64, mime)` | Async | Recompresse une image base64 (utilisé pour réinjecter une variante générée dans une édition inline) |
| `downloadImage(b64, filename)` | Function | Trigger un download PNG depuis base64 |
| `generateImages({…})` | Async | Génération parallèle N variantes avec progressive loading. Accepte `{ prompt, images }` OU `{ parts }` (interleaved). Callback `onProgress(i, b64)` |
| `MODELS` | Const | `{ FLASH, PRO }` |
| `GENERATION_TIMEOUT_MS` | Const | 90 000 ms (override possible) |

---

## 🔧 `lib/prompts.js` — Tous les prompts

Tous les prompts sont assemblés à partir de **blocs partagés** :
- `CRITICAL_RULES` — préservation non-négociable (hardware, fond #FFFFFF…)
- `PRESERVE_RULES` — forme, matériaux non-tissu, lumière
- `OUTPUT_QUALITY` — packshot studio fond blanc
- `BRAND_BRIEF` — identité Noukies (palette pastels, lumière douce, Bonpoint/Petit Bateau)
- `BABY_REALISM_RULES` — anti uncanny-valley (mains 5 doigts, peau, yeux…)
- `BABY_AGE_PROPS` — descriptions par âge (0-3 mois / 6-12 mois / 2-3 ans)
- `withNotes(notes)` — injection conditionnelle des notes produit

| Clé `PROMPTS` | Outil | Particularité |
|---------------|-------|---------------|
| `applyPattern` | pattern | Template avec `{PRODUCT_NOTES}` remplacé dynamiquement |
| `solidColor(hex, name, notes)` | couleur (picker) | Builder hex + nom couleur |
| `applyTexture(notes)` | couleur (texture) | Reproduit couleur ET texture physique |
| `applyEmbroidery(placement, notes)` | broderie | Rendu cousu, pas imprimé |
| `sketchToPackshot(notes)` | creation/sketch | Lit le **manifeste d'images** (Image Manifest pattern) |
| `product3D(notes)` | creation/produit | Flat-lay forcé (pas inflated/worn) |
| `pliage(garmentCount, notes)` | pliage | Injecte `EXACTLY N garments` — court (~20 lignes) |
| `roomScene(productCount, mood, notes)` | ambiance/room-scene | `BRAND_BRIEF` + multi-produits |
| `nurseryScene(placement, mood, notes)` | ambiance | Chambre sans bébé |
| `babyScene(babyAge, mood, notes)` | ambiance | `BABY_REALISM_RULES` + `BABY_AGE_PROPS` + scene presets par âge |
| `outdoorScene(sceneType, mood, notes)` | ambiance | 3 settings : garden, park-walk, morning-terrace |
| `ambianceCustom(userPrompt)` | ambiance | Wrappe prompt utilisateur + BRAND_BRIEF + fidélité produit |
| `alternateAngle(angleType, detailFocus, notes, refDescriptions)` | angles | Role assignment identity vs structure |
| `whiteBg`, `chromaKeyBg(hex, name)` | ExportPanel | Régénération fond blanc / chroma key |

`SCENE_LABELS` est aussi exporté pour l'UI ambiance.

---

## 🔧 `lib/interleaved.js` — Image Manifest pattern

Solution anti-hallucination pour les outils multi-images aux rôles diverses (creation/sketch, pliage, ambiance/room-scene).

| Export | Rôle |
|--------|------|
| `IMAGE_ROLES` | 13 rôles standardisés : `product`, `sketch`, `structure`, `pattern`, `fabric`, `embroidery`, `scene`, `style`, `photo`, `technical`, `arrangement`, `garment`, `existingProduct`, `roomProduct`. Chaque rôle a `label`, `labelEn`, `extract`, `ignore`. |
| `buildManifest(inputs)` | Génère le bloc texte "IMAGE MANIFEST — You will receive N images…" listant ordre / rôle / extract / ignore |
| `buildInterleavedParts(inputs, instruction)` | Construit `[manifest, label, image, label, image, …, instruction]` pour l'API — **utilisé en prod** par pliage, creation/sketch, ambiance/room-scene, ambiance/products-in-scene |
| `buildLegacyPayload(inputs, instruction)` | Fallback `{ prompt, images }` — manifeste injecté dans le prompt, images en array plat. Conservé pour A/B testing éventuel, plus utilisé par défaut |

Cf. `lib/PROMPT_GUIDELINES.md` section 2.7 pour la motivation.

---

## 🔧 `hooks/useGenerationPage.js` — État partagé (~70 % de chaque page)

Gère : produit upload (preview + dimensions), variantCount/resolution/aspectRatio, presets, productNotes, generatedImages + imageDims, selectedImages, lightboxIdx, édition inline (`editingIdx`/`editPrompt`/`editLoading`), `runGenerate()` (legacy : prompt + files), `runGenerateParts()` (interleaved : parts array déjà encodé en base64), `handleEditImage()` (utilise compressBase64Image + Pro par défaut), `toggleSelect`, `toggleSelectAll`, `resetGeneration`.

Presets exportés via `GENERATION_PRESETS` :

| Clé | Résolution | Ratio | Export size |
|-----|------------|-------|-------------|
| `noukies-packshot` | 2K | 4:5 | 1560×2000 (downscale only) |

Tweakable via `useGenerationPage({ defaultVariantCount, defaultResolution, defaultAspectRatio })`. ProduitTab utilise `defaultVariantCount: 2` car la 3D est lente.

---

## 🔧 `hooks/useExportPipeline.js` — Pipeline d'export complet

État : `bgMode` (original/white/transparent), `chromaColor` (green/magenta/blue), caches `greenScreenImages` + `detouredImages`, `exportSize`, `refLightboxSrc`.

Méthodes :
- `generateGreenScreen(idx)` — appelle `/api/generate` avec `PROMPTS.whiteBg` ou `chromaKeyBg`
- `generateAllGreenScreens()` — boucle séquentielle sur sélection (ou toutes)
- `getExportImages(indices)` — applique mode bg + resize éventuel, retourne `[{b64, index}]`
- `handleExport()` — download PNG individuel (espacement 300ms)
- `handleExportJPG()` — appel `/api/export` → JPG fond blanc + resize optionnel
- `handleExportPDF()` — jspdf, 1 image / page A4 portrait, centrée
- `getFileName(idx, ext)` — `packshot_{n}_{WxH}{_white_background|_transparent}.png`

---

## 🔌 API Routes

### `POST /api/generate`
- Proxy OpenRouter (`openrouter.ai/api/v1/chat/completions`)
- Body : **2 formats supportés**
  - Interleaved : `{ parts: [{type:"text",text},{type:"image",data}, …], model?, resolution?, aspectRatio? }`
  - Legacy : `{ prompt, images: b64[], model?, resolution?, aspectRatio? }`
- Modèles whitelistés : `google/gemini-3.1-flash-image-preview` (FLASH), `google/gemini-3-pro-image-preview` (PRO)
- `resolution` ∈ `{0.5K, 1K, 2K, 4K}` (default 2K)
- `aspectRatio` ∈ `{1:1, 4:3, 3:4, 16:9, 9:16, 2:3, 3:2, 4:5, 5:4}` (default 1:1)
- Timeout serveur : 120s — Retourne `{ status: "success", image: b64 }` ou `{ status: "error", error }`
- **Logging** : append-only dans `generations.log` (timestamp / model / res / ratio / size KB)

### `POST /api/tile`
- FormData : `file`, `density` (1-20), `canvasWidth`, `canvasHeight`
- Sharp : resize uniforme du tile (pas de distorsion) → composite sur canvas oversized → crop aux dimensions cibles
- Retourne le PNG en blob + headers `X-Canvas-*` / `X-Tile-*` / `X-Grid` / `X-Tiles`

### `POST /api/export`
- Body : `{ images: b64[], format?: "WxH", background?: "white"|"transparent", output?: "png"|"jpg" }`
- Sharp resize `fit: cover, position: centre` + flatten white si nécessaire
- Retourne `{ results: b64[], format, output, count }`

### `POST /api/chromakey`
- Body : `{ image: b64, color?: "green"|"magenta"|"blue", tolerance?: number (10-200, default 100) }`
- Distance euclidienne + soft edge anti-aliasé + **despill** (capping du canal saturé)
- Retourne `{ result: b64 PNG avec alpha }`

### `POST /api/auth`
- Body : `{ password }` — compare avec `SITE_PASSWORD`
- Si OK : set cookie `packshot-auth=authenticated` (httpOnly, sameSite=lax, 30 jours)
- Réponse `{ success: true }` ou 401 `{ success: false, error }`

### Middleware `proxy.js`
- Gate toutes les routes sauf `/login`, `/api/auth`, `/_next/*`, `/favicon*`
- Vérifie le cookie → sinon redirect `/login`

---

## 🌐 Environnement

```env
# .env.local
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-3-pro-image-preview   # défaut quand le client n'envoie pas de model
SITE_PASSWORD=...                                    # gate du middleware proxy.js
```

```bash
npm run dev      # Dev server (port 3000)
npm run build    # Build production
npm run start    # Production server
```

Dépendances clés (cf. `package.json`) : `next@16.1.6`, `react@19.2.3`, `sharp@0.34.5`, `jspdf@4.2`, `jszip@3.10`, `lucide-react@0.576`, `radix-ui@1.4`, `tailwindcss@4.2`.

---

## 🎨 Identité Noukies (rappel)

- **Palette pastels** : cream `#F5F0E8`, powder pink `#F0D4D8`, sage `#B5C9A8`, warm grey `#C4BAB0`, lavender `#D4C8E0`, sky blue `#BDD5E8`
- **Lumière** : diffusée douce, ton chaud (golden hour léger)
- **Style** : éditorial Bonpoint / Petit Bateau
- **Matières** : coton organique, jersey, velours plush — jamais synthétique
- **Forbidden** : couleurs saturées/néon, contraste fort, ambiance sombre
- **Logo header** : `noukies` en bleu `#2d4a9e`, font Outfit

Tous les prompts lifestyle injectent `BRAND_BRIEF`. Les packshots gardent fond pur `#FFFFFF`.

---

## 📝 Changelog résumé (depuis 04/03/2026)

- **Refactoring massif** : extraction de 2 hooks (`useGenerationPage`, `useExportPipeline`) + 4 composants partagés (`GenerationControls`, `ImageGrid`, `ExportPanel`, `Lightbox`). Les pages ne contiennent plus que leur état spécifique.
- **Image Manifest pattern** (`lib/interleaved.js`) — 13 rôles standardisés + manifeste anti-cross-contamination pour les outils multi-images.
- **API `/api/generate` polyglotte** : supporte `parts` (interleaved) en plus du legacy `prompt+images`.
- **Auth password** : middleware `proxy.js` + cookie 30j + page `/login` + `/api/auth`.
- **Nouveaux outils** : `broderie`, `pliage`, `creation` (2 onglets), `labo`, `ambiance/room-scene`.
- **Export** : 3 modes fond (original / blanc IA / transparent par chroma key), 3 couleurs clé (vert/magenta/bleu), output PNG/JPG/PDF, 4 tailles de resize (1024², 1560×2000, 2048², 4096²).
- **Despill** chroma key dans `/api/chromakey` pour propreté des bords.
- **Logging persistant** : `generations.log` append-only à chaque génération.
- **Compression source** : `compressBase64Image` pour réinjecter une variante générée dans une édition inline sans dépasser 4.5 MB Vercel.
- **Presets de génération** : `noukies-packshot` (2K 4:5 → 1560×2000) — toggle 1 clic dans `GenerationControls`.
- **Notes produit** : injection conditionnelle via `withNotes(notes)` dans tous les builders.
- **Tiling** : densité étendue à 1-20, scaling uniforme + crop final aux dimensions exactes du produit.
- **Anti-uncanny-valley** : `BABY_REALISM_RULES` + `BABY_AGE_PROPS` (3 âges) dans `babyScene`.
- **Migration interleaved (25/05/2026)** : `runGenerateParts()` ajouté dans `useGenerationPage`. Les 4 outils multi-rôles (pliage, creation/sketch, ambiance/room-scene, ambiance/products-in-scene) passent désormais par `buildInterleavedParts` au lieu de `buildLegacyPayload` — chaque image arrive précédée de son étiquette de rôle dans le content array, moins d'ambiguïté ordinale.
- **Refonte `sketchToPackshot` (25/05/2026)** : prompt raccourci ~47→~25 lignes selon le pattern qui marche (pliage). Instruction en tête porte la fidélité (`"preserving the reference EXACTLY as photographed"`). Ajout d'une **OCCLUSION RULE** : éléments cachés/repliés/de dos restent ainsi dans l'output, jamais reconstruits. Ajout d'une **hiérarchie base/référence** explicite : la base reste source de vérité, les références complémentaires enrichissent les détails mais n'overrident jamais sauf si les notes le demandent.
- **UI Références complémentaires** (`/creation` tab croquis) : ancien rôle `existingProduct` renommé en "Référence complémentaire". 3 chips de type ajoutés (Détail à préserver / Angle non visible / Texture & Matière) qui pré-remplissent le placeholder du champ description. Couvre désormais explicitement les cas "tête de peluche cachée → upload photo de face".

---

## 🚧 Feature flags (preview features)

Deux flags d'env contrôlent l'affichage de features en cours de validation :

| Flag | Effet quand `=true` | Quand activer |
|------|---------------------|---------------|
| `NEXT_PUBLIC_ENABLE_REFORMULATE` | Affiche le bouton ✨ Reformuler au-dessus de tous les champs `Reformulable*` | Quand la reformulation Sonnet 4.6 est validée |
| `NEXT_PUBLIC_ENABLE_PREVIEW_AGENTS` | Affiche les onglets *Créer une scène* (Agent A1 — scene-builder) et *Produits dans scène* (Agent A2 — products-in-scene) dans le sub-nav `/ambiance` | Quand les 2 agents sont validés |

Routes `/ambiance/scene-builder` et `/ambiance/products-in-scene` accessibles par URL directe même sans flag (utile pour tester). `/api/reformulate` accessible aussi (mais sans bouton client pour l'invoquer si flag off). Quand on veut livrer ces features, on flippe les flags dans Vercel env vars.

---

## 🎯 Backlog refacto prompts §14 (marge de manœuvre)

9 prompts n'ont **pas encore** reçu la refacto §14 (énumération exhaustive `PRESERVE EXACTLY` + anchors validés `Maintain exact product proportions...` + `Sharp focus on material texture...`). Tous fonctionnent en l'état actuel — c'est explicitement de la **marge d'amélioration** disponible si un client remonte une régression de fidélité sur un de ces outils.

**Règle quand un client signale un bug de fidélité sur un de ces outils** : consulter cette table AVANT d'investiguer un bug technique — la refacto §14 peut suffire à résoudre.

| Prompt | Outil | Refacto §14 utile si… | Gain attendu |
|---|---|---|---|
| `alternateAngle` | `/angles` (caché homepage) | Réactivation de l'outil ; hallucinations sur les détails entre angles | `PRESERVE EXACTLY` par image de réf + anchors §14.4 |
| `nurseryScene` | `/ambiance` (nursery sans bébé) | Le produit dérive dans la scène (couleur/forme/hardware légèrement altérés) | Bloc `PRESERVE EXACTLY` produit en plus du `BRAND_BRIEF` |
| `babyScene` | `/ambiance` (avec bébé) | Uncanny valley persistant malgré `BABY_REALISM_RULES`, ou produit qui dérive | Anchors §14.4 + énumération produit explicite |
| `outdoorScene` | `/ambiance` (extérieur) | Produit dérive dans la scène extérieure | Idem nurseryScene |
| `ambianceCustom` | `/ambiance` (prompt libre) | Le produit « fond » dans la scène, perd identité | Bloc `PRESERVE EXACTLY` autour du wrapper utilisateur |
| `product3D` | `/creation` tab 3D Produit | Détails du tissu ou de la fiche technique mal reproduits | Anchors §14.4 + énumération hardware sur la fiche technique |
| `roomScene` | `/ambiance/room-scene` | Un ou plusieurs produits dérivent ou hallucinent dans la chambre | `PRESERVE EXACTLY` PAR produit (énumération individuelle) |
| `sceneFromReference` | `/ambiance/scene-builder` (caché par flag) | Régen de scène casse la géométrie de la réf | Refacto §14 à faire AVANT d'activer le flag preview-agents |
| `productsInScene` | `/ambiance/products-in-scene` (caché par flag) | Produits pas fidèles dans la scène inspirée | Refacto §14 à faire AVANT d'activer le flag preview-agents |

**Méthode de refacto (à appliquer SI un client remonte un problème) :**
1. Lire `lib/PROMPT_GUIDELINES.md` §14 (obligatoire — sauvegardé en mémoire auto comme règle dure)
2. Appliquer le pattern qu'on a déjà validé sur 6 autres prompts : `PRESERVE EXACTLY:` (énumération exhaustive de tout ce qui doit rester intact) + `DO NOT:` (négations explicites) + les 2 anchors §14.4 placés dans le bloc d'application mode-spécifique
3. **Mesurer avant/après sur ≥8 générations** d'un cas hard avant de committer — la session précédente nous a appris que 3/8 vs 4/8 est dans le bruit, il faut un signal franc
4. Un commit séparé par prompt pour limiter le blast radius si régression

**Prompts déjà refactorisés en §14 (2026-05-25)** pour mémoire : `applyPattern`, `solidColor`, `applyTexture`, `applyEmbroidery`, `sketchToPackshot`, `pliage`. Plus le wrapper anti-drift `handleEditImage` (§14.6) sur toutes les éditions inline.

---

## ⚠️ Limites connues / TODO

1. **`/angles` masqué** — code conservé, retiré de la homepage et de la NavLinks à la demande du client. À ré-activer en décommentant `MODES[]` dans `app/page.js` et `NAV_LINKS[]` dans `components/NavLinks.jsx`.
2. **Tiling pattern** — débordement possible du motif sur le fond pour produits clairs sur fond blanc. Mitigation documentée dans le `<details>` UI de `/pattern` : générer plusieurs variantes et utiliser le mode "Fond blanc" à l'export.
3. **Pas de gestion de file** — chaque outil régénère à zéro. Pas de queue, pas de batch, pas d'historique persistant côté UI (seulement `generations.log` côté serveur).
4. **`SITE_PASSWORD` en clair dans `.env.local`** — acceptable pour un outil interne, à durcir si jamais ouvert à plus d'utilisateurs.
5. **Test pixel-perfect avec ref complémentaire** — en attente : valider sur le cas du doudou raton (base smartphone + 2e ref de la tête de face + notes demandant la tête visible) que le combo flow donne 7-8/8. Photos de détails attendues côté client.
