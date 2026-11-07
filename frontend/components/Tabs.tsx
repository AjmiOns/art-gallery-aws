'use client';

import { useI18n } from './LanguageProvider';

export type TabItem = { id: string; label: string; badge?: number };

export default function Tabs({ items, active, onChange }: { items: TabItem[]; active: string; onChange: (id: string) => void }) {
  const { t } = useI18n();
  return (
    <div className="tabs-bar" role="tablist">
      {items.map((tab) => (
        <button key={tab.id} type="button" role="tab" aria-selected={active === tab.id} className={active === tab.id ? 'is-active' : ''} onClick={() => onChange(tab.id)}>
          {t(tab.label)}
          {!!tab.badge && <span className="tabs-bar__badge">{tab.badge}</span>}
        </button>
      ))}
    </div>
  );
}
