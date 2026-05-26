/**
 * Documentation centralisée des outils du studio. Une entrée par outil/onglet.
 * Affichée via <ToolDoc tool="<key>" /> en haut de chaque page.
 *
 * Structure d'une entrée :
 *   {
 *     title:        string,    // optionnel — sinon dérive du titre de la page
 *     summary:      string,    // 1 phrase : à quoi ça sert
 *     useCases:     string[],  // 2-4 cas d'usage typiques
 *     requirements: string[],  // ce que le client doit avoir / fournir
 *     examples: [{
 *         title:    string,
 *         before:   { src, caption }?,  // image avant (optionnel)
 *         after:    { src, caption }?,  // image après (optionnel)
 *         steps:    string[],            // étapes numérotées
 *     }],
 *     pitfalls:     string[],  // pièges courants
 *     tips:         string[],  // conseils pour le meilleur résultat
 *   }
 *
 * Convention pour les images d'exemple :
 *   - À placer dans /public/examples/
 *   - Nommage : <toolKey>-<before|after>-<n>.jpg  (ex : creation-sketch-before-1.jpg)
 *   - Si le fichier n'existe pas, ToolDoc affiche un placeholder gracieux.
 */

export const TOOL_DOCS = {
    "creation-sketch": {
        title: "Produit → Packshot",
        summary:
            "Transformez une photo smartphone, un packshot existant ou un croquis en packshot professionnel sur fond blanc.",
        useCases: [
            "Vous avez une photo smartphone d'un produit, vous voulez un packshot e-commerce propre.",
            "Vous avez un packshot existant à refaire sous un autre angle ou avec un fond plus net.",
            "Vous partez d'un croquis de design et voulez le voir rendu en photo réaliste.",
        ],
        requirements: [
            "1 image de base : photo smartphone, packshot existant ou croquis.",
            "(optionnel) Références complémentaires : crops zoomés d'un détail, angle non visible, swatch matière.",
        ],
        examples: [
            {
                title: "Photo smartphone → packshot e-commerce",
                before: {
                    src: "/examples/creation-sketch-before-1.jpg",
                    caption: "Photo smartphone du doudou sur une surface peu nette",
                },
                after: {
                    src: "/examples/creation-sketch-after-1.jpg",
                    caption: "Packshot pro sur fond blanc, prêt e-commerce",
                },
                steps: [
                    "Uploadez la photo en « Base produit » (rôle photo détecté automatiquement).",
                    "Si un détail fin (étiquette, broderie) est flou : croppez-le depuis votre photo en zoom et uploadez-le en « Référence complémentaire — Détail à préserver ».",
                    "Notes produit : ajoutez seulement ce qui n'est PAS visible (ex : « le tissu blanc est en lin, pas en coton »).",
                    "Générez 4 variantes Flash (rapide), comparez, et utilisez « Modifier » pour affiner en Pro.",
                    "Exportez en 1560×2000 (preset Packshot 4:5) ou la taille de votre choix.",
                ],
            },
        ],
        pitfalls: [
            "Photo très floue ou mal cadrée → résultat limité. La qualité de l'output dépend de la qualité de l'input.",
            "Visage d'une peluche caché ou tourné → le modèle peut l'halluciner. Uploadez une 2e photo qui montre la face en « Référence complémentaire — Angle non visible ».",
            "Étiquettes CE / labels de marque qui s'inventent → croppez-les depuis votre photo de base en zoom et uploadez en « Détail à préserver ».",
        ],
        tips: [
            "Pour des détails fins, un crop zoomé depuis votre photo de base suffit — le modèle dédie plus d'attention à un élément zoomé qu'au même élément noyé dans une grande photo.",
            "Notes produit : ne répétez pas ce que la photo montre déjà. Le système supprime automatiquement les notes redondantes pour ne pas diluer les contraintes.",
            "Si une matière n'est pas reproduite correctement, essayez plutôt l'onglet « Croquis → Packshot » (fiche technique + swatch matière → flat-lay 3D).",
        ],
    },
};
