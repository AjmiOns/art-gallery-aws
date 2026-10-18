'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { api, Artwork } from '@/lib/api';
import { categoryOf } from '@/lib/categories';
import { formatDate, formatPrice } from '@/lib/format';
import ArtImage from './ArtImage';
import Avatar from './Avatar';
import { useAuth } from './AuthProvider';
import { useToast } from './Toast';

type Props = { artwork: Artwork | null; onClose: () => void; onBought: () => void };

export default function ArtworkDialog({ artwork, onClose, onBought }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { session } = useAuth();
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (artwork && !dialog.open) dialog.showModal();
    if (!artwork && dialog.open) dialog.close();
    setConfirming(false);
    setError('');
  }, [artwork]);

  async function buy() {
    if (!session || !artwork) return;
    setBusy(true);
    setError('');
    try {
      await api.buy(artwork.id, session.accessToken);
      toast.show(`« ${artwork.title} » est maintenant à vous.`);
      onBought();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cat = artwork ? categoryOf(artwork.tags) : null;
  const sold = artwork?.status === 'sold';
  const mine = !!artwork && session?.user.id === artwork.ownerId;

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={artwork?.title ?? 'Détail de l’œuvre'}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {artwork && cat && (
        <div className="dialog__body" data-cat={cat.slug}>
          <div className="dialog__media">
            <ArtImage src={artwork.imageUrl} alt={artwork.title} eager />
          </div>
          <div className="dialog__info">
            <button type="button" className="dialog__close" onClick={onClose} aria-label="Fermer">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <span className="pill pill--solid">{cat.label}</span>
            <h2>{artwork.title}</h2>
            <p className="dialog__artist">
              <Avatar name={artwork.owner?.username ?? 'Artiste'} size={32} />
              {artwork.owner?.username ?? 'Artiste'}
            </p>
            <p className="dialog__price">{formatPrice(artwork.price)}</p>
            <p className="dialog__date">Mise en ligne le {formatDate(artwork.createdAt)}</p>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="dialog__actions">
              {sold ? (
                <span className="badge-sold badge-sold--inline">Cette œuvre est vendue</span>
              ) : mine ? (
                <span className="muted">Vous êtes l&apos;artiste de cette œuvre.</span>
              ) : !session ? (
                <Link href="/login" className="btn btn--primary">
                  Se connecter pour acheter
                </Link>
              ) : confirming ? (
                <>
                  <button type="button" className="btn btn--primary" onClick={buy} disabled={busy}>
                    {busy ? 'Achat en cours…' : `Confirmer l'achat, ${formatPrice(artwork.price)}`}
                  </button>
                  <button type="button" className="btn btn--ghost" onClick={() => setConfirming(false)} disabled={busy}>
                    Annuler
                  </button>
                </>
              ) : (
                <button type="button" className="btn btn--primary" onClick={() => setConfirming(true)}>
                  Acheter cette œuvre
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
