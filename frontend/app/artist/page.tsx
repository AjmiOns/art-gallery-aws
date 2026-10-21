'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api, Artwork, Order } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import ArtImage from '@/components/ArtImage';
import ArtworkForm from '@/components/ArtworkForm';
import { useAuth } from '@/components/AuthProvider';
import { useCategories } from '@/components/CategoriesProvider';
import Modal from '@/components/Modal';
import OrderCard from '@/components/OrderCard';
import RequireRole from '@/components/RequireRole';
import StatusBadge from '@/components/StatusBadge';
import Tabs from '@/components/Tabs';
import { useToast } from '@/components/Toast';

function Dashboard() {
  const { token } = useAuth();
  const { categoryOf } = useCategories();
  const toast = useToast();
  const [tab, setTab] = useState('artworks');
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Artwork | null>(null);
  const [busyId, setBusyId] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const [a, o] = await Promise.all([api.myArtworks(token), api.salesOrders(token)]);
      setArtworks(a);
      setOrders(o);
      setError('');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const groups = useMemo(() => ({
    todo: orders.filter((o) => o.status === 'pending'),
    waiting: orders.filter((o) => o.status === 'accepted'),
    history: orders.filter((o) => ['paid', 'rejected', 'cancelled'].includes(o.status)),
  }), [orders]);
  const revenue = orders.filter((o) => o.status === 'paid').reduce((s, o) => s + Number(o.amount), 0);

  async function onAction(id: string, action: 'accept' | 'reject' | 'cancel') {
    if (!token) return;
    setBusyId(id);
    try {
      await api.orderAction(id, action, token);
      toast.show(action === 'accept' ? 'Demande acceptée : l’acheteur peut payer.' : action === 'reject' ? 'Demande refusée.' : 'Réservation annulée.');
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusyId('');
    }
  }

  async function remove(a: Artwork) {
    if (!token || !window.confirm(`Supprimer « ${a.title} » ? Cette action est définitive.`)) return;
    try {
      await api.deleteArtwork(a.id, token);
      toast.show('Œuvre supprimée.');
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div>
          <h1>Espace artiste</h1>
          <p className="muted">Gérez vos œuvres et répondez aux demandes d&apos;achat.</p>
        </div>
        <Link href="/sell" className="btn btn--primary">Publier une œuvre</Link>
      </header>

      <div className="kpis">
        <div className="kpi"><span>Œuvres publiées</span><strong>{artworks.length}</strong></div>
        <div className="kpi"><span>Demandes à traiter</span><strong>{groups.todo.length}</strong></div>
        <div className="kpi"><span>Œuvres vendues</span><strong>{artworks.filter((a) => a.status === 'sold').length}</strong></div>
        <div className="kpi"><span>Revenus</span><strong>{formatPrice(revenue)}</strong></div>
      </div>

      <Tabs
        items={[{ id: 'artworks', label: 'Mes œuvres' }, { id: 'requests', label: "Demandes d'achat", badge: groups.todo.length }]}
        active={tab}
        onChange={setTab}
      />

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="muted">Chargement…</p>}

      {tab === 'artworks' && !loading && (
        artworks.length === 0 ? (
          <div className="state">
            <p>Vous n&apos;avez pas encore publié d&apos;œuvre.</p>
            <Link href="/sell" className="btn btn--primary btn--sm">Publier ma première œuvre</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Œuvre</th><th>Catégorie</th><th>Prix</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
              <tbody>
                {artworks.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="cell-art">
                        <span className="cell-art__thumb"><ArtImage src={a.imageUrl} alt="" /></span>
                        <strong>{a.title}</strong>
                      </div>
                    </td>
                    <td>{categoryOf(a.tags).label}</td>
                    <td>{formatPrice(a.price)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td className="cell-actions">
                      <button type="button" className="btn btn--soft btn--sm" onClick={() => setEditing(a)}>Modifier</button>
                      <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => remove(a)}>Supprimer</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'requests' && !loading && (
        orders.length === 0 ? (
          <div className="state"><p>Aucune demande d&apos;achat pour le moment.</p></div>
        ) : (
          <>
            {([['todo', 'À traiter'], ['waiting', 'Acceptées, en attente de paiement'], ['history', 'Historique']] as const).map(([key, label]) =>
              groups[key].length > 0 && (
                <section key={key} className="order-group">
                  <h2>{label} <span className="count">{groups[key].length}</span></h2>
                  {groups[key].map((o) => <OrderCard key={o.id} order={o} perspective="seller" busy={busyId === o.id} onAction={onAction} />)}
                </section>
              ),
            )}
          </>
        )
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'œuvre" wide>
        {editing && (
          <ArtworkForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { toast.show('Œuvre mise à jour.'); setEditing(null); load(); }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function ArtistPage() {
  return (
    <RequireRole roles={['artist']}>
      <Dashboard />
    </RequireRole>
  );
}
