'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, Order } from '@/lib/api';
import { formatPrice, formatShortDate } from '@/lib/format';
import ArtImage from '../ArtImage';
import { useAuth } from '../AuthProvider';
import { useI18n } from '../LanguageProvider';
import StatusBadge from '../StatusBadge';
import { useToast } from '../Toast';

export default function AdminOrders() {
  const { token } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrders(await api.adminOrders(status, token));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, status]);
  useEffect(() => { load(); }, [load]);

  async function act(id: string, action: 'accept' | 'reject' | 'cancel') {
    if (!token) return;
    try {
      await api.orderAction(id, action, token);
      toast.show(t('Commande mise à jour.'));
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Statut')}>
          <option value="">{t('Toutes les commandes')}</option><option value="pending">{t('En attente')}</option><option value="accepted">{t('Acceptées, à payer')}</option>
          <option value="paid">{t('Payées')}</option><option value="rejected">{t('Refusées')}</option><option value="cancelled">{t('Annulées')}</option>
        </select>
        <span className="muted toolbar__count">{t(orders.length > 1 ? '{count} commandes' : '{count} commande', { count: orders.length })}</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('Date')}</th><th>{t('Œuvre')}</th><th>{t('Acheteur')}</th><th>{t('Artiste')}</th><th>{t('Montant')}</th><th>{t('Statut')}</th><th><span className="sr-only">{t('Actions')}</span></th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td>{formatShortDate(o.createdAt)}</td>
                <td><div className="cell-art"><span className="cell-art__thumb"><ArtImage src={o.artwork.imageUrl} alt="" /></span><strong>{o.artwork.title}</strong></div></td>
                <td>{o.buyer.username}</td>
                <td>{o.seller.username}</td>
                <td>{formatPrice(o.amount)}</td>
                <td><StatusBadge status={o.status} /></td>
                <td className="cell-actions cell-actions--wrap">
                  {o.status === 'pending' && <><button type="button" className="btn btn--soft btn--sm" onClick={() => act(o.id, 'accept')}>{t('Accepter')}</button><button type="button" className="btn btn--ghost btn--sm" onClick={() => act(o.id, 'reject')}>{t('Refuser')}</button></>}
                  {(o.status === 'pending' || o.status === 'accepted') && <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => act(o.id, 'cancel')}>{t('Annuler')}</button>}
                  <Link href={`/messages?to=${o.buyer.id}&artwork=${o.artwork.id}`} className="btn btn--ghost btn--sm">{t('Acheteur')}</Link>
                  <Link href={`/messages?to=${o.seller.id}&artwork=${o.artwork.id}`} className="btn btn--ghost btn--sm">{t('Artiste')}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
