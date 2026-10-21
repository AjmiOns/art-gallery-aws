'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Artwork } from '@/lib/api';
import type { Category } from '@/lib/categories';
import ArtworkCard from './ArtworkCard';

type Props = {
  category: Category;
  items: Artwork[];
  onOpen: (a: Artwork) => void;
  onSeeAll?: () => void;
  asGrid?: boolean;
};

export default function ArtworkCarousel({ category, items, onOpen, onSeeAll, asGrid = false }: Props) {
  const track = useRef<HTMLUListElement>(null);
  const [edge, setEdge] = useState({ start: true, end: false });

  const update = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdge({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 });
  }, []);

  useEffect(() => {
    if (asGrid) return;
    update();
    const el = track.current;
    el?.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      el?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [update, items.length, asGrid]);

  const scrollBy = (dir: 1 | -1) =>
    track.current?.scrollBy({ left: dir * track.current.clientWidth * 0.85, behavior: 'smooth' });

  return (
    <section className="shelf" data-tone={category.tone} aria-labelledby={`shelf-${category.slug}`}>
      <header className="shelf__head">
        <div>
          <h2 id={`shelf-${category.slug}`}>
            <span className="shelf__dot" aria-hidden="true" />
            {category.label}
            <span className="shelf__count">{items.length}</span>
          </h2>
          <p>{category.tagline}</p>
        </div>
        {!asGrid && (
          <div className="shelf__controls">
            {onSeeAll && (
              <button type="button" className="btn btn--ghost btn--sm" onClick={onSeeAll}>
                Voir tout
              </button>
            )}
            <button type="button" className="round" onClick={() => scrollBy(-1)} disabled={edge.start} aria-label={`${category.label} : précédent`}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <button type="button" className="round" onClick={() => scrollBy(1)} disabled={edge.end} aria-label={`${category.label} : suivant`}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
        )}
      </header>
      <ul ref={track} className={asGrid ? 'grid' : 'track'}>
        {items.map((a) => (
          <li key={a.id}>
            <ArtworkCard artwork={a} onOpen={onOpen} />
          </li>
        ))}
      </ul>
    </section>
  );
}
