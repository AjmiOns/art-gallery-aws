'use client';

import { Lang } from '@/lib/i18n';
import { useI18n } from './LanguageProvider';

const OPTIONS: { lang: Lang; label: string; name: string }[] = [
  { lang: 'fr', label: 'FR', name: 'Français' },
  { lang: 'en', label: 'EN', name: 'English' },
];

// Bouton de choix de la langue de la plateforme (pied de page et pages de connexion)
export default function LanguageSwitch() {
  const { lang, setLang } = useI18n();
  return (
    <div className="lang-switch" role="group" aria-label="Langue / Language">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" /></svg>
      {OPTIONS.map((o) => (
        <button key={o.lang} type="button" lang={o.lang} className={lang === o.lang ? 'is-active' : ''} aria-pressed={lang === o.lang} title={o.name} onClick={() => setLang(o.lang)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
