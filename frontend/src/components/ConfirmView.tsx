'use client';

export default function ConfirmView({ game }: { game: any }) {
  const { turnData, isMyTurn, hasConfirmed } = game;

  if (!turnData) return null;

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
          <button onClick={() => game.confirmTruth(true)} className="vote-truth">
            <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Agua</span>
            <span>Verdad</span>
          </button>
          <button onClick={() => game.confirmTruth(false)} className="vote-lie">
            <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Tequila</span>
            <span>Mentira</span>
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
