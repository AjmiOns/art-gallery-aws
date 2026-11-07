'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { api, Artwork, Order } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import ArtImage from '@/components/ArtImage';
import ArtworkForm from '@/components/ArtworkForm';
import { useAuth } from '@/components/AuthProvider';
import { useCategories } from '@/components/CategoriesProvider';
import { useI18n } from '@/components/LanguageProvider';
import Modal from '@/components/Modal';
import OrderCard from '@/components/OrderCard';
import RequireRole from '@/components/RequireRole';
import StatusBadge from '@/components/StatusBadge';
import SubscriptionPanel from '@/components/SubscriptionPanel';
import Tabs from '@/components/Tabs';
import { useToast } from '@/components/Toast';

function Dashboard() {
  const { token } = useAuth();
  const { categoryOf } = useCategories();
  const toast = useToast();
  const { t } = useI18n();
  const params = useSearchParams();
  const [tab, setTab] = useState(params.get('tab') === 'subscription' ? 'subscription' : 'artworks');
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
  const paid = orders.filter((o) => o.status === 'paid');
  // Ventes antérieures aux commissions : pas de net enregistré, l'artiste a perçu le montant entier.
  const revenue = paid.reduce((s, o) => s + Number(o.netAmount ?? o.amount), 0);
  const commissions = paid.reduce((s, o) => s + Number(o.commissionAmount ?? 0), 0);

  async function onAction(id: string, action: 'accept' | 'reject' | 'cancel') {
    if (!token) return;
    setBusyId(id);
    try {
      await api.orderAction(id, action, token);
      toast.show(action === 'accept' ? t('Demande acceptée : l’acheteur peut payer.') : action === 'reject' ? t('Demande refusée.') : t('Réservation annulée.'));
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    } finally {
      setBusyId('');
    }
  }

  async function remove(a: Artwork) {
    if (!token || !window.confirm(t('Supprimer « {title} » ? Cette action est définitive.', { title: a.title }))) return;
    try {
      await api.deleteArtwork(a.id, token);
      toast.show(t('Œuvre supprimée.'));
      await load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <div>
          <h1>{t('Espace artiste')}</h1>
          <p className="muted">{t("Gérez vos œuvres et répondez aux demandes d'achat.")}</p>
        </div>
        <Link href="/sell" className="btn btn--primary">{t('Publier une œuvre')}</Link>
      </header>

      <div className="kpis">
        <div className="kpi"><span>{t('Œuvres publiées')}</span><strong>{artworks.length}</strong></div>
        <div className="kpi"><span>{t('Demandes à traiter')}</span><strong>{groups.todo.length}</strong></div>
        <div className="kpi"><span>{t('Œuvres vendues')}</span><strong>{artworks.filter((a) => a.status === 'sold').length}</strong></div>
        <div className="kpi"><span>{t('Revenus nets')}</span><strong>{formatPrice(revenue)}</strong>{commissions > 0 && <small>{t('après {amount} de commission', { amount: formatPrice(commissions) })}</small>}</div>
      </div>

      <Tabs
        items={[{ id: 'artworks', label: 'Mes œuvres' }, { id: 'requests', label: "Demandes d'achat", badge: groups.todo.length }, { id: 'subscription', label: 'Abonnement' }]}
        active={tab}
        onChange={setTab}
      />

      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && <p className="muted">{t('Chargement…')}</p>}

      {tab === 'artworks' && !loading && (
        artworks.length === 0 ? (
          <div className="state">
            <p>{t("Vous n'avez pas encore publié d'œuvre.")}</p>
            <Link href="/sell" className="btn btn--primary btn--sm">{t('Publier ma première œuvre')}</Link>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>{t('Œuvre')}</th><th>{t('Catégorie')}</th><th>{t('Prix')}</th><th>{t('Statut')}</th><th><span className="sr-only">{t('Actions')}</span></th></tr></thead>
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
                      <button type="button" className="btn btn--soft btn--sm" onClick={() => setEditing(a)}>{t('Modifier')}</button>
                      <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => remove(a)}>{t('Supprimer')}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'subscription' && <SubscriptionPanel />}

      {tab === 'requests' && !loading && (
        orders.length === 0 ? (
          <div className="state"><p>{t("Aucune demande d'achat pour le moment.")}</p></div>
        ) : (
          <>
            {([['todo', 'À traiter'], ['waiting', 'Acceptées, en attente de paiement'], ['history', 'Historique']] as const).map(([key, label]) =>
              groups[key].length > 0 && (
                <section key={key} className="order-group">
                  <h2>{t(label)} <span className="count">{groups[key].length}</span></h2>
                  {groups[key].map((o) => <OrderCard key={o.id} order={o} perspective="seller" busy={busyId === o.id} onAction={onAction} />)}
                </section>
              ),
            )}
          </>
        )
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t("Modifier l'œuvre")} wide>
        {editing && (
          <ArtworkForm
            initial={editing}
            onCancel={() => setEditing(null)}
            onSaved={() => { toast.show(t('Œuvre mise à jour.')); setEditing(null); load(); }}
          />
        )}
      </Modal>
    </div>
  );
}

export default function ArtistPage() {
  return (
    <RequireRole roles={['artist']}>
      <Suspense fallback={null}>
        <Dashboard />
      </Suspense>
    </RequireRole>
  );
}
