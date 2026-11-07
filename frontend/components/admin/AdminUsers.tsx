'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { api, Role, UserProfile } from '@/lib/api';
import { formatShortDate } from '@/lib/format';
import Avatar from '../Avatar';
import { useAuth } from '../AuthProvider';
import { useI18n } from '../LanguageProvider';
import Modal from '../Modal';
import { useToast } from '../Toast';

const ROLE_LABEL = { admin: 'Administrateur', artist: 'Artiste', buyer: 'Acheteur' } as const;

export default function AdminUsers() {
  const { token, user: me } = useAuth();
  const toast = useToast();
  const { t } = useI18n();
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
    const timer = setTimeout(load, 200);
    return () => clearTimeout(timer);
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
      toast.show(t('Utilisateur mis à jour.'));
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
      toast.show(u.isActive ? t('Compte suspendu.') : t('Compte réactivé.'));
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  async function remove(u: UserProfile) {
    if (!token || !window.confirm(t('Supprimer définitivement {name} et ses œuvres ?', { name: u.username }))) return;
    try {
      await api.adminDeleteUser(u.id, token);
      toast.show(t('Utilisateur supprimé.'));
      load();
    } catch (e) {
      toast.show((e as Error).message, 'error');
    }
  }

  return (
    <div>
      <div className="toolbar">
        <input type="search" placeholder={t('Rechercher un nom ou un e-mail')} value={q} onChange={(e) => setQ(e.target.value)} aria-label={t('Rechercher un utilisateur')} />
        <select value={role} onChange={(e) => setRole(e.target.value)} aria-label={t('Rôle')}>
          <option value="">{t('Tous les rôles')}</option><option value="artist">{t('Artistes')}</option><option value="buyer">{t('Acheteurs')}</option><option value="admin">{t('Administrateurs')}</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label={t('Statut')}>
          <option value="">{t('Tous les statuts')}</option><option value="active">{t('Actifs')}</option><option value="suspended">{t('Suspendus')}</option>
        </select>
        <span className="muted toolbar__count">{t(users.length > 1 ? '{count} utilisateurs' : '{count} utilisateur', { count: users.length })}</span>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}

      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>{t('Utilisateur')}</th><th>{t('Rôle')}</th><th>{t('Ville')}</th><th>{t('Statut')}</th><th>{t('Inscrit le')}</th><th><span className="sr-only">{t('Actions')}</span></th></tr></thead>
          <tbody>
            {users.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id}>
                  <td><div className="cell-art"><Avatar name={u.username} size={34} /><div><strong>{u.username}</strong><br /><small className="muted">{u.email}</small></div></div></td>
                  <td><span className={`role-tag role-tag--${u.role}`}>{t(ROLE_LABEL[u.role])}</span></td>
                  <td>{u.city ?? '-'}</td>
                  <td><span className={`status ${u.isActive ? 'status--paid' : 'status--rejected'}`}>{u.isActive ? t('Actif') : t('Suspendu')}</span></td>
                  <td>{formatShortDate(u.createdAt)}</td>
                  <td className="cell-actions">
                    {!self && <Link href={`/messages?to=${u.id}`} className="btn btn--ghost btn--sm">{t('Contacter')}</Link>}
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => edit(u)}>{t('Modifier')}</button>
                    {!self && <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggle(u)}>{u.isActive ? t('Suspendre') : t('Réactiver')}</button>}
                    {!self && <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => remove(u)}>{t('Supprimer')}</button>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={t('Modifier {name}', { name: editing?.username ?? '' })}>
        <form className="form-stack" onSubmit={save}>
          <label className="field"><span>{t('Nom')}</span><input required minLength={2} value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></label>
          <div className="form-grid">
            <label className="field"><span>{t('Téléphone')}</span><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></label>
            <label className="field"><span>{t('Ville')}</span><input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} /></label>
          </div>
          <label className="field"><span>{t('Présentation')}</span><textarea rows={3} maxLength={500} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} /></label>
          <div className="form-grid">
            <label className="field"><span>{t('Rôle')}</span>
              <select value={form.role} disabled={editing?.id === me?.id} onChange={(e) => setForm({ ...form, role: e.target.value as Role })}>
                <option value="buyer">{t('Acheteur')}</option><option value="artist">{t('Artiste')}</option><option value="admin">{t('Administrateur')}</option>
              </select>
            </label>
            <label className="field field--check"><input type="checkbox" checked={form.isActive} disabled={editing?.id === me?.id} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span>{t('Compte actif')}</span></label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="row-actions"><button type="submit" className="btn btn--primary">{t('Enregistrer')}</button><button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>{t('Annuler')}</button></div>
        </form>
      </Modal>
    </div>
  );
}
