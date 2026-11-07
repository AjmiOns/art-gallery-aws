'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { api, Billing, MySubscription, Plan, PlanCatalog, PlanId } from '@/lib/api';
import { formatPercent, formatPrice } from '@/lib/format';
import { useAuth } from '@/components/AuthProvider';

const RANK: Record<PlanId, number> = { free: 0, premium: 1, pro: 2 };
const round2 = (n: number) => Math.round(n * 100) / 100;

const Check = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);

export default function PricingPage() {
  const { user, token, ready } = useAuth();
  const [catalog, setCatalog] = useState<PlanCatalog | null>(null);
  const [mine, setMine] = useState<MySubscription | null>(null);
  const [error, setError] = useState('');
  const [billing, setBilling] = useState<Billing>('monthly');
  const [volume, setVolume] = useState(300);

  useEffect(() => {
    api.plans().then(setCatalog).catch((e: Error) => setError(e.message));
  }, []);
  useEffect(() => {
    if (token && user?.role === 'artist') api.mySubscription(token).then(setMine).catch(() => setMine(null));
    else setMine(null);
  }, [token, user?.role]);

  const currency = catalog?.currency;
  const currentId: PlanId = mine?.plan.id ?? 'free';

  // Coût mensuel de chaque plan pour un volume de ventes donné : abonnement (lissé) + commission
  const comparison = useMemo(() => {
    if (!catalog) return [];
    const rows = catalog.plans.map((p) => {
      const fee = billing === 'yearly' ? p.yearlyPrice / 12 : p.monthlyPrice;
      const commission = volume * p.commissionRate;
      return { plan: p, fee: round2(fee), commission: round2(commission), net: round2(volume - commission - fee) };
    });
    const best = rows.reduce((a, b) => (b.net > a.net ? b : a), rows[0]);
    return rows.map((r) => ({ ...r, best: r.plan.id === best.plan.id }));
  }, [catalog, billing, volume]);

  function cta(p: Plan) {
    if (!ready) return null;
    if (p.id === 'free') {
      if (!user) return <Link href="/register" className="btn btn--soft btn--block">Commencer gratuitement</Link>;
      return <span className="plan__current">{currentId === 'free' ? 'Votre plan actuel' : 'Plan de base'}</span>;
    }
    if (!user) return <Link href="/register" className="btn btn--primary btn--block">Créer un compte artiste</Link>;
    if (user.role !== 'artist') return <span className="plan__current">Réservé aux comptes artiste</span>;
    if (p.id === currentId) {
      return (
        <Link href={`/subscribe?plan=${p.id}&billing=${billing}`} className="btn btn--soft btn--block">Renouveler</Link>
      );
    }
    if (RANK[p.id] < RANK[currentId]) return <span className="plan__current">Inclus dans votre plan</span>;
    return <Link href={`/subscribe?plan=${p.id}&billing=${billing}`} className="btn btn--primary btn--block">Choisir {p.name}</Link>;
  }

  return (
    <div className="page page--wide">
      <header className="pricing-head">
        <h1>Vendez plus, gardez plus</h1>
        <p className="muted">
          Publiez gratuitement, ou passez à un abonnement pour réduire la commission prélevée sur chaque vente et mettre vos œuvres en avant.
        </p>
        <div className="billing-toggle" role="group" aria-label="Fréquence de facturation">
          <button type="button" className={billing === 'monthly' ? 'is-active' : ''} aria-pressed={billing === 'monthly'} onClick={() => setBilling('monthly')}>Mensuel</button>
          <button type="button" className={billing === 'yearly' ? 'is-active' : ''} aria-pressed={billing === 'yearly'} onClick={() => setBilling('yearly')}>
            Annuel <span className="billing-toggle__save">2 mois offerts</span>
          </button>
        </div>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {!catalog && !error && <p className="muted">Chargement des tarifs…</p>}

      {catalog && (
        <>
          <div className="plans">
            {catalog.plans.map((p) => {
              const featured = p.id === 'premium';
              const price = billing === 'yearly' ? p.yearlyPrice : p.monthlyPrice;
              return (
                <article key={p.id} className={`plan${featured ? ' plan--featured' : ''}${p.id === currentId && user?.role === 'artist' ? ' plan--current' : ''}`}>
                  {featured && <span className="plan__ribbon">Le plus choisi</span>}
                  <h2>{p.name}</h2>
                  <p className="muted plan__tagline">{p.tagline}</p>
                  <p className="plan__price">
                    <strong>{price === 0 ? 'Gratuit' : formatPrice(price, currency)}</strong>
                    {price > 0 && <span>/ {billing === 'yearly' ? 'an' : 'mois'}</span>}
                  </p>
                  <p className="plan__commission">
                    Commission <strong>{formatPercent(p.commissionRate)}</strong> par vente
                  </p>
                  <ul className="plan__perks">
                    {p.perks.map((perk) => <li key={perk}><Check />{perk}</li>)}
                  </ul>
                  <div className="plan__cta">{cta(p)}</div>
                </article>
              );
            })}
          </div>

          <section className="panel calc" aria-labelledby="calc-title">
            <h2 id="calc-title">Quel abonnement vous convient ?</h2>
            <p className="muted">Indiquez vos ventes mensuelles estimées pour voir ce que vous gardez avec chaque plan.</p>
            <label className="field calc__input">
              <span>Ventes par mois ({currency})</span>
              <input type="number" min={0} step={50} value={volume} onChange={(e) => setVolume(Math.max(0, Number(e.target.value) || 0))} />
            </label>
            <div className="table-wrap">
              <table className="table table--compact">
                <thead><tr><th>Plan</th><th>Abonnement</th><th>Commission</th><th>Vous gardez</th></tr></thead>
                <tbody>
                  {comparison.map((r) => (
                    <tr key={r.plan.id} className={r.best ? 'is-best' : ''}>
                      <td><strong>{r.plan.name}</strong>{r.best && <span className="calc__best">Le plus avantageux</span>}</td>
                      <td>{formatPrice(r.fee, currency)}</td>
                      <td>{formatPrice(r.commission, currency)} <span className="muted">({formatPercent(r.plan.commissionRate)})</span></td>
                      <td><strong>{formatPrice(r.net, currency)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small className="muted">Estimation indicative. La commission est calculée sur le prix de l&apos;œuvre au moment du paiement et reste figée pour la vente.</small>
          </section>
        </>
      )}
    </div>
  );
}
