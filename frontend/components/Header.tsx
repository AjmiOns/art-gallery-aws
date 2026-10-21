'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from './AuthProvider';
import Avatar from './Avatar';

const ROLE_LABEL = { admin: 'Administrateur', artist: 'Artiste', buyer: 'Acheteur' } as const;

export default function Header() {
  const { user, token, ready, signOut } = useAuth();
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  const [unread, setUnread] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMenu(false), [pathname]);

  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => !menuRef.current?.contains(e.target as Node) && setMenu(false);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menu]);

  // Pastille de messages non lus, rafraîchie régulièrement
  useEffect(() => {
    if (!token) {
      setUnread(0);
      return;
    }
    let stop = false;
    const load = () => api.unreadCount(token).then((r) => !stop && setUnread(r.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 20000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [token, pathname]);

  // Les pages de connexion et d'inscription ont leur propre mise en page plein écran.
  if (pathname === '/login' || pathname === '/register') return null;

  const link = (href: string, label: string, extra?: React.ReactNode) => (
    <Link href={href} className="nav-link" aria-current={pathname === href || (href !== '/' && pathname.startsWith(href)) ? 'page' : undefined}>
      {label}
      {extra}
    </Link>
  );

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
          {ready && user?.role === 'artist' && link('/artist', 'Espace artiste')}
          {ready && user?.role === 'admin' && link('/admin', 'Administration')}
          {ready && user && link('/messages', 'Messages', unread > 0 ? <span className="nav-badge" aria-label={`${unread} non lus`}>{unread}</span> : null)}

          {ready && user ? (
            <div className="menu" ref={menuRef}>
              <button type="button" className="menu__trigger" onClick={() => setMenu((m) => !m)} aria-expanded={menu} aria-haspopup="menu">
                <Avatar name={user.username} size={32} />
                <span className="who__name">{user.username}</span>
              </button>
              {menu && (
                <div className="menu__panel" role="menu">
                  <div className="menu__who">
                    <strong>{user.username}</strong>
                    <span>{ROLE_LABEL[user.role]}</span>
                  </div>
                  <Link href="/account" role="menuitem">Mon profil</Link>
                  {user.role !== 'admin' && <Link href="/orders" role="menuitem">Mes achats</Link>}
                  {user.role === 'artist' && <Link href="/artist" role="menuitem">Mes œuvres et demandes</Link>}
                  {user.role === 'admin' && <Link href="/admin" role="menuitem">Administration</Link>}
                  <button type="button" role="menuitem" onClick={signOut}>Se déconnecter</button>
                </div>
              )}
            </div>
          ) : (
            ready && (
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
            )
          )}
        </nav>
      </div>
    </header>
  );
}
