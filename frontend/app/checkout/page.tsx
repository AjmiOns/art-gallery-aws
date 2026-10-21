'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';
import { api, Order, PaymentConfig } from '@/lib/api';
import { formatPrice, formatTime } from '@/lib/format';
import ArtImage from '@/components/ArtImage';
import { useAuth } from '@/components/AuthProvider';
import CardPreview from '@/components/CardPreview';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

const groups4 = (v: string) => v.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim();
const expiryFmt = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
};

function Success({ order }: { order: Order }) {
  const p = order.payment;
  return (
    <div className="page page--narrow">
      <div className="panel receipt">
        <div className="receipt__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h1>Paiement confirmé</h1>
        <p className="muted">Merci ! « {order.artwork.title} » est maintenant à vous.</p>
        <dl className="receipt__rows">
          <div><dt>Œuvre</dt><dd>{order.artwork.title}</dd></div>
          <div><dt>Artiste</dt><dd>{order.seller.username}</dd></div>
          <div><dt>Montant</dt><dd>{formatPrice(order.amount, p?.currency)}</dd></div>
          {p?.cardLast4 && <div><dt>Carte</dt><dd>{p.cardBrand} •••• {p.cardLast4}</dd></div>}
          {p && <div><dt>Référence</dt><dd>{p.id.slice(0, 8).toUpperCase()}</dd></div>}
          {order.paidAt && <div><dt>Date</dt><dd>{formatTime(order.paidAt)}</dd></div>}
        </dl>
        <div className="row-actions row-actions--center">
          <Link href="/orders" className="btn btn--primary">Mes achats</Link>
          <Link href={`/messages?to=${order.seller.id}&artwork=${order.artwork.id}`} className="btn btn--soft">Contacter l&apos;artiste</Link>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>Imprimer le reçu</button>
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
  const [order, setOrder] = useState<Order | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState({ cardNumber: '', holder: '', expiry: '', cvc: '' });

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
      toast.show('Paiement accepté.');
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

  if (!orderId) return <div className="page page--narrow"><div className="state"><p>Aucune commande à payer.</p><Link href="/orders" className="btn btn--soft btn--sm">Mes achats</Link></div></div>;
  if (!order) return <div className="page page--narrow">{error ? <p className="form-error" role="alert">{error}</p> : <p className="muted">Chargement…</p>}</div>;
  if (order.status === 'paid') return <Success order={order} />;

  const payable = order.status === 'accepted';
  return (
    <div className="page page--wide">
      <header className="page-head"><div><h1>Paiement</h1><p className="muted">Finalisez votre achat en toute sécurité.</p></div></header>
      {params.get('cancelled') && <p className="notice notice--warn">Paiement annulé. Vous pouvez réessayer quand vous voulez.</p>}

      <div className="checkout">
        <aside className="panel summary">
          <h2>Récapitulatif</h2>
          <div className="summary__art"><ArtImage src={order.artwork.imageUrl} alt={order.artwork.title} eager /></div>
          <h3>{order.artwork.title}</h3>
          <p className="muted">par {order.seller.username}</p>
          <div className="summary__total"><span>Total</span><strong>{formatPrice(order.amount, config?.currency)}</strong></div>
          {config?.provider === 'stripe' && config.currency.toUpperCase() !== 'TND' && <small className="muted">Montant débité en {config.currency.toUpperCase()} en mode test (Stripe ne gère pas le TND).</small>}
        </aside>

        <section className="panel pay">
          {!payable ? (
            <div className="state state--plain">
              <p>
                {order.status === 'pending' ? "Cette demande attend encore la validation de l'artiste." : order.status === 'rejected' ? "L'artiste a refusé cette demande." : 'Cette commande a été annulée.'}
              </p>
              <Link href="/orders" className="btn btn--soft btn--sm">Retour à mes achats</Link>
            </div>
          ) : config?.provider === 'stripe' ? (
            <div className="form-stack">
              <h2>Payer avec Stripe</h2>
              <p className="muted">Vous allez être redirigé vers la page de paiement sécurisée de Stripe (mode test).</p>
              <div className="notice">Carte de test : <strong>4242 4242 4242 4242</strong>, date future, CVC au choix.</div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="button" className="btn btn--primary btn--lg" onClick={payStripe} disabled={busy}>{busy ? 'Redirection…' : `Payer ${formatPrice(order.amount, config.currency)}`}</button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={payMock}>
              <h2>Paiement par carte</h2>
              <div className="notice">
                <strong>Mode démonstration</strong> : aucun débit réel. Carte valide : <code>4242 4242 4242 4242</code>. Carte refusée : <code>4000 0000 0000 0002</code>. Date future et CVC au choix.
              </div>
              <CardPreview number={card.cardNumber} holder={card.holder} expiry={card.expiry} />
              <label className="field"><span>Numéro de carte</span><input required inputMode="numeric" autoComplete="cc-number" placeholder="1234 5678 9012 3456" value={card.cardNumber} onChange={(e) => setCard({ ...card, cardNumber: groups4(e.target.value) })} /></label>
              <label className="field"><span>Nom du titulaire</span><input required autoComplete="cc-name" placeholder="Nom comme sur la carte" value={card.holder} onChange={(e) => setCard({ ...card, holder: e.target.value.toUpperCase() })} /></label>
              <div className="form-grid">
                <label className="field"><span>Expiration</span><input required inputMode="numeric" autoComplete="cc-exp" placeholder="MM/AA" value={card.expiry} onChange={(e) => setCard({ ...card, expiry: expiryFmt(e.target.value) })} /></label>
                <label className="field"><span>Code de sécurité</span><input required inputMode="numeric" autoComplete="cc-csc" placeholder="CVC" maxLength={4} value={card.cvc} onChange={(e) => setCard({ ...card, cvc: e.target.value.replace(/\D/g, '') })} /></label>
              </div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                {busy ? 'Vérification auprès de la banque…' : `Payer ${formatPrice(order.amount, config?.currency)}`}
              </button>
              <p className="secure-note">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 018 0v3" /></svg>
                Seuls les 4 derniers chiffres de votre carte sont conservés.
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
