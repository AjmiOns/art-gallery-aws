import type { Artwork } from '@/lib/api';
import { categoryOf } from '@/lib/categories';
import { formatPrice } from '@/lib/format';
import ArtImage from './ArtImage';
import Avatar from './Avatar';

export default function ArtworkCard({ artwork, onOpen }: { artwork: Artwork; onOpen: (a: Artwork) => void }) {
  const cat = categoryOf(artwork.tags);
  const artist = artwork.owner?.username ?? 'Artiste';
  const sold = artwork.status === 'sold';
  return (
    <button
      type="button"
      className={`card${sold ? ' card--sold' : ''}`}
      data-cat={cat.slug}
      onClick={() => onOpen(artwork)}
      aria-label={`${artwork.title}, par ${artist}, ${formatPrice(artwork.price)}${sold ? ', vendue' : ''}`}
    >
      <span className="card__media">
        <ArtImage src={artwork.imageUrl} alt="" />
        <span className="pill">{cat.label}</span>
        {sold && <span className="badge-sold">Vendue</span>}
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
