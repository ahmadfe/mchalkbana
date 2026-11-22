'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Moon, Sun } from 'lucide-react';
import clsx from 'clsx';
import { PORTAL_THEME_KEY as KEY } from '@/lib/portalTheme';

/*
 * Mörkt / ljust tema för admin, skolportalen och instruktörsappen.
 * Mörkt är standard. Valet sparas på enheten (localStorage) och sätts som <html data-portal-theme="light">;
 * färgerna för ljust tema finns i app/portal-light.css. Den publika webbplatsen påverkas aldrig.
 */

type Theme = 'dark' | 'light';
const EVENT = 'uh-portal-theme';
const BAR = { dark: '#161618', light: '#ffffff' };

function read(): Theme {
  try { return localStorage.getItem(KEY) === 'light' ? 'light' : 'dark'; } catch { return 'dark'; }
}

function apply(theme: Theme | null) {
  const html = document.documentElement;
  if (theme === 'light') html.dataset.portalTheme = 'light';
  else delete html.dataset.portalTheme;
  // Webbläsarens / appens titelrad
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach(m => { m.content = BAR[theme ?? 'dark']; });
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', cb); };
};

function useTheme(): Theme {
  return useSyncExternalStore(subscribe, read, () => 'dark');
}

/** Läggs i portalens ram: sätter temat medan portalen visas och tar bort det när man lämnar den */
export function PortalThemeRoot() {
  const theme = useTheme();
  useEffect(() => { apply(theme); }, [theme]);
  useEffect(() => () => {
    const html = document.documentElement;
    delete html.dataset.portalTheme;
    // Tillbaka till den publika sidans titelradsfärg sköts av Next vid nästa sidbyte
  }, []);
  return null;
}

/** Knapp ☀️/🌙 */
export function ThemeToggle({ iconOnly, className }: { iconOnly?: boolean; className?: string }) {
  const theme = useTheme();
  const next: Theme = theme === 'dark' ? 'light' : 'dark';
  const label = next === 'light' ? 'Ljust tema' : 'Mörkt tema';
  const Icon = next === 'light' ? Sun : Moon;

  const toggle = () => {
    try { localStorage.setItem(KEY, next); } catch { /* privat läge – gäller bara nu */ }
    apply(next);
    window.dispatchEvent(new Event(EVENT));
  };

  if (iconOnly) {
    return (
      <button onClick={toggle} title={label} aria-label={label} className={clsx('w-11 h-11 rounded-full text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center', className)}>
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </button>
    );
  }
  return (
    <button onClick={toggle} className={clsx('h-10 rounded-full border border-white/15 text-sm font-semibold text-white hover:bg-white/5 inline-flex items-center justify-center gap-2', className)}>
      <Icon className="w-4 h-4" strokeWidth={1.75} /> {label}
    </button>
  );
}
