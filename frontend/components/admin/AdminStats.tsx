'use client';

import { useEffect, useState } from 'react';
import { api, Stats } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import { useAuth } from '../AuthProvider';

const ORDER_SEGMENTS = [
  ['pending', 'En attente'], ['accepted', 'À payer'], ['paid', 'Payées'], ['rejected', 'Refusées'], ['cancelled', 'Annulées'],
] as const;

function RevenueChart({ daily }: { daily: Stats['daily'] }) {
  const max = Math.max(...daily.map((d) => d.revenue), 1);
  const w = 600, h = 170, bar = w / daily.length;
  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${w} ${h + 22}`} role="img" aria-label="Chiffre d'affaires des 30 derniers jours">
        {[0.25, 0.5, 0.75, 1].map((f) => <line key={f} x1="0" x2={w} y1={h - h * f} y2={h - h * f} className="chart__grid" />)}
        {daily.map((d, i) => {
          const bh = Math.max((d.revenue / max) * h, d.revenue > 0 ? 3 : 0);
          return (
            <rect key={d.date} x={i * bar + 3} y={h - bh} width={bar - 6} height={bh} rx="4" className="chart__bar">
              <title>{`${d.date} : ${formatPrice(d.revenue)} (${d.sales} vente${d.sales > 1 ? 's' : ''})`}</title>
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
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (token) api.adminStats(token).then(setStats).catch((e: Error) => setError(e.message));
  }, [token]);

  if (error) return <p className="form-error" role="alert">{error}</p>;
  if (!stats) return <p className="muted">Chargement des statistiques…</p>;
  const { users, artworks, orders, revenue } = stats;
  const maxArt = Math.max(...stats.byCategory.map((c) => c.artworks), 1);

  return (
    <div className="admin-stats">
      <div className="kpis">
        <div className="kpi kpi--accent"><span>Chiffre d&apos;affaires</span><strong>{formatPrice(revenue.total)}</strong><small>{revenue.payments} paiement{revenue.payments > 1 ? 's' : ''}</small></div>
        <div className="kpi"><span>30 derniers jours</span><strong>{formatPrice(revenue.last30)}</strong></div>
        <div className="kpi"><span>Utilisateurs</span><strong>{users.total}</strong><small>{users.artists} artistes · {users.buyers} acheteurs{users.suspended ? ` · ${users.suspended} suspendu(s)` : ''}</small></div>
        <div className="kpi"><span>Œuvres</span><strong>{artworks.total}</strong><small>{artworks.available} dispo · {artworks.reserved} réservées · {artworks.sold} vendues</small></div>
        <div className="kpi"><span>Demandes à traiter</span><strong>{orders.pending}</strong><small>{orders.accepted} en attente de paiement</small></div>
      </div>

      <div className="admin-grid">
        <section className="panel">
          <h2>Ventes des 30 derniers jours</h2>
          <RevenueChart daily={stats.daily} />
        </section>

        <section className="panel">
          <h2>Commandes par statut</h2>
          <div className="stack-bar" role="img" aria-label="Répartition des commandes">
            {ORDER_SEGMENTS.map(([k]) => orders[k] > 0 && <span key={k} className={`stack-bar__seg seg--${k}`} style={{ flexGrow: orders[k] }} title={`${orders[k]}`} />)}
          </div>
          <ul className="legend">
            {ORDER_SEGMENTS.map(([k, label]) => <li key={k}><span className={`dot seg--${k}`} />{label}<strong>{orders[k]}</strong></li>)}
          </ul>
        </section>

        <section className="panel">
          <h2>Catégories</h2>
          <ul className="bars">
            {stats.byCategory.map((c) => (
              <li key={c.slug} data-tone={c.tone}>
                <div className="bars__head"><span>{c.label}</span><span className="muted">{c.artworks} œuvres · {c.sold} vendues · {formatPrice(c.revenue)}</span></div>
                <div className="bars__track"><span style={{ width: `${(c.artworks / maxArt) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>

        <section className="panel">
          <h2>Meilleurs artistes</h2>
          {stats.topArtists.length === 0 ? <p className="muted">Aucune vente pour le moment.</p> : (
            <table className="table table--compact">
              <thead><tr><th>Artiste</th><th>Ventes</th><th>Revenus</th></tr></thead>
              <tbody>{stats.topArtists.map((a) => <tr key={a.id}><td><strong>{a.username}</strong></td><td>{a.sales}</td><td>{formatPrice(a.revenue)}</td></tr>)}</tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
