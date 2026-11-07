'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

// Préférence de l'utilisateur : clair, sombre, ou « système » (suit le réglage de l'appareil).
export type ThemePref = 'light' | 'dark' | 'system';
export type Theme = 'light' | 'dark';

export const THEME_KEY = 'gallery-theme';

// Exécuté dans <head> avant le premier affichage : évite le flash de thème clair au chargement.
export const THEME_INIT_SCRIPT = `(function(){try{var p=localStorage.getItem('${THEME_KEY}');var d=p==='dark'||((p!=='light')&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.dataset.theme=d?'dark':'light';}catch(e){document.documentElement.dataset.theme='light';}})();`;

type ThemeState = {
  pref: ThemePref;
  theme: Theme;
  setPref: (p: ThemePref) => void;
  toggle: () => void;
};

const ThemeContext = createContext<ThemeState>({ pref: 'system', theme: 'light', setPref: () => {}, toggle: () => {} });

const systemTheme = (): Theme =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [pref, setPrefState] = useState<ThemePref>('system');
  const [system, setSystem] = useState<Theme>('light');

  // Lecture des préférences une fois monté (le rendu serveur ne les connaît pas).
  useEffect(() => {
    setPrefState(readPref());
    setSystem(systemTheme());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const theme: Theme = pref === 'system' ? system : pref;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    try {
      if (p === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, p);
    } catch {
      /* stockage indisponible (navigation privée) : le choix vaut pour cette visite */
    }
  }, []);

  const toggle = useCallback(() => setPref(theme === 'dark' ? 'light' : 'dark'), [theme, setPref]);

  const value = useMemo(() => ({ pref, theme, setPref, toggle }), [pref, theme, setPref, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);
