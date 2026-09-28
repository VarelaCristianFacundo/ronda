'use client';

import { useEffect, useState } from 'react';

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/**
 * "Instalar Ronda": uses the browser's install prompt where available (Chromium/Android),
 * and explains the manual step on iOS Safari. Hidden when already installed.
 */
export function InstallHint() {
  const [standalone, setStandalone] = useState(true);
  const [ios, setIos] = useState(false);
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);

  useEffect(() => {
    // Environment detection has to happen after mount (no window during SSR).
    /* eslint-disable react-hooks/set-state-in-effect */
    setStandalone(window.matchMedia('(display-mode: standalone)').matches);
    setIos(/iPad|iPhone|iPod/.test(navigator.userAgent));
    /* eslint-enable react-hooks/set-state-in-effect */
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onPrompt);
  }, []);

  if (standalone) return null;
  return (
    <div className="note stack gap-10">
      <strong style={{ color: 'var(--ink)', fontSize: 15 }}>Tené Ronda en tu pantalla de inicio</strong>
      {prompt ? (
        <button
          type="button"
          className="btn btn-secondary btn-md"
          onClick={async () => {
            await prompt.prompt();
            setPrompt(null);
          }}
        >
          Instalar Ronda
        </button>
      ) : ios ? (
        <span>En Safari tocá Compartir y después “Agregar a inicio”.</span>
      ) : (
        <span>Desde el menú del navegador elegí “Instalar app” o “Agregar a la pantalla de inicio”.</span>
      )}
    </div>
  );
}
