'use client';

import type { Artwork } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import ArtImage from './ArtImage';
import Avatar from './Avatar';
import { useCategories } from './CategoriesProvider';

export default function ArtworkCard({ artwork, onOpen }: { artwork: Artwork; onOpen: (a: Artwork) => void }) {
  const { categoryOf } = useCategories();
  const cat = categoryOf(artwork.tags);
  const artist = artwork.owner?.username ?? 'Artiste';
  const unavailable = artwork.status !== 'available';
  const badge = artwork.status === 'sold' ? 'Vendue' : artwork.status === 'reserved' ? 'Réservée' : null;
  return (
    <button
      type="button"
      className={`card${artwork.status === 'sold' ? ' card--sold' : ''}`}
      data-tone={cat.tone}
      onClick={() => onOpen(artwork)}
      aria-label={`${artwork.title}, par ${artist}, ${formatPrice(artwork.price)}${badge ? `, ${badge.toLowerCase()}` : ''}`}
    >
      <span className="card__media">
        <ArtImage src={artwork.imageUrl} alt="" />
        <span className="pill">{cat.label}</span>
        {unavailable && badge && <span className={`badge-sold${artwork.status === 'reserved' ? ' badge-sold--reserved' : ''}`}>{badge}</span>}
      </span>
      <span className="card__body">
        <span className="card__title">{artwork.title}</span>
        <span className="card__meta">
          <span className="card__artist">
            <Avatar name={artist} size={24} />
            {artist}
          </span>
          <span className="card__price">{formatPrice(artwork.price)}</span>
        </span>
      </span>
    </button>
  );
}
