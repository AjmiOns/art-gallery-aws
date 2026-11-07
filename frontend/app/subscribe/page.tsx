'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { api, Billing, MySubscription, PaymentConfig, PlanCatalog, PlanId, SubscriptionReceipt } from '@/lib/api';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { useAuth } from '@/components/AuthProvider';
import CardFields, { CardValues, EMPTY_CARD } from '@/components/CardFields';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

const isPaid = (v: string | null): v is 'premium' | 'pro' => v === 'premium' || v === 'pro';

function Success({ receipt, planName }: { receipt: SubscriptionReceipt; planName: string }) {
  return (
    <div className="page page--narrow">
      <div className="panel receipt">
        <div className="receipt__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
        </div>
        <h1>Abonnement {planName} activé</h1>
        <p className="muted">Votre nouvelle commission s&apos;applique dès maintenant aux ventes à venir.</p>
        <dl className="receipt__rows">
          <div><dt>Plan</dt><dd>{planName} ({receipt.billing === 'yearly' ? 'annuel' : 'mensuel'})</dd></div>
          <div><dt>Montant</dt><dd>{formatPrice(receipt.amount, receipt.currency)}</dd></div>
          {receipt.cardLast4 && <div><dt>Carte</dt><dd>{receipt.cardBrand} •••• {receipt.cardLast4}</dd></div>}
          <div><dt>Valable jusqu&apos;au</dt><dd>{formatDate(receipt.endsAt)}</dd></div>
          <div><dt>Référence</dt><dd>{receipt.subscriptionId.slice(0, 8).toUpperCase()}</dd></div>
        </dl>
        <div className="row-actions row-actions--center">
          <Link href="/artist?tab=subscription" className="btn btn--primary">Mon abonnement</Link>
          <Link href="/sell" className="btn btn--soft">Publier une œuvre</Link>
          <button type="button" className="btn btn--ghost" onClick={() => window.print()}>Imprimer le reçu</button>
        </div>
      </div>
    </div>
  );
}

function Subscribe() {
  const params = useSearchParams();
  const planParam = params.get('plan');
  const billing: Billing = params.get('billing') === 'yearly' ? 'yearly' : 'monthly';
  const sessionId = params.get('session_id');
  const { token } = useAuth();
  const toast = useToast();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [receipt, setReceipt] = useState<SubscriptionReceipt | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<CardValues>(EMPTY_CARD);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.plans(), api.paymentConfig(), api.mySubscription(token)])
      .then(([c, p, m]) => { setCatalog(c); setConfig(p); setMine(m); })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  // Retour de Stripe Checkout : l'API interroge Stripe pour confirmer le paiement.
  useEffect(() => {
    if (!token || !sessionId) return;
    api.confirmSubscriptionStripe(sessionId, token).then(setReceipt).catch((e: Error) => setError(e.message));
  }, [token, sessionId]);

  const plan = catalog?.plans.find((p) => p.id === planParam);
  if (!isPaid(planParam)) {
    return (
      <div className="page page--narrow">
        <div className="state"><p>Choisissez d&apos;abord un abonnement.</p><Link href="/pricing" className="btn btn--primary btn--sm">Voir les tarifs</Link></div>
      </div>
    );
  }
  if (receipt && plan) return <Success receipt={receipt} planName={plan.name} />;
  if (!plan || !config || !mine) {
    return <div className="page page--narrow">{error ? <p className="form-error" role="alert">{error}</p> : <p className="muted">Chargement…</p>}</div>;
  }

  const price = billing === 'yearly' ? plan.yearlyPrice : plan.monthlyPrice;
  const currency = config.currency;
  const renewing = mine.plan.id === plan.id && !!mine.expiresAt;
  const downgrade = (mine.plan.id === 'pro' && plan.id === 'premium');

  async function payMock(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setError('');
    setBusy(true);
    try {
      const { subscriptionId } = await api.subscribe(planParam as PlanId, billing, token);
      const r = await api.confirmSubscriptionMock({ subscriptionId, ...card }, token);
      toast.show('Abonnement activé.');
      setReceipt(r);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function payStripe() {
    if (!token) return;
    setError('');
    setBusy(true);
    try {
      const res = await api.subscribe(planParam as PlanId, billing, token);
      if (res.url) window.location.href = res.url;
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <div className="page page--wide">
      <header className="page-head"><div><h1>Abonnement {plan.name}</h1><p className="muted">Paiement sécurisé, sans engagement : l&apos;abonnement n&apos;est pas reconduit automatiquement.</p></div></header>
      {params.get('cancelled') && <p className="notice notice--warn">Paiement annulé. Vous pouvez réessayer quand vous voulez.</p>}

      <div className="checkout">
        <aside className="panel summary">
          <h2>Récapitulatif</h2>
          <h3>{plan.name} · {billing === 'yearly' ? 'annuel' : 'mensuel'}</h3>
          <ul className="plan__perks plan__perks--compact">
            <li>Commission réduite à <strong>{formatPercent(plan.commissionRate)}</strong> (au lieu de {formatPercent(catalog!.plans[0].commissionRate)})</li>
            <li>{plan.maxArtworks === null ? 'Œuvres illimitées' : `${plan.maxArtworks} œuvres en ligne`}</li>
            <li>Badge et mise en avant dans le catalogue</li>
          </ul>
          <div className="summary__total"><span>Total</span><strong>{formatPrice(price, currency)}</strong></div>
          {renewing
            ? <small className="muted">La période s&apos;ajoute à votre abonnement actuel, qui court jusqu&apos;au {formatDate(mine.expiresAt!)}.</small>
            : mine.plan.id !== 'free' && <small className="muted">Le changement de plan prend effet immédiatement ; la période en cours n&apos;est pas remboursée.</small>}
          {config.provider === 'stripe' && currency.toUpperCase() !== 'TND' && <small className="muted">Montant débité en {currency.toUpperCase()} en mode test.</small>}
        </aside>

        <section className="panel pay">
          {downgrade ? (
            <div className="state state--plain">
              <p>Vous avez déjà l&apos;abonnement Pro : il reste actif jusqu&apos;au {mine.expiresAt ? formatDate(mine.expiresAt) : 'terme de la période'}.</p>
              <Link href="/artist?tab=subscription" className="btn btn--soft btn--sm">Mon abonnement</Link>
            </div>
          ) : config.provider === 'stripe' ? (
            <div className="form-stack">
              <h2>Payer avec Stripe</h2>
              <p className="muted">Vous allez être redirigé vers la page de paiement sécurisée de Stripe (mode test).</p>
              <div className="notice">Carte de test : <strong>4242 4242 4242 4242</strong>, date future, CVC au choix.</div>
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="button" className="btn btn--primary btn--lg" onClick={payStripe} disabled={busy}>{busy ? 'Redirection…' : `Payer ${formatPrice(price, currency)}`}</button>
            </div>
          ) : (
            <form className="form-stack" onSubmit={payMock}>
              <h2>Paiement par carte</h2>
              <div className="notice">
                <strong>Mode démonstration</strong> : aucun débit réel. Carte valide : <code>4242 4242 4242 4242</code>. Carte refusée : <code>4000 0000 0000 0002</code>. Date future et CVC au choix.
              </div>
              <CardFields value={card} onChange={setCard} />
              {error && <p className="form-error" role="alert">{error}</p>}
              <button type="submit" className="btn btn--primary btn--lg" disabled={busy}>
                {busy ? 'Vérification auprès de la banque…' : `Payer ${formatPrice(price, currency)}`}
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

export default function SubscribePage() {
  return (
    <RequireRole roles={['artist']}>
      <Suspense fallback={null}>
        <Subscribe />
      </Suspense>
    </RequireRole>
  );
}
