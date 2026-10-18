'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from './AuthProvider';
import Avatar from './Avatar';

export default function Header() {
  const { session, ready, signOut } = useAuth();
  const pathname = usePathname();
  // Les pages de connexion et d'inscription ont leur propre mise en page plein écran.
  if (pathname === '/login' || pathname === '/register') return null;

  const loggedIn = ready && !!session;
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link href="/" className="brand">
          <span className="brand__mark" aria-hidden="true" />
          Galerie d&apos;art
        </Link>
        <nav aria-label="Navigation principale">
          <Link href="/" className="nav-link nav-link--optional" aria-current={pathname === '/' ? 'page' : undefined}>
            Œuvres
          </Link>
          <Link
            href="/sell"
            className={`nav-link${loggedIn ? '' : ' nav-link--optional'}`}
            aria-current={pathname === '/sell' ? 'page' : undefined}
          >
            Vendre
          </Link>
          {loggedIn && session ? (
            <>
              <span className="who">
                <Avatar name={session.user.username} size={30} />
                <span className="who__name">{session.user.username}</span>
              </span>
              <button type="button" className="btn btn--ghost btn--sm" onClick={signOut}>
                Se déconnecter
              </button>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn--ghost btn--sm">
                <span className="wide">Se connecter</span>
                <span className="narrow">Connexion</span>
              </Link>
              <Link href="/register" className="btn btn--primary btn--sm">
                <span className="wide">Créer un compte</span>
                <span className="narrow">S&apos;inscrire</span>
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
