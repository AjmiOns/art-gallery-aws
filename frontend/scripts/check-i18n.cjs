// Vérifie que chaque texte traduisible du code a une entrée dans lib/en.ts.
// Usage : npm run check:i18n  (depuis frontend/). Code de sortie 1 s'il manque des traductions.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const backend = path.join(root, '..', 'backend', 'src');

const unq = (raw) => {
  let v = raw.slice(1, -1);
  if (raw[0] === "'") v = v.replace(/\\'/g, "'");
  if (raw[0] === '"') v = v.replace(/\\"/g, '"');
  return v.replace(/\\n/g, '\n');
};
const walk = (dir, out = []) => {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, f.name);
    if (f.isDirectory()) { if (!['node_modules', '.next', 'out', 'dist'].includes(f.name)) walk(p, out); }
    else if (/\.tsx?$/.test(f.name)) out.push(p);
  }
  return out;
};
const STR = String.raw`('(?:[^'\\]|\\.)*'|"(?:[^"\\]|\\.)*"|` + '`(?:[^`\\\\$]|\\\\.)*`)';

// 1. Textes passés à t('…') / tr('…') dans le frontend, y compris les deux branches d'un « cond ? 'a' : 'b' »
const keys = new Map(); // clé -> fichier
const skip = /(lib[\\/]en\.ts|lib[\\/]i18n\.ts|LanguageProvider\.tsx)$/;
for (const dir of ['app', 'components', 'lib']) {
  for (const file of walk(path.join(root, dir))) {
    if (skip.test(file)) continue;
    const src = fs.readFileSync(file, 'utf8');
    const direct = new RegExp(String.raw`(?<![\w.$])(?:t|tr)\(\s*` + STR, 'g');
    const ternary = new RegExp(String.raw`(?<![\w.$])(?:t|tr)\(\s*[^'"` + '`' + String.raw`()]+\?\s*` + STR + String.raw`\s*:\s*` + STR, 'g');
    let m;
    while ((m = direct.exec(src))) keys.set(unq(m[1]), file);
    while ((m = ternary.exec(src))) { keys.set(unq(m[1]), file); keys.set(unq(m[2]), file); }
  }
}

// 2. Libellés définis dans des constantes puis traduits à l'affichage : t(LABELS[status]), t(label)…
const constFiles = ['components/StatusBadge.tsx', 'components/Header.tsx', 'app/account/page.tsx', 'app/messages/page.tsx', 'components/admin/AdminUsers.tsx',
  'components/RequireRole.tsx', 'components/admin/AdminStats.tsx', 'app/admin/page.tsx', 'app/orders/page.tsx', 'app/artist/page.tsx', 'lib/categories.ts'];
for (const f of constFiles) {
  const src = fs.readFileSync(path.join(root, f), 'utf8');
  const re = new RegExp(String.raw`(?:\b[a-z]\w*|'[\w-]+'|\[)\s*[:,]\s*` + STR + '|\\[\\s*' + STR + '\\s*,\\s*' + STR, 'g');
  let m;
  while ((m = re.exec(src))) for (const g of m.slice(1)) if (g && /[A-Za-zÀ-ÿ]{3}/.test(g) && /\s|[A-ZÀ-Ý]/.test(g.slice(1, 2) + g.slice(1, 3))) keys.set(unq(g), f);
}
// Onglets et libellés d'en-tête
for (const lab of ['Statistiques', 'Utilisateurs', 'Œuvres', 'Commandes', 'Catégories', 'Mes œuvres', "Demandes d'achat", 'Abonnement', 'Tarifs', 'Espace artiste', 'Administration', 'Messages',
  'À traiter', 'Acceptées, en attente de paiement', 'Historique', 'À payer', "En attente de l'artiste", 'administrateurs', 'artistes', 'acheteurs']) keys.set(lab, 'libellés');

// 3. Plans (envoyés en français par l'API)
const plans = fs.readFileSync(path.join(backend, 'subscriptions', 'plans.ts'), 'utf8');
for (const m of plans.matchAll(new RegExp(String.raw`(?:name|tagline):\s*` + STR, 'g'))) keys.set(unq(m[1]), 'plans.ts');
for (const block of plans.matchAll(/perks:\s*\[([\s\S]*?)\]/g)) for (const m of block[1].matchAll(new RegExp(STR, 'g'))) keys.set(unq(m[1]), 'plans.ts');

// 4. Messages d'erreur de l'API (hors gabarits avec variables, vérifiés à la main)
for (const file of walk(backend)) {
  const src = fs.readFileSync(file, 'utf8');
  const re = new RegExp(String.raw`(?:Exception|HttpException)\(\s*` + STR + '|message:\\s*' + STR + String.raw`|^\s+'\d{10,}':\s*` + STR, 'gm');
  let m;
  while ((m = re.exec(src))) {
    const raw = m[1] || m[2] || m[3];
    if (raw && !raw.includes('${')) keys.set(unq(raw), path.relative(backend, file));
  }
}

// Clés du dictionnaire anglais
const en = fs.readFileSync(path.join(root, 'lib', 'en.ts'), 'utf8');
const have = new Set([...en.matchAll(/^\s{2}("(?:[^"\\]|\\.)*"):/gm)].map((m) => JSON.parse(m[1])));

const missing = [...keys.entries()].filter(([k]) => !have.has(k) && /[A-Za-zÀ-ÿ]{2}/.test(k));
const unused = [...have].filter((k) => !keys.has(k));
if (process.argv.includes('--unused') && unused.length) console.log(`Clés non repérées dans le code (${unused.length}) :\n  ${unused.join('\n  ')}`);
if (missing.length) {
  console.error(`Traductions manquantes (${missing.length}) :`);
  for (const [k, f] of missing) console.error(`  ${JSON.stringify(k)}  (${path.relative(root, f)})`);
  process.exit(1);
}
console.log(`i18n : ${keys.size} textes vérifiés, aucune traduction manquante.`);
