'use client';

import Link from 'next/link';
import type { Role } from '@/lib/api';
import { useAuth } from './AuthProvider';

const LABEL: Record<Role, string> = { admin: 'administrateurs', artist: 'artistes', buyer: 'acheteurs' };

// Protège une page : connexion requise, puis rôle autorisé. (L'API vérifie aussi chaque requête.)
export default function RequireRole({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  if (!user) {
    return (
      <div className="page page--narrow">
        <div className="state">
          <p>Connectez-vous pour accéder à cette page.</p>
          <Link href="/login" className="btn btn--primary btn--sm">Se connecter</Link>
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page page--narrow">
        <div className="state">
          <p>Cette page est réservée aux {roles.map((r) => LABEL[r]).join(' et aux ')}.</p>
          {user.role === 'buyer' && roles.includes('artist') && (
            <p className="muted">Pour vendre vos œuvres, créez un compte artiste.</p>
          )}
          <Link href="/" className="btn btn--soft btn--sm">Retour à la galerie</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
