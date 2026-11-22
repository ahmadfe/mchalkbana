// Genererar src/app/portal-light.css: ljust tema för admin / skola / instruktör.
// Läser alla färgklasser som används i portalerna och skriver en ljus motsvarighet för varje.
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const P = 'html[data-portal-theme="light"]';

const SRC = [
  'src/app/[locale]/admin', 'src/app/[locale]/school', 'src/app/[locale]/instruktor',
  'src/components/admin', 'src/components/school',
  'src/components/InstructorShell.tsx', 'src/components/NoteEdit.tsx', 'src/components/CheckInModal.tsx', 'src/components/pwa.tsx',
];
const files = [];
const walk = p => {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) return;
  if (fs.statSync(full).isDirectory()) for (const f of fs.readdirSync(full)) walk(path.join(p, f));
  else if (/\.(tsx|ts)$/.test(full)) files.push(full);
};
SRC.forEach(walk);

const VARIANTS = '(?:hover:|focus:|disabled:|group-hover:|active:|placeholder:)?';
const re = new RegExp(`(?<![\\w-])${VARIANTS}(text|bg|border|divide|placeholder|ring|accent)-(white|black|\\[#[0-9a-fA-F]{6}\\]|(?:red|rose|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink)-(?:200|300|400))(?:/(\\d+))?(?![\\w-])`, 'g');
const classes = new Set();
for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(re)) classes.add(m[0]);

const INK = '17 17 19'; // mörk text
// Mörka ytor → ljusa ytor
const SURFACE = {
  '0b0b0d': '#f3f3f5', // sidans bakgrund
  '111113': '#fafafa',
  '161618': '#ffffff', // meny
  '1c1c1f': '#ffffff', // kort
  '232327': '#ececef', // hover
  '26262a': '#f0f0f3', // fält / knappar
  '2a2a2e': '#e6e6ea',
  '2a2a2f': '#e6e6ea',
};
// Ljusa färgtoner (byggda för mörk bakgrund) → mörkare toner som syns på vitt
const HUE = {
  red: '#b91c1c', rose: '#be123c', orange: '#c2410c', amber: '#b45309', yellow: '#a16207', lime: '#4d7c0f', green: '#15803d',
  emerald: '#047857', teal: '#0f766e', cyan: '#0e7490', sky: '#0369a1', blue: '#1d4ed8', indigo: '#4338ca', violet: '#6d28d9',
  purple: '#7e22ce', fuchsia: '#a21caf', pink: '#be185d',
};

const inkAlpha = a => Math.min(1, a < 50 ? a / 100 + 0.1 : a / 100); // svag text lite starkare för läsbarhet
const lineAlpha = a => Math.min(1, a / 100 + 0.04);

function value(prop, color, alpha) {
  const a = alpha == null ? null : Number(alpha);
  if (color === 'white') {
    if (prop === 'text' || prop === 'placeholder') return a == null ? `rgb(${INK})` : `rgb(${INK} / ${inkAlpha(a).toFixed(2)})`;
    if (prop === 'bg') return a == null ? `rgb(${INK})` : a >= 80 ? `rgb(${INK} / ${(a / 100).toFixed(2)})` : `rgb(0 0 0 / ${(a / 100 * 0.7).toFixed(3)})`;
    if (prop === 'border' || prop === 'divide' || prop === 'ring') return a == null ? `rgb(${INK})` : `rgb(0 0 0 / ${lineAlpha(a).toFixed(2)})`;
    if (prop === 'accent') return `rgb(${INK})`;
  }
  if (color === 'black') {
    if (prop === 'text') return a == null ? '#ffffff' : `rgb(255 255 255 / ${(a / 100).toFixed(2)})`;
    return null; // svarta skuggor/överlägg behålls
  }
  const hex = color.match(/^\[#([0-9a-fA-F]{6})\]$/);
  if (hex) {
    const s = SURFACE[hex[1].toLowerCase()];
    if (!s || prop !== 'bg') return null;
    if (a == null) return s;
    const [r, g, b] = [1, 3, 5].map(i => parseInt(s.slice(i, i + 2), 16));
    return `rgb(${r} ${g} ${b} / ${(a / 100).toFixed(2)})`;
  }
  const [hue] = color.split('-');
  if (HUE[hue] && (prop === 'text' || prop === 'border' || prop === 'ring')) {
    if (a == null || prop === 'text') return HUE[hue];
    const [r, g, b] = [1, 3, 5].map(i => parseInt(HUE[hue].slice(i, i + 2), 16));
    return `rgb(${r} ${g} ${b} / ${(a / 100).toFixed(2)})`;
  }
  return null;
}

const esc = c => c.replace(/([:/\[\]#.])/g, '\\$1');
const PROPERTY = { text: 'color', bg: 'background-color', border: 'border-color', placeholder: 'color', accent: 'accent-color' };

const base = [], states = [];
for (const c of [...classes].sort()) {
  const m = c.match(/^(hover:|focus:|disabled:|group-hover:|active:|placeholder:)?(text|bg|border|divide|placeholder|ring|accent)-(.+?)(?:\/(\d+))?$/);
  if (!m) continue;
  const [, variant, prop, color, alpha] = m;
  const v = value(prop, color, alpha);
  if (!v) continue;
  const sel = '.' + esc(c);
  let rule;
  if (prop === 'divide') rule = `${P} ${sel} > :not([hidden]) ~ :not([hidden]) { border-color: ${v}; }`;
  else if (prop === 'ring') rule = `${P} ${sel}${variant === 'focus:' ? ':focus' : ''} { --tw-ring-color: ${v}; }`;
  else if (prop === 'placeholder' || variant === 'placeholder:') rule = `${P} ${sel}::placeholder { color: ${v}; }`;
  else if (variant === 'hover:') rule = `${P} ${sel}:hover { ${PROPERTY[prop]}: ${v}; }`;
  else if (variant === 'focus:') rule = `${P} ${sel}:focus { ${PROPERTY[prop]}: ${v}; }`;
  else if (variant === 'active:') rule = `${P} ${sel}:active { ${PROPERTY[prop]}: ${v}; }`;
  else if (variant === 'disabled:') rule = `${P} ${sel}:disabled { ${PROPERTY[prop]}: ${v}; }`;
  else if (variant === 'group-hover:') rule = `${P} .group:hover ${sel} { ${PROPERTY[prop]}: ${v}; }`;
  else rule = `${P} ${sel} { ${PROPERTY[prop]}: ${v}; }`;
  (variant && variant !== 'placeholder:' ? states : base).push(rule);
}

const header = `/*
 * LJUST TEMA för admin, skolportalen och instruktörsappen (knappen ☀️/🌙 i menyn).
 * GENERERAD fil – portalerna är byggda mörka; här byts varje mörk färgklass mot en ljus motsvarighet
 * när <html data-portal-theme="light">. Den publika webbplatsen påverkas aldrig.
 * Nya färgklasser i portalerna: kör: node scripts/gen-portal-light.cjs . eller lägg till en regel för hand.
 */
`;
const extra = `
/* Fasta delar */
${P} { color-scheme: light; }
${P} body { background-color: #f3f3f5; }
${P} .status-bar-shim { background: #ffffff !important; }
${P} .admin-dark { color: rgb(${INK}); }
${P} input[type='checkbox'], ${P} input[type='radio'], ${P} input[type='date'], ${P} input[type='time'], ${P} input[type='datetime-local'], ${P} select { color-scheme: light; }
${P} select option { background-color: #ffffff; color: rgb(${INK}); }
${P} .admin-old .input-field { background-color: #ffffff; border-color: rgb(0 0 0 / 0.14); color: rgb(${INK}); }
${P} .admin-old .input-field::placeholder { color: rgb(${INK} / 0.4); }
${P} .admin-old .input-field:focus { --tw-ring-color: rgb(0 0 0 / 0.2); }
${P} .admin-old .input-field:disabled { background-color: rgb(0 0 0 / 0.04); color: rgb(${INK} / 0.5); }
${P} .admin-old .btn-outline { border-color: rgb(0 0 0 / 0.2); color: rgb(${INK}); }
${P} .admin-old .btn-outline:hover { background-color: rgb(0 0 0 / 0.05); }
${P} .admin-old .card { background-color: #ffffff; border-color: rgb(0 0 0 / 0.08); }
${P} .admin-old .btn-primary, ${P} .admin-old .btn-secondary { --tw-ring-offset-color: #f3f3f5; }
/* Kort och menyer får en lätt skugga i stället för mörk kontrast */
${P} .bg-\\[\\#1c1c1f\\] { box-shadow: 0 1px 2px rgb(0 0 0 / 0.05); }
/* Element som alltid ska vara ljusa (t.ex. logotypen) */
${P} .theme-keep { background-color: #ffffff !important; color: #111113 !important; }
`;
const out = header + '\n/* Grundfärger */\n' + base.join('\n') + '\n\n/* Hover / fokus / aktiv */\n' + states.join('\n') + '\n' + extra;
fs.writeFileSync(path.join(root, 'src/app/portal-light.css'), out);
console.log('files', files.length, 'classes', classes.size, 'rules', base.length + states.length);
