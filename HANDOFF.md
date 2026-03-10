# Packshot Studio — État du projet

> **Date** : 4 mars 2026  
> **Stack** : Next.js 16 + React 19 + Tailwind 4 + shadcn/ui + sharp  
> **API** : OpenRouter (Gemini Flash + Pro image-preview)  
> **Repo** : `/home/pigbenis/projects/Noukies/packshot-studio`

---

## 🎯 Objectif

Application web interne pour **Noukies** (marque de puériculture). Permet de générer des packshots produits via IA à partir d'un produit photo + un motif/couleur/scène.

---

## 📁 Architecture

```
app/
├── page.js                   # Homepage — navigation vers les 4 outils
├── layout.js                 # Layout global (header Noukies, nav, theme)
├── globals.css               # Tailwind + design tokens
├── pattern/page.js           # ★ Outil principal — applique un motif tissu sur un produit
├── couleur/page.js           # Change la couleur du tissu d'un produit
├── ambiance/page.js          # Génère des mises en scène lifestyle
├── detourage/page.js         # Détourage (fond blanc ou transparent)
└── api/
    ├── generate/route.js     # Proxy OpenRouter — génère 1 image par appel
    ├── tile/route.js         # Tiling serveur (sharp) — crée un motif répété
    └── export/route.js       # Resize optionnel (sharp) avant téléchargement

components/
├── shared.jsx                # Stepper, UploadZone, ImageGrid — composants réutilisables
└── ui/                       # shadcn/ui (button, card, dialog, input, label, etc.)

lib/
├── api.js                    # ★ Utilitaires partagés : fileToBase64, downloadImage, generateImages, MODELS
├── config.js                 # Constantes (defaultCount, maxImageSize, acceptedTypes, getCanvasSize)
├── prompts.js                # Tous les prompts IA (pattern, couleur, ambiance, détourage, generateAngle)
└── utils.js                  # cn() — helper Tailwind merge
```

---

## 🔧 `lib/api.js` — Utilitaires partagés

Module centralisé importé par toutes les pages :

| Export | Type | Usage |
|--------|------|-------|
| `fileToBase64(file)` | Function | Convertit un `File` en base64 (sans préfixe data URI) |
| `downloadImage(b64, filename)` | Function | Télécharge une image base64 en PNG |
| `generateImages({...})` | Async Function | Génération parallèle de N variantes avec progressive loading |
| `MODELS` | Object | `{ FLASH, PRO }` — identifiants des modèles OpenRouter |
| `GENERATION_TIMEOUT_MS` | Constant | 90 000 ms timeout par requête |

`generateImages` accepte un callback `onProgress(index, image)` pour le progressive loading.

---

## 🔧 Page Pattern (`/pattern`) — la plus complexe

### Workflow en 5 étapes (Stepper)

| Étape | Nom | Description |
|-------|-----|-------------|
| 0 | **Produit** | Upload de la photo produit. Mesure auto des dimensions (px) |
| 1 | **Pattern** | Upload du motif tissu (seamless tile) |
| 2 | **Tiling** | Génère une grille du motif aux dimensions du produit via `/api/tile`. Slider **densité** (×1 à ×12) |
| 3 | **Génération** | Envoie produit + tiling à l'IA. Paramètres : variantes (1–10), résolution (1K/2K/4K), ratio, notes produit |
| 4 | **Export** | Lightbox zoom, sélection multi, resize optionnel, téléchargement |

### Fonctionnalités implémentées

- **Tiling sans distorsion** : Tiles scalées uniformément, canvas oversized croppé aux dimensions exactes
- **Densité** : Slider ×1–×12
- **Génération parallèle** : via `generateImages()` de `lib/api.js` avec progressive loading
- **Timeout** : 90s par requête client, 120s côté API
- **2 modèles** : Flash (rapide, par défaut) et Pro (qualité, via "Régénérer")
- **Lightbox full-screen** : 95vw×90vh, click/wheel zoom (100→500%), drag-to-pan
- **Notes produit** : Textarea → injecté dans le prompt via `{PRODUCT_NOTES}`
- **Édition par image** : Bouton ✏️ → input inline → envoi au Pro → résultat en nouvelle variante
- **Multi-sélection** : Checkboxes, tout sélectionner/désélectionner
- **Export** : Download individuel ou groupé, resize optionnel (1024², 2048², 4096²)

### State principal

```js
productFile, productPreview, productDims    // Image produit + dimensions mesurées
patternFile, patternPreview                 // Motif uploadé
density (number, défaut 4)                  // Slider densité (remplace l'ancien grid NxN)
tiledPreview                                // URL blob du résultat tiling
generatedImages (base64[])                  // Images générées
imageDims, selectedImages, lightboxIdx      // UI state
zoom, pan, isPanning, panStart              // Lightbox zoom/pan
productNotes (string)                       // Notes injectées dans le prompt
editingIdx, editPrompt, editLoading         // Édition inline par image
variantCount, resolution, aspectRatio       // Paramètres génération
exportSize                                  // Resize à l'export
```

---

## 🔌 API Routes

### `POST /api/generate`
- Proxy vers OpenRouter (`openrouter.ai/api/v1/chat/completions`)
- Body : `{ prompt, images: base64[], resolution?, aspectRatio?, model? }`
- Modèles whitelistés : `google/gemini-3.1-flash-image-preview`, `google/gemini-3-pro-image-preview`
- Retourne `{ status: "success", image: base64 }` ou `{ status: "error", error: string }`
- Logs console : `[generate] Calling OpenRouter...`, `[generate] Success — image size: XKB`

### `POST /api/tile`
- Body : FormData avec `file` (image), `density`, `canvasWidth`, `canvasHeight`
- Sharp : resize uniforme → composite sur canvas oversized → crop aux dimensions cibles
- Retourne le PNG en blob

### `POST /api/export`
- Body : `{ images: base64[], format: "2048x2048", background?: "white"|"transparent" }`
- Resize via sharp, retourne `{ results: base64[], format, count }`

---

## 📝 Prompts (`lib/prompts.js`)

| Clé | Usage | Particularité |
|-----|-------|--------------|
| `applyPattern` | Pattern → produit | Template avec `{PRODUCT_NOTES}` remplacé dynamiquement |
| `applyColor(color)` | Couleur → produit | Fonction avec paramètre couleur |
| `generateAngle(desc)` | Angle → variante | Fonction pour générer des vues alternatives (côté, dos, 3/4) |
| `ambiance.*` | 5 scènes lifestyle | baby_sitting, baby_sleeping, parent_carrying, nursery_decor, in_situation |
| `detourage.*` | Fond transparent/blanc | transparent, white |

---

## 🌐 Environnement

```env
# .env.local
OPENROUTER_API_KEY=sk-or-v1-...
OPENROUTER_MODEL=google/gemini-3-pro-image-preview
```

```bash
npm run dev    # Dev server (port 3000)
npm run build  # Build production
```

---

## ⚠️ Points d'attention

1. **Modèle "nano banana pro"** — le user a mentionné vouloir utiliser ce modèle pour l'édition d'images mais n'a pas confirmé le nom exact sur OpenRouter. Actuellement `handleEditImage` utilise `MODELS.PRO`.
2. **Pas de logging persistant** — les logs de génération sont en console uniquement. Le user souhaiterait tracker le nombre d'images générées.

---

## 🔜 Dernières modifications (session du 3-4 mars 2026)

1. ✅ **Rework tiling** : remplacement de la grille NxN par densité, scaling uniforme, crop
2. ✅ **Lightbox zoom** : full-screen, click/wheel zoom, drag-to-pan
3. ✅ **Fix zoom bug** : tracking distance drag pour éviter zoom au relâchement
4. ✅ **Notes produit** : textarea + injection dans prompt via `{PRODUCT_NOTES}`
5. ✅ **Édition par image** : bouton ✏️ → input inline → nouvelle variante via Pro
6. ✅ **Prompt enrichi** : `applyPattern` réécrit avec rules strictes
7. ✅ **Refactoring code** :
   - Création de `lib/api.js` (fileToBase64, downloadImage, generateImages, MODELS)
   - Suppression duplication `fileToBase64` dans 4 fichiers
   - Suppression `gridOptions` et `exportFormats` obsolètes de `config.js`
   - Ajout prompt `generateAngle` manquant dans `prompts.js` (fix bug couleur)
   - Refactoring des 4 pages pour utiliser les utilitaires partagés
   - Fix badge homepage (6→5 étapes pour Pattern)
