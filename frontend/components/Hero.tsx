'use client';

import Link from 'next/link';
import type { Artwork } from '@/lib/api';
import FeaturedSlider from './FeaturedSlider';
import { useI18n } from './LanguageProvider';

export default function Hero({ featured, onOpen }: { featured: Artwork[]; onOpen: (a: Artwork) => void }) {
  const { t } = useI18n();
  return (
    <section className="hero">
      <div className="hero__inner">
        <div className="hero__text">
          <h1>{t('Des œuvres à accrocher, des artistes à découvrir.')}</h1>
          <p>{t('Parcourez peintures, décoration murale, art numérique et croquis. Publiez vos propres créations et vendez-les en quelques clics.')}</p>
          <div className="hero__actions">
            <a href="#collections" className="btn btn--primary">
              {t('Explorer les œuvres')}
            </a>
            <Link href="/sell" className="btn btn--soft">
              {t('Vendre une œuvre')}
            </Link>
          </div>
        </div>
        <FeaturedSlider slides={featured} onOpen={onOpen} />
      </div>
    </section>
  );
}
