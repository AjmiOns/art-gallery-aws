'use client';

import { useRouter } from 'next/navigation';
import ArtworkForm from '@/components/ArtworkForm';
import { useAuth } from '@/components/AuthProvider';
import RequireRole from '@/components/RequireRole';
import { useToast } from '@/components/Toast';

export default function SellPage() {
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  return (
    <RequireRole roles={['artist', 'admin']}>
      <div className="page page--narrow">
        <div className="panel">
          <h1>Publier une œuvre</h1>
          <p className="muted">Elle apparaîtra aussitôt dans la catégorie choisie.</p>
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
