'use client';

import { useEffect, useState } from 'react';

const MAX_SECONDS = 40; // bound visual; el server avanza cuando tenga imagen lista

export default function StartingView() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setElapsed(e => Math.min(e + 1, MAX_SECONDS)), 1000);
    return () => clearInterval(t);
  }, []);

  // Asíntota: avanza rápido al inicio, lento cerca del final (nunca llega al 100 hasta que el server avance)
  const pct = Math.min(95, 100 * (1 - Math.exp(-elapsed / 12)));

  return (
    <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <img
        src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
        alt=""
        className="w-24 mb-6 liquid-float"
      />
      <p className="text-ink-soft text-[11px] uppercase tracking-[0.2em] font-semibold mb-3">
        Preparando partida
      </p>
      <h2 className="text-2xl font-black text-ink mb-6 text-center">
        Cargando el juego…
      </h2>
      <div className="w-full max-w-xs h-2 bg-ink-hint/30 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-water-light via-water to-water-deep transition-all duration-1000 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-ink-faint text-xs mt-3 font-medium">
        Esto solo pasa una vez al iniciar.
      </p>
    </main>
  );
}
