'use client';

import { CURRENCY } from '@/lib/api';
import { useCategories } from './CategoriesProvider';
import { useI18n } from './LanguageProvider';

export const MAX_PRICE = 1000;
export type SortKey = 'new' | 'asc' | 'desc';

type Props = {
  q: string;
  tag: string;
  maxPrice: number;
  sort: SortKey;
  onQ: (v: string) => void;
  onTag: (v: string) => void;
  onMaxPrice: (v: number) => void;
  onSort: (v: SortKey) => void;
};

export default function FilterBar({ q, tag, maxPrice, sort, onQ, onTag, onMaxPrice, onSort }: Props) {
  const { categories } = useCategories();
  const { t } = useI18n();
  return (
    <div className="filters" id="collections">
      <div className="filters__inner">
        <label className="search">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <span className="sr-only">{t('Rechercher une œuvre')}</span>
          <input type="search" value={q} onChange={(e) => onQ(e.target.value)} placeholder={t('Rechercher…')} />
        </label>

        <div className="chips" role="group" aria-label={t('Catégories')}>
          <button type="button" className={`chip${tag === '' ? ' is-active' : ''}`} aria-pressed={tag === ''} onClick={() => onTag('')}>
            {t('Toutes')}
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              data-tone={c.tone}
              className={`chip chip--cat${tag === c.slug ? ' is-active' : ''}`}
              aria-pressed={tag === c.slug}
              onClick={() => onTag(tag === c.slug ? '' : c.slug)}
            >
              {c.label}
            </button>
          ))}
        </div>

        <label className="range">
          <span>{maxPrice >= MAX_PRICE ? t('Tous les prix') : t("Jusqu'à {max} {currency}", { max: maxPrice, currency: CURRENCY })}</span>
          <input type="range" min={0} max={MAX_PRICE} step={10} value={maxPrice} onChange={(e) => onMaxPrice(Number(e.target.value))} aria-label={t('Prix maximum')} />
        </label>

        <label className="select">
          <span className="sr-only">{t('Trier par')}</span>
          <select value={sort} onChange={(e) => onSort(e.target.value as SortKey)}>
            <option value="new">{t('Nouveautés')}</option>
            <option value="asc">{t('Prix croissant')}</option>
            <option value="desc">{t('Prix décroissant')}</option>
          </select>
        </label>
      </div>
    </div>
  );
}
