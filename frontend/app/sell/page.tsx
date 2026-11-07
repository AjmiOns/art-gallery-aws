'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api, MySubscription } from '@/lib/api';
import ArtworkForm from '@/components/ArtworkForm';
import { useAuth } from '@/components/AuthProvider';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

export default function SellPage() {
  const router = useRouter();
  const toast = useToast();
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
          <h1>Publier une œuvre</h1>
          <p className="muted">Elle apparaîtra aussitôt dans la catégorie choisie.</p>
          {sub && sub.usage.max !== null && (
            <p className={`notice${full ? ' notice--warn' : ''}`}>
              {full
                ? <>Vous avez atteint la limite de {sub.usage.max} œuvres du plan {sub.plan.name}. <Link href="/pricing">Passer à un abonnement supérieur</Link> pour en publier d&apos;autres.</>
                : <>{sub.usage.online} / {sub.usage.max} œuvres en ligne avec le plan {sub.plan.name}.</>}
            </p>
          )}
          <ArtworkForm
            onSaved={() => {
              toast.show('Votre œuvre est en ligne.');
              router.push(user?.role === 'admin' ? '/admin' : '/artist');
            }}
          />
        </div>
      </div>
    </RequireRole>
  );
}
