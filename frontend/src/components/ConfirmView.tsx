'use client';

export default function ConfirmView({ game }: { game: any }) {
  const { turnData, isMyTurn, hasConfirmed } = game;

  if (!turnData) return null;

  // ═══════════ SOY EL DEL TURNO → VEO LA AFIRMACIÓN ═══════════
  if (isMyTurn) {
    if (hasConfirmed) {
      return (
        <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
          <div className="text-5xl mb-4">🤫</div>
          <p className="text-gold font-bold text-lg mb-2">Respuesta guardada</p>
          <p className="text-gray-400 text-sm text-center">
            Los demás están viendo la afirmación y votando...
          </p>
          <div className="mt-4 flex gap-1">
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        {/* Round counter */}
        <div className="absolute top-6 right-6 text-gray-500 text-sm font-mono">
          Ronda {turnData.round}
        </div>

        <p className="text-gray-400 text-sm uppercase tracking-widest mb-2">Es tu turno</p>
        <div className="text-4xl mb-6">👀</div>

        {/* Affirmation card */}
        <div className="glass-card w-full max-w-sm mb-8 animate-fade-in">
          {turnData.type === 'interpersonal' && (
            <span className="text-xs text-gold/60 uppercase tracking-wider mb-2 block">Interpersonal</span>
          )}
          <p className="text-white text-xl font-bold text-center leading-relaxed">
            "{turnData.affirmation}"
          </p>
        </div>

        {/* Question */}
        <p className="text-gray-300 text-sm mb-4">¿Esto es verdad sobre ti?</p>

        {/* Truth/Lie buttons */}
        <div className="w-full max-w-sm grid grid-cols-2 gap-3">
          <button
            onClick={() => game.confirmTruth(true)}
            className="py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-lg transition-all active:scale-95"
          >
            ✅ Sí, verdad
          </button>
          <button
            onClick={() => game.confirmTruth(false)}
            className="py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-lg transition-all active:scale-95"
          >
            ❌ No, mentira
          </button>
        </div>

        <p className="text-gray-600 text-xs mt-4 text-center">
          Solo tú y el servidor saben tu respuesta
        </p>
      </div>
    );
  }

  // ═══════════ NO SOY DEL TURNO → ESPERANDO ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <div className="absolute top-6 right-6 text-gray-500 text-sm font-mono">
        Ronda {turnData.round}
      </div>

      <div className="text-5xl mb-4 animate-pulse-slow">🤔</div>
      <p className="text-gold font-bold text-xl mb-2">{turnData.currentPlayer}</p>
      <p className="text-gray-400 text-sm text-center">
        está leyendo la afirmación...
      </p>
      <div className="mt-6 flex gap-1">
        <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
        <div className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: '200ms' }} />
        <div className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: '400ms' }} />
      </div>
    </div>
  );
}
