export type Category = {
  id: string;
  slug: string;
  label: string;
  tagline: string;
  tone: string;
  sortOrder: number;
  isActive: boolean;
};

export const TONES = ['peach', 'mint', 'lavender', 'sky', 'pink', 'butter'] as const;

// Affichées tant que l'API n'a pas répondu (ou si elle est injoignable).
export const FALLBACK_CATEGORIES: Category[] = [
  { id: 'painting', slug: 'painting', label: 'Peintures', tagline: 'Huile, acrylique, couteau et pouring', tone: 'peach', sortOrder: 0, isActive: true },
  { id: 'wall-art', slug: 'wall-art', label: 'Décoration murale', tagline: 'Affiches et compositions pour vos murs', tone: 'mint', sortOrder: 1, isActive: true },
  { id: 'digital', slug: 'digital', label: 'Art numérique', tagline: 'Créations génératives et illustrations', tone: 'lavender', sortOrder: 2, isActive: true },
  { id: 'sketch', slug: 'sketch', label: 'Croquis', tagline: 'Graphite, études et dessins botaniques', tone: 'sky', sortOrder: 3, isActive: true },
];

// Catégories d'origine : seules à disposer d'une bibliothèque d'images intégrée.
export const BUILTIN_LIBRARY = ['painting', 'wall-art', 'digital', 'sketch'];
