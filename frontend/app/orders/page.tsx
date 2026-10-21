'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Order } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import OrderCard from '@/components/OrderCard';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

function MyOrders() {
  const { token } = useAuth();
  const toast = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setOrders(await api.boughtOrders(token));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => ({
    pay: orders.filter((o) => o.status === 'accepted'),
    waiting: orders.filter((o) => o.status === 'pending'),
    history: orders.filter((o) => ['paid', 'rejected', 'cancelled'].includes(o.status)),
  }), [orders]);

  async function onAction(id: string, action: 'accept' | 'reject' | 'cancel') {
    if (!token) return;
    setBusyId(id);
    try {
      await api.orderAction(id, action, token);
      toast.show('Demande annulée.');
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusyId('');
    }
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div>
          <h1>Mes achats</h1>
          <p className="muted">Suivez vos demandes : l&apos;artiste les valide, puis vous payez en ligne.</p>
        </div>
        <Link href="/" className="btn btn--soft">Parcourir les œuvres</Link>
      </header>

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="muted">Chargement…</p>}
      {!loading && orders.length === 0 && !error && (
        <div className="state">
          <p>Vous n&apos;avez encore fait aucune demande d&apos;achat.</p>
          <Link href="/" className="btn btn--primary btn--sm">Découvrir la galerie</Link>
        </div>
      )}

      {([['pay', 'À payer'], ['waiting', "En attente de l'artiste"], ['history', 'Historique']] as const).map(([key, label]) =>
        groups[key].length > 0 && (
          <section key={key} className="order-group">
            <h2>{label} <span className="count">{groups[key].length}</span></h2>
            {groups[key].map((o) => <OrderCard key={o.id} order={o} perspective="buyer" busy={busyId === o.id} onAction={onAction} />)}
          </section>
        ),
      )}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <RequireRole roles={['buyer', 'artist']}>
      <MyOrders />
    </RequireRole>
  );
}
