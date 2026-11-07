'use client';

import { useEffect, useState } from 'react';
import type { Artwork } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import ArtImage from './ArtImage';
import { useCategories } from './CategoriesProvider';
import { useI18n } from './LanguageProvider';

export default function FeaturedSlider({ slides, onOpen }: { slides: Artwork[]; onOpen: (a: Artwork) => void }) {
  const { categoryOf } = useCategories();
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides.length;

  useEffect(() => {
    if (count < 2 || paused) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), 6000);
    return () => clearInterval(timer);
  }, [count, paused]);

  useEffect(() => {
    if (index >= count) setIndex(0);
  }, [count, index]);

  if (count === 0) return <div className="slider slider--empty" aria-hidden="true" />;
  const go = (n: number) => setIndex((n + count) % count);

  return (
    <div
      className="slider"
      role="group"
      aria-roledescription={t('carrousel')}
      aria-label={t('Œuvres à la une')}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="slider__stage">
        {slides.map((a, i) => {
          const cat = categoryOf(a.tags);
          return (
            <div
              key={a.id}
              className={`slide${i === index ? ' is-active' : ''}`}
              data-tone={cat.tone}
              aria-hidden={i !== index}
              role="group"
              aria-roledescription={t('diapositive')}
              aria-label={t('{i} sur {n}', { i: i + 1, n: count })}
            >
              <button type="button" className="slide__frame" onClick={() => onOpen(a)} tabIndex={i === index ? 0 : -1} aria-label={t('Voir {title}', { title: a.title })}>
                <ArtImage src={a.imageUrl} alt="" eager={i === 0} />
              </button>
              <div className="slide__caption">
                <span className="pill pill--solid">{cat.label}</span>
                <strong>{a.title}</strong>
                <span>
                  {a.owner?.username} · {formatPrice(a.price)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="slider__controls">
        <button type="button" className="round" onClick={() => go(index - 1)} aria-label={t('Œuvre précédente')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
        </button>
        <div className="dots">
          {slides.map((a, i) => (
            <button key={a.id} type="button" className={i === index ? 'is-active' : ''} onClick={() => go(i)} aria-label={t("Afficher l'œuvre {n}", { n: i + 1 })} aria-current={i === index} />
          ))}
        </div>
        <button type="button" className="round" onClick={() => go(index + 1)} aria-label={t('Œuvre suivante')}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      </div>
    </div>
  );
}
