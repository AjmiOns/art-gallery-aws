'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Category, TONES } from '@/lib/categories';
import { useAuth } from '../AuthProvider';
import { useCategories } from '../CategoriesProvider';
import Modal from '../Modal';
import { useToast } from '../Toast';

function TonePicker({ value, onChange }: { value: string; onChange: (t: string) => void }) {
  return (
    <div className="tone-picker" role="group" aria-label="Couleur">
      {TONES.map((t) => (
        <button key={t} type="button" data-tone={t} className={value === t ? 'is-active' : ''} aria-pressed={value === t} aria-label={t} onClick={() => onChange(t)} />
      ))}
    </div>
  );
}

const slugify = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export default function AdminCategories() {
  const { token } = useAuth();
  const { refresh } = useCategories();
  const toast = useToast();
  const [items, setItems] = useState<Category[]>([]);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState({ label: '', slug: '', tagline: '', tone: 'pink' });
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ label: '', tagline: '', tone: 'lavender', sortOrder: 0, isActive: true });

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setItems(await api.adminCategories(token));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);
  useEffect(() => { load(); }, [load]);

  const changed = () => { load(); refresh(); };

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!token) return;
    try {
      await api.adminCreateCategory({ ...draft, slug: draft.slug || slugify(draft.label) }, token);
      toast.show('Catégorie créée.');
      setDraft({ label: '', slug: '', tagline: '', tone: 'pink' });
      changed();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  }

  function edit(c: Category) {
    setEditing(c);
    setForm({ label: c.label, tagline: c.tagline, tone: c.tone, sortOrder: c.sortOrder, isActive: c.isActive });
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!token || !editing) return;
    try {
      await api.adminUpdateCategory(editing.id, form, token);
      toast.show('Catégorie mise à jour.');
      setEditing(null);
      changed();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  }

  async function toggle(c: Category) {
    if (!token) return;
    try {
      await api.adminUpdateCategory(c.id, { isActive: !c.isActive }, token);
      changed();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  }

  async function remove(c: Category) {
    if (!token || !window.confirm(`Supprimer la catégorie « ${c.label} » ?`)) return;
    try {
      await api.adminDeleteCategory(c.id, token);
      toast.show('Catégorie supprimée.');
      changed();
    } catch (err) {
      toast.show((err as Error).message, 'error');
    }
  }

  return (
    <div className="admin-grid admin-grid--cats">
      <form className="panel form-stack" onSubmit={create}>
        <h2>Nouvelle catégorie</h2>
        <label className="field"><span>Nom</span><input required minLength={2} maxLength={60} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} placeholder="Ex. Art urbain" /></label>
        <label className="field"><span>Identifiant (slug)</span><input pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={(e) => setDraft({ ...draft, slug: e.target.value })} placeholder={slugify(draft.label) || 'art-urbain'} /><small className="muted">Généré depuis le nom si laissé vide. Non modifiable ensuite.</small></label>
        <label className="field"><span>Description courte</span><input maxLength={120} value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} placeholder="Graffiti, pochoirs et fresques" /></label>
        <div className="field"><span>Couleur</span><TonePicker value={draft.tone} onChange={(tone) => setDraft({ ...draft, tone })} /></div>
        <div className="row-actions"><button type="submit" className="btn btn--primary">Créer la catégorie</button></div>
      </form>

      <div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Ordre</th><th>Catégorie</th><th>Identifiant</th><th>Statut</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {items.map((c) => (
                <tr key={c.id}>
                  <td>{c.sortOrder}</td>
                  <td><div className="cell-art"><span className="swatch" data-tone={c.tone} /><div><strong>{c.label}</strong><br /><small className="muted">{c.tagline}</small></div></div></td>
                  <td><code>{c.slug}</code></td>
                  <td><span className={`status ${c.isActive ? 'status--paid' : 'status--cancelled'}`}>{c.isActive ? 'Active' : 'Désactivée'}</span></td>
                  <td className="cell-actions">
                    <button type="button" className="btn btn--soft btn--sm" onClick={() => edit(c)}>Modifier</button>
                    <button type="button" className="btn btn--ghost btn--sm" onClick={() => toggle(c)}>{c.isActive ? 'Désactiver' : 'Activer'}</button>
                    <button type="button" className="btn btn--ghost btn--sm btn--danger" onClick={() => remove(c)}>Supprimer</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!editing} onClose={() => setEditing(null)} title={`Modifier ${editing?.label ?? ''}`}>
        <form className="form-stack" onSubmit={save}>
          <label className="field"><span>Nom</span><input required minLength={2} value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} /></label>
          <label className="field"><span>Description courte</span><input maxLength={120} value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} /></label>
          <div className="field"><span>Couleur</span><TonePicker value={form.tone} onChange={(tone) => setForm({ ...form, tone })} /></div>
          <div className="form-grid">
            <label className="field"><span>Ordre d&apos;affichage</span><input type="number" min={0} value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })} /></label>
            <label className="field field--check"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /><span>Catégorie active</span></label>
          </div>
          <div className="row-actions"><button type="submit" className="btn btn--primary">Enregistrer</button><button type="button" className="btn btn--ghost" onClick={() => setEditing(null)}>Annuler</button></div>
        </form>
      </Modal>
    </div>
  );
}
