'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, CURRENCY } from '@/lib/api';
import { CATEGORIES, CategoryId } from '@/lib/categories';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import ArtImage from '@/components/ArtImage';

const LIBRARY = Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0'));

export default function SellPage() {
  const router = useRouter();
  const toast = useToast();
  const { session, ready } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CategoryId>('painting');
  const [imageUrl, setImageUrl] = useState('');
  const [price, setPrice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!ready) return null;
  if (!session) {
    return (
      <div className="page page--narrow">
        <div className="state">
          <p>Connectez-vous pour publier une œuvre.</p>
          <Link href="/login" className="btn btn--primary btn--sm">
            Se connecter
          </Link>
        </div>
      </div>
    );
  }

  const slug = CATEGORIES.find((c) => c.id === category)!.slug;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!imageUrl) {
      setError('Choisissez une image dans la bibliothèque ou collez un lien.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.createArtwork({ title, imageUrl, tags: [category], price: Number(price) }, session!.accessToken);
      toast.show('Votre œuvre est en ligne.');
      router.push('/');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page page--narrow">
      <form className="sell" onSubmit={submit}>
        <h1>Publier une œuvre</h1>
        <p className="muted">Elle apparaîtra aussitôt dans la catégorie choisie.</p>

        <label className="field">
          <span>Titre</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Horizon d'automne" />
        </label>

        <fieldset className="field">
          <legend>Catégorie</legend>
          <div className="chips">
            {CATEGORIES.map((c) => (
              <button key={c.id} type="button" data-cat={c.slug} className={`chip chip--cat${category === c.id ? ' is-active' : ''}`} aria-pressed={category === c.id} onClick={() => setCategory(c.id)}>
                {c.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Image</legend>
          <div className="library" role="listbox" aria-label="Bibliothèque d'images">
            {LIBRARY.map((n) => {
              const src = `/artworks/${slug}/${slug}-${n}.jpg`;
              return (
                <button key={src} type="button" role="option" aria-selected={imageUrl === src} className={`library__item${imageUrl === src ? ' is-active' : ''}`} onClick={() => setImageUrl(src)}>
                  <ArtImage src={src} alt={`Image ${n}`} />
                </button>
              );
            })}
          </div>
          <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="ou collez un lien d'image (https://…)" aria-label="Lien de l'image" />
        </fieldset>

        <label className="field">
          <span>Prix ({CURRENCY})</span>
          <input type="number" min="0" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120" />
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={busy}>
          {busy ? 'Publication…' : 'Publier'}
        </button>
      </form>
    </div>
  );
}
