// Source unique des catégories : l'ordre ici est l'ordre d'affichage sur la page d'accueil.
export const CATEGORIES = [
  { id: 'painting', slug: 'painting', label: 'Peintures', tagline: 'Huile, acrylique, couteau et pouring' },
  { id: 'wall art', slug: 'wall-art', label: 'Décoration murale', tagline: 'Affiches et compositions pour vos murs' },
  { id: 'digital', slug: 'digital', label: 'Art numérique', tagline: 'Créations génératives et illustrations' },
  { id: 'sketch', slug: 'sketch', label: 'Croquis', tagline: 'Graphite, études et dessins botaniques' },
] as const;

export type Category = (typeof CATEGORIES)[number];
export type CategoryId = Category['id'];

// La catégorie principale d'une œuvre est son premier tag reconnu.
export function categoryOf(tags: string[]): Category {
  for (const tag of tags) {
    const found = CATEGORIES.find((c) => c.id === tag);
    if (found) return found;
  }
  return CATEGORIES[0];
}
