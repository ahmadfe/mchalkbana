'use client';

import { useEffect, useState } from 'react';
import { Download, Share, SquarePlus, X } from 'lucide-react';
import clsx from 'clsx';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Webbläsaren skickar installationserbjudandet bara en gång, ofta innan knappen hunnit visas – spara det här.
let deferred: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(l => l());

/** Registrerar service workern och fångar installationserbjudandet. Ligger i rotlayouten. */
export function PwaSetup() {
  useEffect(() => {
    const onPrompt = (e: Event) => { e.preventDefault(); deferred = e as InstallPromptEvent; notify(); };
    const onInstalled = () => { deferred = null; notify(); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);
  return null;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true;

// iPadOS säger att den är en Mac – känn igen den på pekskärmen
const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** "Installera appen" – visas bara när appen går att installera och inte redan körs som app. */
export function InstallAppButton({ dark = false, className }: { dark?: boolean; className?: string }) {
  const [mode, setMode] = useState<'hidden' | 'prompt' | 'ios'>('hidden');
  const [showSteps, setShowSteps] = useState(false);

  useEffect(() => {
    const update = () => {
      if (isStandalone()) setMode('hidden');
      else if (deferred) setMode('prompt');
      else setMode(isIos() ? 'ios' : 'hidden');
    };
    update();
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  if (mode === 'hidden') return null;

  const install = async () => {
    if (mode === 'ios') { setShowSteps(true); return; }
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null;
    notify();
  };

  return (
    <>
      <button
        type="button"
        onClick={install}
        className={clsx(
          'h-10 px-4 rounded-full text-sm font-semibold inline-flex items-center justify-center gap-2',
          dark ? 'bg-white/10 text-white hover:bg-white/15' : 'bg-gray-900 text-white hover:bg-gray-800',
          className,
        )}
      >
        <Download className="w-4 h-4" strokeWidth={1.75} /> Installera appen
      </button>

      {showSteps && (
        <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4" onClick={() => setShowSteps(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Installera appen"
            onClick={e => e.stopPropagation()}
            className="w-full sm:max-w-sm bg-white text-gray-900 rounded-t-3xl sm:rounded-3xl p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <img src="/icons/icon-192.png" alt="" className="w-12 h-12 rounded-xl border border-gray-100" />
                <div>
                  <p className="font-bold">Uppsala Halkbana</p>
                  <p className="text-sm text-gray-500">Lägg appen på hemskärmen</p>
                </div>
              </div>
              <button onClick={() => setShowSteps(false)} aria-label="Stäng" className="w-10 h-10 -mr-2 -mt-1 rounded-full hover:bg-gray-100 flex items-center justify-center">
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="mt-5 space-y-4 text-[15px]">
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><Share className="w-5 h-5 text-blue-600" /></span>
                <span>Tryck på <strong>Dela</strong> i Safari</span>
              </li>
              <li className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center shrink-0"><SquarePlus className="w-5 h-5" /></span>
                <span>Välj <strong>Lägg till på hemskärmen</strong></span>
              </li>
            </ol>
            <p className="text-sm text-gray-500 mt-5">Appen öppnas i helskärm och tar dig direkt till din portal. Du loggar in en gång i appen.</p>
          </div>
        </div>
      )}
    </>
  );
}
