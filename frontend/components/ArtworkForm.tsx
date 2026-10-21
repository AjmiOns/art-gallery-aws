'use client';

import { useState } from 'react';
import { api, Artwork, CURRENCY } from '@/lib/api';
import { BUILTIN_LIBRARY } from '@/lib/categories';
import ArtImage from './ArtImage';
import { useAuth } from './AuthProvider';
import { useCategories } from './CategoriesProvider';

const LIBRARY = Array.from({ length: 18 }, (_, i) => String(i + 1).padStart(2, '0'));

type Props = { initial?: Artwork; onSaved: (a: Artwork) => void; onCancel?: () => void };

// Formulaire commun à la publication et à la modification d'une œuvre
export default function ArtworkForm({ initial, onSaved, onCancel }: Props) {
  const { token } = useAuth();
  const { categories } = useCategories();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [slug, setSlug] = useState(initial?.tags[0] ?? categories[0]?.slug ?? 'painting');
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl ?? '');
  const [price, setPrice] = useState(initial ? String(initial.price) : '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const priceLocked = !!initial && initial.status !== 'available';

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !token) return;
    if (file.size > 5 * 1024 * 1024) return setError('Image trop lourde : 5 Mo maximum.');
    setError('');
    setUploading(true);
    try {
      setImageUrl((await api.uploadImage(file, token)).url);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (!imageUrl) return setError('Ajoutez une image : envoyez un fichier, choisissez-en une ou collez un lien.');
    setError('');
    setBusy(true);
    try {
      const body = { title, imageUrl, tags: [slug], price: Number(price) };
      onSaved(initial ? await api.updateArtwork(initial.id, body, token) : await api.createArtwork(body, token));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form-stack" onSubmit={submit}>
      <label className="field">
        <span>Titre</span>
        <input required maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Horizon d'automne" />
      </label>

      <fieldset className="field">
        <legend>Catégorie</legend>
        <div className="chips">
          {categories.map((c) => (
            <button key={c.slug} type="button" data-tone={c.tone} className={`chip chip--cat${slug === c.slug ? ' is-active' : ''}`} aria-pressed={slug === c.slug} onClick={() => setSlug(c.slug)}>
              {c.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="field">
        <legend>Image</legend>
        <div className="image-pick">
          <div className="image-pick__preview">
            {imageUrl ? <ArtImage key={imageUrl} src={imageUrl} alt="Aperçu de l'œuvre" eager /> : <span>Aperçu</span>}
          </div>
          <div className="image-pick__side">
            <label className="btn btn--soft btn--sm file-btn">
              {uploading ? 'Envoi…' : 'Envoyer une image'}
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onFile} disabled={uploading} />
            </label>
            <small className="muted">JPG, PNG ou WebP, 5 Mo maximum.</small>
            <input type="text" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="ou collez un lien (https://…)" aria-label="Lien de l'image" />
          </div>
        </div>
        {BUILTIN_LIBRARY.includes(slug) && (
          <>
            <small className="muted">Ou choisissez dans la bibliothèque :</small>
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
          </>
        )}
      </fieldset>

      <label className="field">
        <span>Prix ({CURRENCY})</span>
        <input type="number" min="0" step="0.01" required disabled={priceLocked} value={price} onChange={(e) => setPrice(e.target.value)} placeholder="120" />
        {priceLocked && <small className="muted">Le prix d&apos;une œuvre réservée ou vendue ne peut plus être modifié.</small>}
      </label>

      {error && <p className="form-error" role="alert">{error}</p>}
      <div className="row-actions">
        <button type="submit" className="btn btn--primary" disabled={busy || uploading}>
          {busy ? 'Enregistrement…' : initial ? 'Enregistrer' : 'Publier'}
        </button>
        {onCancel && <button type="button" className="btn btn--ghost" onClick={onCancel}>Annuler</button>}
      </div>
    </form>
  );
}
