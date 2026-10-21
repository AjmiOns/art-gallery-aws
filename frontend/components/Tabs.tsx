'use client';

export type TabItem = { id: string; label: string; badge?: number };

export default function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (id: string) => void }) {
  return (
    <div className="tabs-bar" role="tablist">
      {items.map((t) => (
        <button key={t.id} type="button" role="tab" aria-selected={active === t.id} className={active === t.id ? 'is-active' : ''} onClick={() => onChange(t.id)}>
          {t.label}
          {!!t.badge && <span className="tabs-bar__badge">{t.badge}</span>}
        </button>
      ))}
    </div>
  );
}
