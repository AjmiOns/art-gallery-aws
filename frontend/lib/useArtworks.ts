'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, Artwork, ArtworkFilters } from './api';

// Charge les œuvres selon les filtres (avec un léger délai pour ne pas appeler l'API à chaque frappe).
// Les données précédentes restent affichées pendant le rechargement : pas de clignotement.
export function useArtworks({ q, tag, maxPrice }: ArtworkFilters) {
  const [data, setData] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .listArtworks({ q, tag, maxPrice })
        .then((items) => {
          if (cancelled) return;
          setData(items);
          setError('');
        })
        .catch((e: Error) => {
          if (cancelled) return;
          setData([]);
          setError(e.message);
        })
        .finally(() => !cancelled && setLoading(false));
    }, 220);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q, tag, maxPrice, nonce]);

  const refetch = useCallback(() => setNonce((n) => n + 1), []);
  return { data, loading, error, refetch };
}
