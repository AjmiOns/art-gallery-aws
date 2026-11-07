'use client';

import Link from 'next/link';
import type { Role } from '@/lib/api';
import { useAuth } from './AuthProvider';
import { useI18n } from './LanguageProvider';

const LABEL: Record<Role, string> = { admin: 'administrateurs', artist: 'artistes', buyer: 'acheteurs' };

// Protège une page : connexion requise, puis rôle autorisé. (L'API vérifie aussi chaque requête.)
export default function RequireRole({ roles, children }: { roles?: Role[]; children: React.ReactNode }) {
  const { user, ready } = useAuth();
  const { t } = useI18n();
  if (!ready) return null;
  if (!user) {
    return (
      <div className="page page--narrow">
        <div className="state">
          <p>{t('Connectez-vous pour accéder à cette page.')}</p>
          <Link href="/login" className="btn btn--primary btn--sm">{t('Se connecter')}</Link>
        </div>
      </div>
    );
  }
  if (roles && !roles.includes(user.role)) {
    return (
      <div className="page page--narrow">
        <div className="state">
          <p>{t('Cette page est réservée aux {roles}.', { roles: roles.map((r) => t(LABEL[r])).join(t(' et aux ')) })}</p>
          {user.role === 'buyer' && roles.includes('artist') && (
            <p className="muted">{t('Pour vendre vos œuvres, créez un compte artiste.')}</p>
          )}
          <Link href="/" className="btn btn--soft btn--sm">{t('Retour à la galerie')}</Link>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
