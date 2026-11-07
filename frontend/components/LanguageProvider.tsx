'use client';

import { createContext, Fragment, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Lang, LANG_KEY, LANGS, setActiveLang, translate, Vars } from '@/lib/i18n';

type LangState = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: string, vars?: Vars) => string;
};

const LanguageContext = createContext<LangState>({ lang: 'fr', setLang: () => {}, t: (k, v) => translate('fr', k, v) });

// Langue de départ : choix mémorisé, sinon langue du navigateur (français si elle commence par « fr »), sinon anglais.
function initialLang(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (saved === 'fr' || saved === 'en') return saved;
  } catch {
    /* stockage indisponible */
  }
  return typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en';
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('fr');
  setActiveLang(lang);

  // Le rendu serveur est en français : la langue réelle est lue une fois la page chargée.
  useEffect(() => setLangState(initialLang()), []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((l: Lang) => {
    if (!LANGS.includes(l)) return;
    setActiveLang(l);
    setLangState(l);
    try {
      localStorage.setItem(LANG_KEY, l);
    } catch {
      /* le choix vaut pour cette visite */
    }
  }, []);

  const t = useCallback((key: string, vars?: Vars) => translate(lang, key, vars), [lang]);
  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export const useI18n = () => useContext(LanguageContext);

// Remonte l'interface à chaque changement de langue, pour que les dates, prix et textes calculés
// (formatés hors React) soient tous recalculés. Les données déjà chargées (catégories, session) sont conservées.
export function LangBoundary({ children }: { children: React.ReactNode }) {
  const { lang } = useI18n();
  return <Fragment key={lang}>{children}</Fragment>;
}
