'use client';

import { useEffect, useState } from 'react';

export default function ConfirmView({ game }: { game: any }) {
  const { turnData, isMyTurn, hasConfirmed } = game;
  const [preparingDone, setPreparingDone] = useState(false);
  const [prepareElapsed, setPrepareElapsed] = useState(0);

  const PREPARE_SECONDS = 30; // dale tiempo a la primera generación de Gemini

  // Solo aplica al primer turno de toda la partida
  const needsPreparing = turnData?.round === 1 && !preparingDone;

  useEffect(() => {
    if (!needsPreparing) return;
    setPrepareElapsed(0);
    const t = setInterval(() => {
      setPrepareElapsed(prev => {
        const next = prev + 1;
        if (next >= PREPARE_SECONDS) {
          clearInterval(t);
          setPreparingDone(true);
        }
        return next;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [needsPreparing]);

  // Si la imagen llegó antes de los 30s, también terminamos preparing
  useEffect(() => {
    if (needsPreparing && turnData?.imageBase64) {
      setPreparingDone(true);
    }
  }, [needsPreparing, turnData?.imageBase64]);

  if (!turnData) return null;

  // ═══════════ PREPARING (solo round 1) ═══════════
  if (needsPreparing) {
    const pct = Math.min(100, (prepareElapsed / PREPARE_SECONDS) * 100);
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <img
          src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
          alt=""
          className="w-24 mb-6 liquid-float"
        />
        <p className="text-ink-soft text-[11px] uppercase tracking-[0.2em] font-semibold mb-3">
          Preparando partida
        </p>
        <h2 className="text-2xl font-black text-ink mb-2 text-center">
          Calentando motores…
        </h2>
        <p className="text-ink-soft text-sm text-center max-w-xs mb-8 font-medium">
          Generando la primera escena con la cara de {turnData.currentPlayer}.
          Esto tarda unos segundos solo la primera vez.
        </p>
        <div className="w-full max-w-xs h-2 bg-ink-hint/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-water-light via-water to-water-deep transition-all duration-1000 ease-linear"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-ink-faint text-xs mt-3 font-mono">
          {Math.max(0, PREPARE_SECONDS - prepareElapsed)}s
        </p>
      </div>
    );
  }

  if (isMyTurn) {
    if (hasConfirmed) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
          <img
            src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
            alt=""
            className="w-16 mb-5 liquid-float"
          />
          <p className="text-ink font-black text-lg mb-1.5">Respuesta guardada</p>
          <p className="text-ink-soft text-sm text-center font-medium max-w-xs">
            Los demás están viendo la afirmación y votando…
          </p>
          <div className="mt-5 flex gap-1.5">
            <div className="w-2 h-2 rounded-full bg-water animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-water animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-2 h-2 rounded-full bg-water animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8">
        <div className="absolute top-5 right-5 text-ink-soft text-xs font-mono font-bold bg-white/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/80">
          Ronda {turnData.round}
        </div>

        <p className="text-ink-soft text-[11px] uppercase tracking-[0.2em] font-semibold mb-2">
          Es tu turno
        </p>

        {turnData.imageBase64 && (
          <div className="w-full max-w-sm mb-4 rounded-2xl overflow-hidden shadow-lg border border-white/60">
            <img
              src={`data:image/png;base64,${turnData.imageBase64}`}
              alt="Escena"
              className="w-full aspect-square object-cover"
            />
          </div>
        )}

        <div className="lg-hero w-full max-w-sm mb-8 animate-fade-in">
          {turnData.type === 'interpersonal' && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-water font-bold mb-2 block">
              Interpersonal
            </span>
          )}
          <p className="text-ink text-xl font-bold text-center leading-relaxed">
            “{turnData.affirmation}”
          </p>
        </div>

        <p className="text-ink-soft text-sm mb-4 font-medium">¿Esto es verdad sobre ti?</p>

        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          <button onClick={() => game.confirmTruth(true)} className="vote-yes">
            <span>Sí</span>
          </button>
          <button onClick={() => game.confirmTruth(false)} className="vote-no">
            <span>No</span>
          </button>
        </div>

        <p className="text-ink-faint text-xs mt-4 text-center">
          Solo tú y el servidor saben tu respuesta
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <div className="absolute top-5 right-5 text-ink-soft text-xs font-mono font-bold bg-white/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/80">
        Ronda {turnData.round}
      </div>

      <img
        src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
        alt=""
        className="w-20 mb-4 animate-pulse-slow"
      />
      <p className="text-ink font-black text-xl mb-1">{turnData.currentPlayer}</p>
      <p className="text-ink-soft text-sm text-center font-medium">
        está leyendo la afirmación…
      </p>
      <div className="mt-6 flex gap-1.5">
        <div className="w-2 h-2 rounded-full bg-water animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-water animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-water animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
