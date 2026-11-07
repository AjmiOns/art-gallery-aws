'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, Artwork, Order } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/format';
import ArtImage from './ArtImage';
import Avatar from './Avatar';
import PlanBadge from './PlanBadge';
import { useAuth } from './AuthProvider';
import { useCategories } from './CategoriesProvider';
import { useI18n } from './LanguageProvider';
import { useToast } from './Toast';

type Props = { artwork: Artwork | null; onClose: () => void };

export default function ArtworkDialog({ artwork, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const { user, token } = useAuth();
  const { categoryOf } = useCategories();
  const toast = useToast();
  const { t } = useI18n();
  const [myOrder, setMyOrder] = useState<Order | null>(null);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (artwork && !dialog.open) dialog.showModal();
    if (!artwork && dialog.open) dialog.close();
    setAsking(false);
    setNote('');
    setError('');
  }, [artwork]);

  // Demande en cours de l'utilisateur pour cette œuvre (en attente ou acceptée)
  const loadOrder = useCallback(async () => {
    if (!artwork || !token || user?.role === 'admin') return setMyOrder(null);
    try {
      const orders = await api.boughtOrders(token);
      setMyOrder(orders.find((o) => o.artwork.id === artwork.id && (o.status === 'pending' || o.status === 'accepted')) ?? null);
    } catch {
      setMyOrder(null);
    }
  }, [artwork, token, user?.role]);
  useEffect(() => {
    setMyOrder(null);
    loadOrder();
  }, [loadOrder]);

  async function sendRequest() {
    if (!artwork || !token) return;
    setBusy(true);
    setError('');
    try {
      await api.requestPurchase(artwork.id, note, token);
      toast.show(t("Demande envoyée. L'artiste doit maintenant la valider."));
      setAsking(false);
      await loadOrder();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function cancelRequest() {
    if (!myOrder || !token) return;
    setBusy(true);
    try {
      await api.orderAction(myOrder.id, 'cancel', token);
      toast.show(t('Demande annulée.'));
      await loadOrder();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const cat = artwork ? categoryOf(artwork.tags) : null;
  const mine = !!artwork && user?.id === artwork.ownerId;
  const contactHref = artwork ? `/messages?to=${artwork.ownerId}&artwork=${artwork.id}` : '#';

  return (
    <dialog
      ref={ref}
      className="dialog"
      aria-label={artwork?.title ?? t('Détail de l’œuvre')}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      {artwork && cat && (
        <div className="dialog__body" data-tone={cat.tone}>
          <div className="dialog__media">
            <ArtImage src={artwork.imageUrl} alt={artwork.title} eager />
          </div>
          <div className="dialog__info">
            <button type="button" className="dialog__close" onClick={onClose} aria-label={t('Fermer')}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
            </button>
            <span className="pill pill--solid">{cat.label}</span>
            <h2>{artwork.title}</h2>
            <p className="dialog__artist">
              <Avatar name={artwork.owner?.username ?? t('Artiste')} size={32} />
              {artwork.owner?.username ?? t('Artiste')}
              <PlanBadge plan={artwork.owner?.plan} />
            </p>
            <p className="dialog__price">{formatPrice(artwork.price)}</p>
            <p className="dialog__date">{t('Mise en ligne le {date}', { date: formatDate(artwork.createdAt) })}</p>

            {error && <p className="form-error" role="alert">{error}</p>}

            <div className="dialog__actions">
              {artwork.status === 'sold' ? (
                <span className="badge-sold badge-sold--inline">{t('Cette œuvre est vendue')}</span>
              ) : mine ? (
                <span className="muted">{t("Vous êtes l'artiste de cette œuvre.")}</span>
              ) : !user ? (
                <>
                  <Link href="/login" className="btn btn--primary">{t('Se connecter pour acheter')}</Link>
                  <Link href="/register" className="btn btn--ghost">{t('Créer un compte')}</Link>
                </>
              ) : myOrder?.status === 'accepted' ? (
                <>
                  <p className="dialog__note dialog__note--ok">{t("L'artiste a accepté votre demande. Finalisez le paiement pour devenir propriétaire.")}</p>
                  <Link href={`/checkout?order=${myOrder.id}`} className="btn btn--primary">{t('Payer {amount}', { amount: formatPrice(myOrder.amount) })}</Link>
                  <button type="button" className="btn btn--ghost" onClick={cancelRequest} disabled={busy}>{t('Annuler')}</button>
                </>
              ) : myOrder?.status === 'pending' ? (
                <>
                  <p className="dialog__note">{t("Demande envoyée : en attente de la réponse de l'artiste.")}</p>
                  <button type="button" className="btn btn--soft" onClick={cancelRequest} disabled={busy}>{t('Annuler ma demande')}</button>
                </>
              ) : artwork.status === 'reserved' ? (
                <p className="dialog__note">{t('Cette œuvre est réservée par un autre acheteur.')}</p>
              ) : user.role === 'admin' ? (
                <p className="dialog__note">{t('Les administrateurs ne peuvent pas acheter.')}</p>
              ) : asking ? (
                <div className="ask">
                  <label className="field">
                    <span>{t("Message pour l'artiste (facultatif)")}</span>
                    <textarea rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('Une question, une précision de livraison…')} />
                  </label>
                  <div className="row-actions">
                    <button type="button" className="btn btn--primary" onClick={sendRequest} disabled={busy}>
                      {busy ? t('Envoi…') : t('Envoyer la demande')}
                    </button>
                    <button type="button" className="btn btn--ghost" onClick={() => setAsking(false)} disabled={busy}>{t('Annuler')}</button>
                  </div>
                </div>
              ) : (
                <>
                  <button type="button" className="btn btn--primary" onClick={() => setAsking(true)}>{t("Demander l'achat")}</button>
                  <p className="dialog__hint">{t("L'artiste valide votre demande, puis vous payez en ligne en toute sécurité.")}</p>
                </>
              )}

              {!mine && artwork.status !== 'sold' && user && (
                <Link href={contactHref} className="btn btn--soft">{t("Contacter l'artiste")}</Link>
              )}
            </div>
          </div>
        </div>
      )}
    </dialog>
  );
}
