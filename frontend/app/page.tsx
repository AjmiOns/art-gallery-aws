'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Artwork } from '@/lib/api';
import { CATEGORIES, CategoryId, categoryOf } from '@/lib/categories';
import { useArtworks } from '@/lib/useArtworks';
import ArtworkCarousel from '@/components/ArtworkCarousel';
import ArtworkDialog from '@/components/ArtworkDialog';
import FilterBar, { MAX_PRICE, SortKey } from '@/components/FilterBar';
import Hero from '@/components/Hero';

function SkeletonShelf() {
  return (
    <section className="shelf" aria-hidden="true">
      <div className="skeleton skeleton--title" />
      <div className="track">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="skeleton skeleton--card" />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [q, setQ] = useState('');
  const [tag, setTag] = useState<CategoryId | ''>('');
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE);
  const [sort, setSort] = useState<SortKey>('new');
  const [selected, setSelected] = useState<Artwork | null>(null);
  const [featured, setFeatured] = useState<Artwork[]>([]);

  const filtersActive = q !== '' || tag !== '' || maxPrice < MAX_PRICE;
  const { data, loading, error, refetch } = useArtworks({
    q: q.trim(),
    tag,
    maxPrice: maxPrice < MAX_PRICE ? String(maxPrice) : '',
  });

  // La une : une œuvre disponible par catégorie, figée tant qu'aucun filtre n'est actif.
  useEffect(() => {
    if (filtersActive || data.length === 0) return;
    const picks = CATEGORIES.map((c) => data.find((a) => a.status === 'available' && categoryOf(a.tags).id === c.id)).filter(
      (a): a is Artwork => !!a,
    );
    setFeatured(picks);
  }, [data, filtersActive]);

  const shelves = useMemo(() => {
    const sorted = [...data];
    if (sort === 'asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'desc') sorted.sort((a, b) => b.price - a.price);
    return CATEGORIES.map((c) => ({ category: c, items: sorted.filter((a) => categoryOf(a.tags).id === c.id) })).filter(
      (s) => s.items.length > 0,
    );
  }, [data, sort]);

  const reset = () => {
    setQ('');
    setTag('');
    setMaxPrice(MAX_PRICE);
  };

  return (
    <>
      <Hero featured={featured} onOpen={setSelected} />
      <FilterBar q={q} tag={tag} maxPrice={maxPrice} sort={sort} onQ={setQ} onTag={setTag} onMaxPrice={setMaxPrice} onSort={setSort} />

      <div className="page" aria-busy={loading}>
        {error && (
          <div className="state state--error" role="alert">
            <p>{error}</p>
            <button type="button" className="btn btn--primary btn--sm" onClick={refetch}>
              Réessayer
            </button>
          </div>
        )}

        {loading && data.length === 0 && !error && (
          <>
            <SkeletonShelf />
            <SkeletonShelf />
          </>
        )}

        {!loading && !error && shelves.length === 0 && (
          <div className="state">
            <p>Aucune œuvre ne correspond à votre recherche.</p>
            {filtersActive && (
              <button type="button" className="btn btn--soft btn--sm" onClick={reset}>
                Effacer les filtres
              </button>
            )}
          </div>
        )}

        {shelves.map(({ category, items }) => (
          <ArtworkCarousel
            key={category.id}
            category={category}
            items={items}
            onOpen={setSelected}
            onSeeAll={() => setTag(category.id)}
            asGrid={tag !== ''}
          />
        ))}
      </div>

      <ArtworkDialog
        artwork={selected}
        onClose={() => setSelected(null)}
        onBought={() => {
          setSelected(null);
          refetch();
        }}
      />
    </>
  );
}
