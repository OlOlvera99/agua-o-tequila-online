'use client';

export default function GuessingView({ game }: { game: any }) {
  const { turnData, isMyTurn, guessCount, hasSubmittedGuess } = game;

  if (!turnData) return null;

  // ═══════════ TU TURNO (esperando votos) ═══════════
  if (isMyTurn) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8">
        <div className="absolute top-5 right-5 text-ink-soft text-xs font-mono font-bold bg-white/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/80">
          Ronda {turnData.round}
        </div>

        <p className="text-ink-soft text-sm mb-3 font-medium">Los demás están adivinando…</p>

        {turnData.imageBase64 && (
          <div className="w-full max-w-sm mb-4 rounded-2xl overflow-hidden shadow-lg border border-white/60">
            <img
              src={`data:image/png;base64,${turnData.imageBase64}`}
              alt="Escena"
              className="w-full aspect-square object-cover"
            />
          </div>
        )}

        <div className="lg-hero w-full max-w-sm mb-6">
          <p className="text-ink text-lg font-bold text-center">
            “{turnData.affirmation}”
          </p>
        </div>

        <div className="lg-card w-full max-w-sm text-center">
          <p className="text-4xl font-black text-ink mb-1">
            <span className="text-water">{guessCount.voted}</span>
            <span className="text-ink-faint mx-1">/</span>
            <span>{guessCount.total}</span>
          </p>
          <p className="text-ink-soft text-sm font-medium">han votado</p>
        </div>
      </div>
    );
  }

  // ═══════════ YA VOTÉ (esperando reveal) ═══════════
  if (hasSubmittedGuess) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8">
        <div className="absolute top-5 right-5 text-ink-soft text-xs font-mono font-bold bg-white/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/80">
          Ronda {turnData.round}
        </div>

        <img
          src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
          alt=""
          className="w-16 mb-5 liquid-float"
        />
        <p className="text-ink font-black text-lg mb-1.5">Voto enviado</p>
        <p className="text-ink-soft text-sm text-center mb-6 font-medium">
          Esperando a los demás…
        </p>

        <div className="lg-card w-full max-w-xs text-center">
          <p className="text-3xl font-black text-ink mb-1">
            <span className="text-water">{guessCount.voted}</span>
            <span className="text-ink-faint mx-1">/</span>
            <span>{guessCount.total}</span>
          </p>
          <p className="text-ink-soft text-sm font-medium">han votado</p>
        </div>
      </div>
    );
  }

  // ═══════════ VOTANDO ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8">
      <div className="absolute top-5 right-5 text-ink-soft text-xs font-mono font-bold bg-white/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/80">
        Ronda {turnData.round}
      </div>

      <p className="text-ink-soft text-[11px] uppercase tracking-[0.18em] font-semibold mb-2">
        {turnData.currentPlayer} dice
      </p>

      {turnData.imageBase64 && (
        <div className="w-full max-w-sm mb-3 rounded-2xl overflow-hidden shadow-lg border border-white/60">
          <img
            src={`data:image/png;base64,${turnData.imageBase64}`}
            alt="Escena"
            className="w-full aspect-square object-cover"
          />
        </div>
      )}

      <div className="lg-hero w-full max-w-sm mb-6 animate-fade-in">
        {turnData.type === 'interpersonal' && (
          <span className="text-[10px] uppercase tracking-[0.18em] text-water font-bold mb-2 block">
            Interpersonal
          </span>
        )}
        <p className="text-ink text-xl font-bold text-center leading-relaxed">
          “{turnData.affirmation}”
        </p>
      </div>

      <p className="text-ink-soft text-sm mb-3 font-medium">¿Verdad o mentira?</p>
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        <button onClick={() => game.submitGuess('verdad')} className="vote-truth">
          <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Agua</span>
          <span>Verdad</span>
        </button>
        <button onClick={() => game.submitGuess('mentira')} className="vote-lie">
          <span className="text-[10px] uppercase tracking-[0.2em] opacity-80">Tequila</span>
          <span>Mentira</span>
        </button>
      </div>

      <p className="text-ink-faint text-xs mt-4 font-medium">
        {guessCount.voted}/{guessCount.total} han votado
      </p>
    </div>
  );
}
