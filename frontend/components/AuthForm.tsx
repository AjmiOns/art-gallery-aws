'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

const SAMPLES = ['/artworks/painting/painting-08.jpg', '/artworks/digital/digital-13.jpg', '/artworks/wall-art/wall-art-02.jpg'];
const HOME = { admin: '/admin', artist: '/artist', buyer: '/' } as const;

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { user, ready, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'buyer' | 'artist'>('buyer');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  // Déjà connecté : on renvoie vers l'espace correspondant au rôle.
  useEffect(() => {
    if (ready && user) router.replace(HOME[user.role]);
  }, [ready, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s = isLogin ? await api.login({ email, password }) : await api.register({ email, username, password, role });
      signIn(s);
      router.push(HOME[s.user.role]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth">
      <div className="auth__aside">
        <Link href="/" className="brand brand--light">
          <span className="brand__mark" aria-hidden="true" />
          Galerie d&apos;art
        </Link>
        <div className="auth__pitch">
          <h1>{isLogin ? 'Content de vous revoir.' : 'Rejoignez la galerie.'}</h1>
          <p>
            {isLogin
              ? 'Retrouvez vos œuvres, vos demandes d’achat et vos messages.'
              : 'Achetez des œuvres uniques ou publiez vos créations et vendez-les à une communauté de passionnés.'}
          </p>
          <div className="auth__thumbs" aria-hidden="true">
            {SAMPLES.map((src, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="" style={{ transform: `rotate(${(i - 1) * 5}deg)` }} />
            ))}
          </div>
        </div>
      </div>

      <div className="auth__panel">
        <form className="auth__card" onSubmit={submit}>
          <div className="tabs" role="tablist" aria-label="Connexion ou inscription">
            <Link href="/login" role="tab" aria-selected={isLogin} className={isLogin ? 'is-active' : ''}>Connexion</Link>
            <Link href="/register" role="tab" aria-selected={!isLogin} className={!isLogin ? 'is-active' : ''}>Inscription</Link>
          </div>

          <h2>{isLogin ? 'Se connecter' : 'Créer un compte'}</h2>

          {!isLogin && (
            <fieldset className="field">
              <legend>Je suis</legend>
              <div className="role-pick">
                <label className={role === 'buyer' ? 'is-active' : ''}>
                  <input type="radio" name="role" value="buyer" checked={role === 'buyer'} onChange={() => setRole('buyer')} />
                  <strong>Acheteur</strong>
                  <span>Je découvre et j&apos;achète des œuvres</span>
                </label>
                <label className={role === 'artist' ? 'is-active' : ''}>
                  <input type="radio" name="role" value="artist" checked={role === 'artist'} onChange={() => setRole('artist')} />
                  <strong>Artiste</strong>
                  <span>Je publie et je vends mes créations</span>
                </label>
              </div>
            </fieldset>
          )}

          <label className="field">
            <span>Adresse e-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </label>

          {!isLogin && (
            <label className="field">
              <span>{role === 'artist' ? "Nom d'artiste" : 'Nom affiché'}</span>
              <input required minLength={2} autoComplete="nickname" value={username} onChange={(e) => setUsername(e.target.value)} placeholder={role === 'artist' ? 'Comment vous signez vos œuvres' : 'Votre nom'} />
            </label>
          )}

          <label className="field">
            <span>Mot de passe</span>
            <div className="field__password">
              <input
                type={show ? 'text' : 'password'}
                required
                minLength={8}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="8 caractères minimum"
              />
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>{show ? 'Masquer' : 'Afficher'}</button>
            </div>
          </label>

          {error && <p className="form-error" role="alert">{error}</p>}

          <button type="submit" className="btn btn--primary btn--block" disabled={busy}>
            {busy ? (isLogin ? 'Connexion…' : 'Création du compte…') : isLogin ? 'Se connecter' : 'Créer mon compte'}
          </button>

          <p className="auth__switch">
            {isLogin ? 'Pas encore de compte ?' : 'Déjà inscrit ?'}{' '}
            <Link href={isLogin ? '/register' : '/login'}>{isLogin ? 'Créer un compte' : 'Se connecter'}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
