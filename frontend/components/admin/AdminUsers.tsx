'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, Role, UserProfile } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import Avatar from '../Avatar';
import { useAuth } from '../AuthProvider';
import Modal from '../Modal';
import { useToast } from '../Toast';

const ROLE_LABEL = { admin: 'Administrateur', artist: 'Artiste', buyer: 'Acheteur' } as const;

export default function AdminUsers() {
  const { token, user: me } = useAuth();
  const toast = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [q, setQ] = useState('');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ username: '', phone: '', city: '', bio: '', role: 'buyer' as Role, isActive: true });
  const [formError, setFormError] = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setUsers(await api.adminUsers({ q: q.trim(), role, status }, token));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token, q, role, status]);
  useEffect(() => {
    const t = setTimeout(load, 200);
    return () => clearTimeout(t);
  }, [load]);

  function edit(u: UserProfile) {
    setEditing(u);
    setFormError('');
    setForm({ username: u.username, phone: u.phone ?? '', city: u.city ?? '', bio: u.bio ?? '', role: u.role, isActive: u.isActive });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editing) return;
    try {
      await api.adminUpdateUser(editing.id, form, token);
      toast.show('Utilisateur mis à jour.');
      setEditing(null);
      load();
    } catch (err) {
      setFormError((err as Error).message);
    }
  }

  async function toggle(u: UserProfile) {
    if (!token) return;
    try {
      await api.adminUpdateUser(u.id, { isActive: !u.isActive }, token);
      toast.show(u.isActive ? 'Compte suspendu.' : 'Compte réactivé.');
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  async function remove(u: UserProfile) {
    if (!token || !window.confirm(`Supprimer définitivement ${u.username} et ses œuvres ?`)) return;
    try {
      await api.adminDeleteUser(u.id, token);
      toast.show('Utilisateur supprimé.');
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <input type="search" placeholder="Rechercher un nom ou un e-mail" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Rechercher un utilisateur" />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rôle">
          <option value="">Tous les rôles</option><option value="artist">Artistes</option><option value="buyer">Acheteurs</option><option value="admin">Administrateurs</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Statut">
          <option value="">Tous les statuts</option><option value="active">Actifs</option><option value="suspended">Suspendus</option>
        </select>
        <span className="muted toolbar__count">{users.length} utilisateur{users.length > 1 ? 's' : ''}</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Ville</th><th>Statut</th><th>Inscrit le</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td><div className="cell-art"><Avatar name={u.username} size={34} /><div><strong>{u.username}</strong><br /><small className="muted">{u.email}</small></div></div></td>
                  <td><span className={`role-tag role-tag--${u.role}`}>{ROLE_LABEL[u.role]}</span></td>
                  <td>{u.city ?? '-'}</td>
                  <td><span className={`status ${u.isActive ? 'status--paid' : 'status--rejected'}`}>{u.isActive ? 'Actif' : 'Suspendu'}</span></td>
                  <td>{formatShortDate(u.createdAt)}</td>
                  <td className="cell-actions">
                    {!self && <Link href={`/messages?to=${u.id}`} className="btn btn--ghost btn--sm">Contacter</Link>}
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => edit(u)}>Modifier</button>
                    {!self && <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggle(u)}>{u.isActive ? 'Suspendre' : 'Réactiver'}</button>}
                    {!self && <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => remove(u)}>Supprimer</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Modifier ${editing?.username ?? ''}`}>
        <form className="form-stack" onSubmit={save}>
          <label className="field"><span>Nom</span><input required minLength={2} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <div className="form-grid">
            <label className="field"><span>Téléphone</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field"><span>Ville</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          </div>
          <label className="field"><span>Présentation</span><textarea rows={3} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
          <div className="form-grid">
            <label className="field"><span>Rôle</span>
              <select value={form.role} disabled={editing?.id === me?.id} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="buyer">Acheteur</option><option value="artist">Artiste</option><option value="admin">Administrateur</option>
              </select>
            </label>
            <label className="field field--check"><input type="checkbox" checked={form.isActive} disabled={editing?.id === me?.id} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span>Compte actif</span></label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="row-actions"><button type="submit" className="btn btn--primary">Enregistrer</button><button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>Annuler</button></div>
        </form>
      </Modal>
    </div>
  );
}
