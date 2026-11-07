import { EN } from './en';

// Langues de la plateforme. Le français est la langue source : les textes du code sont en français et
// servent de clé de traduction (t('Mes œuvres')). Le dictionnaire anglais est dans lib/en.ts.
export type Lang = 'fr' | 'en';
export const LANGS: Lang[] = ['fr', 'en'];
export const LANG_KEY = 'gallery-lang';
export const LOCALES: Record<Lang, string> = { fr: 'fr-FR', en: 'en-GB' };

export type Vars = Record<string, string | number>;

// Langue active hors de React (formatage des dates et des prix, messages d'erreur de l'API).
// Le LanguageProvider la met à jour à chaque changement.
let active: Lang = 'fr';
export const getActiveLang = (): Lang => active;
export const setActiveLang = (l: Lang) => { active = l; };

const fill = (text: string, vars?: Vars) =>
  vars ? text.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m)) : text;

// Clés contenant des variables {x}, converties une fois en expressions régulières :
// elles servent à traduire les messages d'erreur de l'API, qui arrivent déjà remplis.
const escapeRe = (s: string) => s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
const PATTERNS = Object.keys(EN)
  // Les modèles trop génériques (ex. « {count} œuvres ») sont écartés : ils pourraient fausser un message sans rapport.
  .filter((k) => /\{\w+\}/.test(k) && k.replace(/\{\w+\}/g, '').length >= 14)
  .map((k) => {
    const names: string[] = [];
    const src = k.split(/(\{\w+\})/).map((part) => {
      const m = part.match(/^\{(\w+)\}$/);
      if (m) { names.push(m[1]); return '([\\s\\S]+?)'; }
      return escapeRe(part);
    }).join('');
    return { key: k, names, re: new RegExp(`^${src}$`) };
  });

// Traduit un texte source français. Sans traduction connue, le texte français est renvoyé tel quel.
export function translate(lang: Lang, key: string, vars?: Vars): string {
  if (lang === 'fr') return fill(key, vars);
  return fill(EN[key] ?? key, vars);
}

// Traduit un message venant du serveur (déjà rempli) : correspondance exacte, sinon par modèle.
export function translateServer(lang: Lang, message: string): string {
  if (lang === 'fr') return message;
  if (EN[message]) return EN[message];
  for (const p of PATTERNS) {
    const m = message.match(p.re);
    if (m) {
      const vars: Vars = {};
      p.names.forEach((n, i) => { vars[n] = EN[m[i + 1]] ?? m[i + 1]; });
      return fill(EN[p.key], vars);
    }
  }
  return message;
}

// Raccourci pour le code hors composants (ex. client API)
export const tr = (key: string, vars?: Vars) => translate(active, key, vars);
