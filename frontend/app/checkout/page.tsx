'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, Order, PaymentConfig } from '@/lib/api';
import { formatPrice, formatTime } from '@/lib/format';
import ArtImage from '@/components/ArtImage';
import { useAuth } from '@/components/AuthProvider';
import CardFields, { EMPTY_CARD } from '@/components/CardFields';
import { useI18n } from '@/components/LanguageProvider';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

function Success({ order }: { order: Order }) {
  const { t } = useI18n();
  const p = order.payment;
  return (
    <div className="page page--narrow">
      <div className="panel receipt">
        <div className="receipt__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h1>{t('Paiement confirmé')}</h1>
        <p className="muted">{t('Merci ! « {title} » est maintenant à vous.', { title: order.artwork.title })}</p>
        <dl className="receipt__rows">
          <div><dt>{t('Œuvre')}</dt><dd>{order.artwork.title}</dd></div>
          <div><dt>{t('Artiste')}</dt><dd>{order.seller.username}</dd></div>
          <div><dt>{t('Montant')}</dt><dd>{formatPrice(order.amount, p?.currency)}</dd></div>
          {p?.cardLast4 && <div><dt>{t('Carte')}</dt><dd>{p.cardBrand} •••• {p.cardLast4}</dd></div>}
          {p && <div><dt>{t('Référence')}</dt><dd>{p.id.slice(0, 8).toUpperCase()}</dd></div>}
          {order.paidAt && <div><dt>{t('Date')}</dt><dd>{formatTime(order.paidAt)}</dd></div>}
        </dl>
        <div className="row-actions row-actions--center">
          <Link href="/orders" className="btn btn--primary">{t('Mes achats')}</Link>
          <Link href={`/messages?to=${order.seller.id}&artwork=${order.artwork.id}`} className="btn btn--soft">{t("Contacter l'artiste")}</Link>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>{t('Imprimer le reçu')}</button>
        </div>
      </div>
    </div>
  );
}

function Checkout() {
  const params = useSearchParams();
  const orderId = params.get('order');
  const sessionId = params.get('session_id');
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [order, setOrder] = useState<Order | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState(EMPTY_CARD);

  const load = useCallback(async () => {
    if (!token || !orderId) return;
    try {
      const [o, c] = await Promise.all([api.getOrder(orderId, token), api.paymentConfig()]);
      setOrder(o);
      setConfig(c);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, orderId]);
  useEffect(() => { load(); }, [load]);

  // Retour de Stripe Checkout : l'API interroge Stripe pour confirmer le paiement.
  useEffect(() => {
    if (!token || !sessionId) return;
    api.confirmStripe(sessionId, token).then(() => load()).catch((e: Error) => setError(e.message));
  }, [token, sessionId, load]);

  async function payMock(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !orderId) return;
    setError('');
    setBusy(true);
    try {
      const { paymentId } = await api.checkout(orderId, token);
      await api.confirmMock({ paymentId, ...card }, token);
      toast.show(t('Paiement accepté.'));
      await load();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function payStripe() {
    if (!token || !orderId) return;
    setError('');
    setBusy(true);
    try {
      const res = await api.checkout(orderId, token);
      if (res.url) window.location.href = res.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  if (!orderId) return <div className="page page--narrow"><div className="state"><p>{t('Aucune commande à payer.')}</p><Link href="/orders" className="btn btn--soft btn--sm">{t('Mes achats')}</Link></div></div>;
  if (!order) return <div className="page page--narrow">{error ? <p className="form-error" role="alert">{error}</p> : <p className="muted">{t('Chargement…')}</p>}</div>;
  if (order.status === 'paid') return <Success order={order} />;

  const payable = order.status === 'accepted';
  return (
    <div className="page page--wide">
      <header className="page-head"><div><h1>{t('Paiement')}</h1><p className="muted">{t('Finalisez votre achat en toute sécurité.')}</p></div></header>
      {params.get('cancelled') && <p className="notice notice--warn">{t('Paiement annulé. Vous pouvez réessayer quand vous voulez.')}</p>}

      <div className="checkout">
        <aside className="panel summary">
          <h2>{t('Récapitulatif')}</h2>
          <div className="summary__art"><ArtImage src={order.artwork.imageUrl} alt={order.artwork.title} eager /></div>
          <h3>{order.artwork.title}</h3>
          <p className="muted">{t('par {name}', { name: order.seller.username })}</p>
          <div className="summary__total"><span>{t('Total')}</span><strong>{formatPrice(order.amount, config?.currency)}</strong></div>
          {config?.provider === 'stripe' && config.currency.toUpperCase() !== 'TND' && <small className="muted">{t('Montant débité en {currency} en mode test (Stripe ne gère pas le TND).', { currency: config.currency.toUpperCase() })}</small>}
        </aside>

        <section className="panel pay">
          {!payable ? (
            <div className="state state--plain">
              <p>
                {order.status === 'pending' ? t("Cette demande attend encore la validation de l'artiste.") : order.status === 'rejected' ? t("L'artiste a refusé cette demande.") : t('Cette commande a été annulée.')}
              </p>
              <Link href="/orders" className="btn btn--soft btn--sm">{t('Retour à mes achats')}</Link>
            </div>
          ) : config?.provider === 'stripe' ? (
            <div className="form-stack">
              <h2>{t('Payer avec Stripe')}</h2>
              <p className="muted">{t('Vous allez être redirigé vers la page de paiement sécurisée de Stripe (mode test).')}</p>
              <div className="notice">{t('Carte de test :')} <strong>4242 4242 4242 4242</strong>{t(', date future, CVC au choix.')}</div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="button" className="btn btn--primary btn--lg" onClick={payStripe} disabled={busy}>{busy ? t('Redirection…') : t('Payer {amount}', { amount: formatPrice(order.amount, config.currency) })}</button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={payMock}>
              <h2>{t('Paiement par carte')}</h2>
              <div className="notice">
                <strong>{t('Mode démonstration')}</strong>{t(' : aucun débit réel. Carte valide :')} <code>4242 4242 4242 4242</code>{t('. Carte refusée :')} <code>4000 0000 0000 0002</code>{t('. Date future et CVC au choix.')}
              </div>
              <CardFields value={card} onChange={setCard} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                {busy ? t('Vérification auprès de la banque…') : t('Payer {amount}', { amount: formatPrice(order.amount, config?.currency) })}
              </button>
              <p className="secure-note">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                {t('Seuls les 4 derniers chiffres de votre carte sont conservés.')}
              </p>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <RequireRole roles={['buyer', 'artist']}>
      <Suspense fallback={null}>
        <Checkout />
      </Suspense>
    </RequireRole>
  );
}
