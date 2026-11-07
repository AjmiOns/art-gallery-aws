'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, MySubscription } from '@/lib/api';
import { formatDate, formatPercent, formatPrice } from '@/lib/format';
import { useAuth } from './AuthProvider';
import { useI18n } from './LanguageProvider';
import { useToast } from './Toast';

// Onglet « Abonnement » de l'espace artiste : plan actuel, quota d'œuvres, commissions payées, factures
export default function SubscriptionPanel() {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (token) api.mySubscription(token).then(setSub).catch((e: Error) => setError(e.message));
  }, [token]);
  useEffect(load, [load]);

  async function cancel() {
    if (!token || !window.confirm(t('Revenir au plan gratuit maintenant ? La période déjà payée ne sera pas remboursée.'))) return;
    setBusy(true);
    try {
      setSub(await api.cancelSubscription(token));
      toast.show(t('Vous êtes revenu au plan gratuit.'));
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!sub) return <p className="muted">{t('Chargement…')}</p>;

  const { plan, usage, sales } = sub;
  const paid = plan.id !== 'free';
  const pct = usage.max === null ? 0 : Math.min(100, Math.round((usage.online / usage.max) * 100));
  const full = usage.max !== null && usage.online >= usage.max;
  const daysLeft = sub.expiresAt ? Math.ceil((new Date(sub.expiresAt).getTime() - Date.now()) / 86400000) : null;

  return (
    <div className="sub">
      {sub.expired && <p className="notice notice--warn">{t('Votre abonnement a expiré : vous êtes revenu au plan gratuit. Renouvelez-le pour retrouver votre commission réduite.')}</p>}

      <div className="sub__grid">
        <section className="panel">
          <div className="sub__head">
            <div>
              <span className="muted">{t('Plan actuel')}</span>
              <h2>{t(plan.name)}</h2>
            </div>
            <span className={`plan-badge plan-badge--${plan.id}`}>{t('{rate} de commission', { rate: formatPercent(plan.commissionRate) })}</span>
          </div>
          {paid && sub.expiresAt ? (
            <p className="muted">
              {sub.billing === 'yearly' ? t('Facturation annuelle') : t('Facturation mensuelle')} · {t("valable jusqu'au")} <strong>{formatDate(sub.expiresAt)}</strong>
              {daysLeft !== null && daysLeft <= 7 && daysLeft >= 0 && <> ({daysLeft === 0 ? t("aujourd'hui") : t(daysLeft > 1 ? 'dans {count} jours' : 'dans {count} jour', { count: daysLeft })})</>}
            </p>
          ) : (
            <p className="muted">{t(plan.tagline)}</p>
          )}

          <div className="usage" aria-label={t('Œuvres en ligne')}>
            <div className="usage__head">
              <span>{t('Œuvres en ligne')}</span>
              <strong>{usage.online}{usage.max !== null ? ` / ${usage.max}` : ''}</strong>
            </div>
            {usage.max !== null && <div className="usage__track"><span className={full ? 'is-full' : ''} style={{ width: `${pct}%` }} /></div>}
            {full && <small className="usage__warn">{t("Limite atteinte : passez à un abonnement supérieur pour publier d'autres œuvres.")}</small>}
            {usage.max === null && <small className="muted">{t('Publication illimitée.')}</small>}
          </div>

          <div className="row-actions">
            {plan.id !== 'pro' && <Link href={`/pricing`} className="btn btn--primary btn--sm">{paid ? t('Passer à Pro') : t("Passer à l'abonnement")}</Link>}
            {paid && <Link href={`/subscribe?plan=${plan.id}&billing=${sub.billing ?? 'monthly'}`} className="btn btn--soft btn--sm">{t('Renouveler')}</Link>}
            {paid && <button type="button" className="btn btn--ghost btn--sm btn--danger" disabled={busy} onClick={cancel}>{t('Résilier')}</button>}
          </div>
        </section>

        <section className="panel">
          <h2>{t('Mes ventes')}</h2>
          <dl className="sub__sales">
            <div><dt>{t('Ventes réalisées')}</dt><dd>{sales.count}</dd></div>
            <div><dt>{t('Montant brut')}</dt><dd>{formatPrice(sales.gross)}</dd></div>
            <div><dt>{t('Commission de la plateforme')}</dt><dd className="neg">− {formatPrice(sales.commission)}</dd></div>
            <div className="total"><dt>{t('Net reversé')}</dt><dd>{formatPrice(sales.net)}</dd></div>
          </dl>
          {plan.id !== 'pro' && sales.gross > 0 && (
            <small className="muted">
              {t("Avec l'abonnement Pro ({rate}), la commission sur ces ventes aurait été de {amount}.", { rate: formatPercent(0.03), amount: formatPrice(Math.round(sales.gross * 0.03 * 100) / 100) })}
            </small>
          )}
        </section>
      </div>

      <section className="panel sub__history">
        <h2>{t('Historique des paiements')}</h2>
        {sub.history.length === 0 ? (
          <p className="muted">{t('Aucun abonnement acheté pour le moment.')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead><tr><th>{t('Date')}</th><th>{t('Plan')}</th><th>{t('Période')}</th><th>{t('Carte')}</th><th>{t('Montant')}</th></tr></thead>
              <tbody>
                {sub.history.map((h) => (
                  <tr key={h.id}>
                    <td>{h.paidAt ? formatDate(h.paidAt) : '—'}</td>
                    <td><strong>{h.plan === 'pro' ? 'Pro' : 'Premium'}</strong> · {h.billing === 'yearly' ? t('annuel') : t('mensuel')}</td>
                    <td>{h.startsAt && h.endsAt ? `${formatDate(h.startsAt)} → ${formatDate(h.endsAt)}` : '—'}</td>
                    <td>{h.cardLast4 ? `${h.cardBrand} •••• ${h.cardLast4}` : '—'}</td>
                    <td>{formatPrice(h.amount, h.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
