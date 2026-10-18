'use client';

import { useState } from 'react';

// Image d'œuvre avec repli coloré si le fichier est introuvable.
export default function ArtImage({ src, alt, eager = false }: { src: string; alt: string; eager?: boolean }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <span className="art-fallback" role="img" aria-label={alt} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} onError={() => setFailed(true)} />;
}
