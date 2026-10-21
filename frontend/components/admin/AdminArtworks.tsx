'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, Artwork } from '@/lib/api';
import { formatPrice } from '@/lib/format';
import ArtImage from '../ArtImage';
import ArtworkForm from '../ArtworkForm';
import { useAuth } from '../AuthProvider';
import { useCategories } from '../CategoriesProvider';
import Modal from '../Modal';
import StatusBadge from '../StatusBadge';
import { useToast } from '../Toast';

export default function AdminArtworks() {
  const { token } = useAuth();
  const { categoryOf } = useCategories();
  const toast = useToast();
  const [items, setItems] = useState<Artwork[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Artwork | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api.listArtworks({ q: q.trim(), status }));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [q, status]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  async function remove(a: Artwork) {
    if (!token || !window.confirm(`Supprimer « ${a.title} » ?`)) return;
    try {
      await api.deleteArtwork(a.id, token);
      toast.show('Œuvre supprimée.');
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <input type="search" placeholder="Rechercher un titre" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher une œuvre" />
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut">
          <option value="">Tous les statuts</option><option value="available">Disponibles</option><option value="reserved">Réservées</option><option value="sold">Vendues</option>
        </select>
        <span className="muted toolbar__count">{items.length} œuvre{items.length > 1 ? 's' : ''}</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Œuvre</th><th>Artiste</th><th>Catégorie</th><th>Prix</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {items.map((a) => (
              <tr key={a.id}>
                <td><div className="cell-art"><span className="cell-art__thumb"><ArtImage src={a.imageUrl} alt="" /></span><strong>{a.title}</strong></div></td>
                <td>{a.owner?.username}</td>
                <td>{categoryOf(a.tags).label}</td>
                <td>{formatPrice(a.price)}</td>
                <td><StatusBadge status={a.status} /></td>
                <td className="cell-actions">
                  <Link href={`/messages?to=${a.ownerId}&artwork=${a.id}`} className="btn btn--ghost btn--sm">Contacter</Link>
                  <button type="button" className="btn btn--soft btn--sm" onClick={() => setEditing(a)}>Modifier</button>
                  <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => remove(a)}>Supprimer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Modal open={!!editing} onClose={() => setEditing(null)} title="Modifier l'œuvre" wide>
        {editing && <ArtworkForm initial={editing} onCancel={() => setEditing(null)} onSaved={() => { toast.show('Œuvre mise à jour.'); setEditing(null); load(); }} />}
      </Modal>
    </div>
  );
}
