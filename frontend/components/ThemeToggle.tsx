'use client';

import { useEffect, useState } from 'react';
import { useI18n } from './LanguageProvider';
import { useTheme } from './ThemeProvider';

const Sun = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </svg>
);
const Moon = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </svg>
);

// Bouton de bascule clair / sombre. Il est inactif jusqu'au montage pour éviter un écart d'hydratation.
export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const { t } = useI18n();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && theme === 'dark';
  const label = dark ? t('Passer au mode clair') : t('Passer au mode sombre');
  return (
    <button type="button" className="round theme-toggle" onClick={toggle} aria-label={label} title={label} aria-pressed={dark}>
      {dark ? <Sun /> : <Moon />}
    </button>
  );
}
