'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';

const SAMPLES = ['/artworks/painting/painting-08.jpg', '/artworks/digital/digital-13.jpg', '/artworks/wall-art/wall-art-02.jpg'];

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const router = useRouter();
  const { session, ready, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const isLogin = mode === 'login';

  useEffect(() => {
    if (ready && session) router.replace('/');
  }, [ready, session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const s = isLogin ? await api.login({ email, password }) : await api.register({ email, username, password });
      signIn(s);
      router.push('/');
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
              ? 'Retrouvez vos œuvres, vos achats et les nouveautés de vos artistes préférés.'
              : 'Publiez vos créations, fixez votre prix et vendez-les à une communauté de passionnés.'}
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
        <form className="auth__card" onSubmit={submit} noValidate={false}>
          <div className="tabs" role="tablist" aria-label="Connexion ou inscription">
            <Link href="/login" role="tab" aria-selected={isLogin} className={isLogin ? 'is-active' : ''}>
              Connexion
            </Link>
            <Link href="/register" role="tab" aria-selected={!isLogin} className={!isLogin ? 'is-active' : ''}>
              Inscription
            </Link>
          </div>

          <h2>{isLogin ? 'Se connecter' : 'Créer un compte'}</h2>

          <label className="field">
            <span>Adresse e-mail</span>
            <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@exemple.com" />
          </label>

          {!isLogin && (
            <label className="field">
              <span>Nom d&apos;artiste</span>
              <input required minLength={2} autoComplete="nickname" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="Comment vous signez vos œuvres" />
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
              <button type="button" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                {show ? 'Masquer' : 'Afficher'}
              </button>
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
