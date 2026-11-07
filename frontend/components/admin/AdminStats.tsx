'use client';

import { useEffect, useState } from 'react';
import { api, Stats } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '../AuthProvider';
import { useI18n } from '../LanguageProvider';

const ORDER_SEGMENTS = [
  ['pending', 'En attente'], ['accepted', 'À payer'], ['paid', 'Payées'], ['rejected', 'Refusées'], ['cancelled', 'Annulées'],
] as const;

function RevenueChart({ daily }: { daily: Stats['daily'] }) {
  const { t } = useI18n();
  const max = Math.max(...daily.map((d) => d.revenue), 1);
  const w = 600, h = 170, bar = w / daily.length;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label={t("Chiffre d'affaires des 30 derniers jours")}>
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={w} y1={h - h * f} y2={h - h * f} className="chart__grid" />)}
        {daily.map((d, i) => {
          const bh = Math.max((d.revenue / max) * h, d.revenue > 0 ? 3 : 0);
          return (
            <rect key={d.date} x={i * bar + 3} y={h - bh} width={bar - 6} height={bh} rx="4" className="chart__bar">
              <title>{`${d.date} : ${formatPrice(d.revenue)} (${t(d.sales > 1 ? '{count} ventes' : '{count} vente', { count: d.sales })})`}</title>
            </rect>
          );
        })}
        <text x="0" y={h + 16} className="chart__label">{daily[0]?.date.slice(5)}</text>
        <text x={w} y={h + 16} textAnchor="end" className="chart__label">{daily[daily.length - 1]?.date.slice(5)}</text>
      </svg>
    </figure>
  );
}

export default function AdminStats() {
  const { token } = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) api.adminStats(token).then(setStats).catch((e: Error) => setError(e.message));
  }, [token]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!stats) return <p className="muted">{t('Chargement des statistiques…')}</p>;
  const { users, artworks, orders, revenue, platform, plans } = stats;
  const maxArt = Math.max(...stats.byCategory.map((c) => c.artworks), 1);

  return (
    <div className="admin-stats">
      <div className="kpis">
        <div className="kpi kpi--accent"><span>{t("Chiffre d'affaires")}</span><strong>{formatPrice(revenue.total)}</strong><small>{t(revenue.payments > 1 ? '{count} paiements' : '{count} paiement', { count: revenue.payments })}</small></div>
        <div className="kpi"><span>{t('30 derniers jours')}</span><strong>{formatPrice(revenue.last30)}</strong></div>
        <div className="kpi"><span>{t('Commissions perçues')}</span><strong>{formatPrice(platform.commissions)}</strong><small>{t('{amount} sur 30 jours', { amount: formatPrice(platform.commissionsLast30) })}</small></div>
        <div className="kpi"><span>{t('Abonnements vendus')}</span><strong>{formatPrice(platform.subscriptions)}</strong><small>{t('{premium} Premium · {pro} Pro · {free} gratuits', { premium: plans.premium, pro: plans.pro, free: plans.free })}</small></div>
        <div className="kpi"><span>{t('Utilisateurs')}</span><strong>{users.total}</strong><small>{t('{artists} artistes · {buyers} acheteurs', { artists: users.artists, buyers: users.buyers })}{users.suspended ? ` · ${t('{count} suspendu(s)', { count: users.suspended })}` : ''}</small></div>
        <div className="kpi"><span>{t('Œuvres')}</span><strong>{artworks.total}</strong><small>{t('{available} dispo · {reserved} réservées · {sold} vendues', { available: artworks.available, reserved: artworks.reserved, sold: artworks.sold })}</small></div>
        <div className="kpi"><span>{t('Demandes à traiter')}</span><strong>{orders.pending}</strong><small>{t('{count} en attente de paiement', { count: orders.accepted })}</small></div>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h2>{t('Ventes des 30 derniers jours')}</h2>
          <RevenueChart daily={stats.daily} />
        </section>

        <section className="panel">
          <h2>{t('Commandes par statut')}</h2>
          <div className="stack-bar" role="img" aria-label={t('Répartition des commandes')}>
            {ORDER_SEGMENTS.map(([k]) => orders[k] > 0 && <span key={k} className={`stack-bar__seg seg--${k}`} style={{ flexGrow: orders[k] }} title={`${orders[k]}`} />)}
          </div>
          <ul className="legend">
            {ORDER_SEGMENTS.map(([k, label]) => <li key={k}><span className={`dot seg--${k}`} />{t(label)}<strong>{orders[k]}</strong></li>)}
          </ul>
        </section>

        <section className="panel">
          <h2>{t('Catégories')}</h2>
          <ul className="bars">
            {stats.byCategory.map((c) => (
              <li key={c.slug} data-tone={c.tone}>
                <div className="bars__head"><span>{t(c.label)}</span><span className="muted">{t('{artworks} œuvres · {sold} vendues · {revenue}', { artworks: c.artworks, sold: c.sold, revenue: formatPrice(c.revenue) })}</span></div>
                <div className="bars__track"><span style={{ width: `${(c.artworks / maxArt) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>{t('Meilleurs artistes')}</h2>
          {stats.topArtists.length === 0 ? <p className="muted">{t('Aucune vente pour le moment.')}</p> : (
            <table className="table table--compact">
              <thead><tr><th>{t('Artiste')}</th><th>{t('Ventes')}</th><th>{t('Revenus')}</th></tr></thead>
              <tbody>{stats.topArtists.map((a) => <tr key={a.id}><td><strong>{a.username}</strong></td><td>{a.sales}</td><td>{formatPrice(a.revenue)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
