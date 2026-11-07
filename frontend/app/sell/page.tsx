'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, MySubscription } from '@/lib/api';
import ArtworkForm from '@/components/ArtworkForm';
import { useAuth } from '@/components/AuthProvider';
import { useI18n } from '@/components/LanguageProvider';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

export default function SellPage() {
  const router = useRouter();
  const toast = useToast();
  const { t } = useI18n();
  const { user, token } = useAuth();
  const [sub, setSub] = useState<MySubscription | null>(null);
  useEffect(() => {
    if (token && user?.role === 'artist') api.mySubscription(token).then(setSub).catch(() => setSub(null));
  }, [token, user?.role]);
  const full = !!sub && sub.usage.max !== null && sub.usage.online >= sub.usage.max;
  return (
    <RequireRole roles={['artist', 'admin']}>
      <div className="page page--narrow">
        <div className="panel">
          <h1>{t('Publier une œuvre')}</h1>
          <p className="muted">{t('Elle apparaîtra aussitôt dans la catégorie choisie.')}</p>
          {sub && sub.usage.max !== null && (
            <p className={`notice${full ? ' notice--warn' : ''}`}>
              {full
                ? <>{t('Vous avez atteint la limite de {max} œuvres du plan {plan}.', { max: sub.usage.max, plan: t(sub.plan.name) })} <Link href="/pricing">{t('Passer à un abonnement supérieur')}</Link> {t("pour en publier d'autres.")}</>
                : <>{t('{online} / {max} œuvres en ligne avec le plan {plan}.', { online: sub.usage.online, max: sub.usage.max, plan: t(sub.plan.name) })}</>}
            </p>
          )}
          <ArtworkForm
            onSaved={() => {
              toast.show(t('Votre œuvre est en ligne.'));
              router.push(user?.role === 'admin' ? '/admin' : '/artist');
            }}
          />
        </div>
      </div>
    </RequireRole>
  );
}
