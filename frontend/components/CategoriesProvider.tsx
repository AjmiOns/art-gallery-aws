'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Category, FALLBACK_CATEGORIES } from '@/lib/categories';

type CategoriesState = {
  categories: Category[];
  categoryOf: (tags: string[]) => Category;
  refresh: () => void;
};

const CategoriesContext = createContext<CategoriesState>({
  categories: FALLBACK_CATEGORIES,
  categoryOf: () => FALLBACK_CATEGORIES[0],
  refresh: () => {},
});

export function CategoriesProvider({ children }: { children: React.ReactNode }) {
  const [categories, setCategories] = useState<Category[]>(FALLBACK_CATEGORIES);

  const refresh = useCallback(() => {
    api.listCategories().then((list) => list.length && setCategories(list)).catch(() => {});
  }, []);
  useEffect(refresh, [refresh]);

  const value = useMemo<CategoriesState>(
    () => ({
      categories,
      refresh,
      // La catégorie principale d'une œuvre est son premier tag reconnu.
      categoryOf: (tags) => {
        for (const t of tags) {
          const found = categories.find((c) => c.slug === t);
          if (found) return found;
        }
        return { id: 'other', slug: 'other', label: 'Autres', tagline: '', tone: 'lavender', sortOrder: 999, isActive: true };
      },
    }),
    [categories, refresh],
  );
  return <CategoriesContext.Provider value={value}>{children}</CategoriesContext.Provider>;
}

export const useCategories = () => useContext(CategoriesContext);
