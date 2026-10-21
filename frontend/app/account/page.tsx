'use client';

import { useEffect, useState } from 'react';
import { api, UserProfile } from '@/lib/api';
import { formatDate } from '@/lib/format';
import Avatar from '@/components/Avatar';
import { useAuth } from '@/components/AuthProvider';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

const ROLE_LABEL = { admin: 'Administrateur', artist: 'Artiste', buyer: 'Acheteur' } as const;

function Profile() {
  const { token, updateUser } = useAuth();
  const toast = useToast();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [form, setForm] = useState({ username: '', phone: '', city: '', bio: '' });
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [infoError, setInfoError] = useState('');
  const [pwdError, setPwdError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.getMe(token).then((p) => {
      setProfile(p);
      setForm({ username: p.username, phone: p.phone ?? '', city: p.city ?? '', bio: p.bio ?? '' });
    }).catch((e: Error) => setInfoError(e.message));
  }, [token]);

  async function saveInfo(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setInfoError('');
    setBusy(true);
    try {
      const p = await api.updateMe(form, token);
      setProfile(p);
      updateUser({ username: p.username });
      toast.show('Profil mis à jour.');
    } catch (err) {
      setInfoError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    setPwdError('');
    if (pwd.newPassword !== pwd.confirm) return setPwdError('La confirmation ne correspond pas au nouveau mot de passe.');
    setBusy(true);
    try {
      await api.changePassword({ currentPassword: pwd.currentPassword, newPassword: pwd.newPassword }, token);
      setPwd({ currentPassword: '', newPassword: '', confirm: '' });
      toast.show('Mot de passe modifié.');
    } catch (err) {
      setPwdError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form, [k]: e.target.value });

  return (
    <div className="page page--narrow">
      <header className="profile-head">
        <Avatar name={profile?.username ?? '?'} size={64} />
        <div>
          <h1>{profile?.username ?? 'Mon profil'}</h1>
          {profile && <p className="muted">{profile.email} · <span className="role-tag">{ROLE_LABEL[profile.role]}</span> · membre depuis le {formatDate(profile.createdAt)}</p>}
        </div>
      </header>

      <form className="panel form-stack" onSubmit={saveInfo}>
        <h2>Informations personnelles</h2>
        <label className="field"><span>Nom {profile?.role === 'artist' ? "d'artiste" : 'affiché'}</span><input required minLength={2} maxLength={60} value={form.username} onChange={set('username')} /></label>
        <div className="form-grid">
          <label className="field"><span>Téléphone</span><input maxLength={32} value={form.phone} onChange={set('phone')} placeholder="+216 …" /></label>
          <label className="field"><span>Ville</span><input maxLength={80} value={form.city} onChange={set('city')} placeholder="Tunis" /></label>
        </div>
        <label className="field"><span>Présentation</span><textarea rows={4} maxLength={500} value={form.bio} onChange={set('bio')} placeholder={profile?.role === 'artist' ? 'Parlez de votre démarche artistique…' : 'Quelques mots sur vous…'} /></label>
        {infoError && <p className="form-error" role="alert">{infoError}</p>}
        <div className="row-actions"><button type="submit" className="btn btn--primary" disabled={busy}>Enregistrer</button></div>
      </form>

      <form className="panel form-stack" onSubmit={savePassword}>
        <h2>Changer le mot de passe</h2>
        <label className="field"><span>Mot de passe actuel</span><input type="password" required autoComplete="current-password" value={pwd.currentPassword} onChange={(e) => setPwd({ ...pwd, currentPassword: e.target.value })} /></label>
        <div className="form-grid">
          <label className="field"><span>Nouveau mot de passe</span><input type="password" required minLength={8} autoComplete="new-password" value={pwd.newPassword} onChange={(e) => setPwd({ ...pwd, newPassword: e.target.value })} placeholder="8 caractères minimum" /></label>
          <label className="field"><span>Confirmation</span><input type="password" required minLength={8} autoComplete="new-password" value={pwd.confirm} onChange={(e) => setPwd({ ...pwd, confirm: e.target.value })} /></label>
        </div>
        {pwdError && <p className="form-error" role="alert">{pwdError}</p>}
        <div className="row-actions"><button type="submit" className="btn btn--primary" disabled={busy}>Modifier le mot de passe</button></div>
      </form>
    </div>
  );
}

export default function AccountPage() {
  return (
    <RequireRole>
      <Profile />
    </RequireRole>
  );
}
