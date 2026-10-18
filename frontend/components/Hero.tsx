import Link from 'next/link';
import type { Artwork } from '@/lib/api';
import FeaturedSlider from './FeaturedSlider';

export default function Hero({ featured, onOpen }: { featured: Artwork[]; onOpen: (a: Artwork) => void }) {
  return (
    <section className="hero">
      <div className="hero__inner">
        <div className="hero__text">
          <h1>Des œuvres à accrocher, des artistes à découvrir.</h1>
          <p>
            Parcourez peintures, décoration murale, art numérique et croquis. Publiez vos propres créations et vendez-les en quelques clics.
          </p>
          <div className="hero__actions">
            <a href="#collections" className="btn btn--primary">
              Explorer les œuvres
            </a>
            <Link href="/sell" className="btn btn--soft">
              Vendre une œuvre
            </Link>
          </div>
        </div>
        <FeaturedSlider slides={featured} onOpen={onOpen} />
      </div>
    </section>
  );
}
