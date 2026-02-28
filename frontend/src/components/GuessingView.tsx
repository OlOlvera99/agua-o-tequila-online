'use client';

import { useState, useEffect } from 'react';

export default function GuessingView({ game }: { game: any }) {
  const { turnData, isMyTurn, guessCount, hasSubmittedGuess } = game;
  const [timeLeft, setTimeLeft] = useState(30);

  // 30s countdown
  useEffect(() => {
    setTimeLeft(30);
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [turnData?.round]);

  if (!turnData) return null;

  const timerColor = timeLeft > 15 ? 'text-white' : timeLeft > 5 ? 'text-yellow-400' : 'text-red-400';
  const timerBarWidth = (timeLeft / 30) * 100;

  // ═══════════ SOY EL DEL TURNO → VEO CÓMO VOTAN ═══════════
  if (isMyTurn) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <div className="absolute top-6 right-6 text-gray-500 text-sm font-mono">
          Ronda {turnData.round}
        </div>

        {/* Timer bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
          <div
            className="h-full bg-gold transition-all duration-1000 ease-linear"
            style={{ width: `${timerBarWidth}%` }}
          />
        </div>

        <div className="text-5xl mb-4">😬</div>
        <p className="text-gray-400 text-sm mb-2">Los demás están adivinando...</p>

        {/* Affirmation */}
        <div className="glass-card w-full max-w-sm mb-6">
          <p className="text-white text-lg font-bold text-center">
            "{turnData.affirmation}"
          </p>
        </div>

        {/* Vote count */}
        <div className="glass-card w-full max-w-sm text-center">
          <p className="text-3xl font-black text-gold mb-1">
            {guessCount.voted}/{guessCount.total}
          </p>
          <p className="text-gray-400 text-sm">han votado</p>
        </div>

        {/* Timer */}
        <p className={`mt-4 font-mono text-2xl font-bold ${timerColor}`}>
          {timeLeft}s
        </p>
      </div>
    );
  }

  // ═══════════ YA VOTÉ → ESPERANDO ═══════════
  if (hasSubmittedGuess) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <div className="absolute top-6 right-6 text-gray-500 text-sm font-mono">
          Ronda {turnData.round}
        </div>

        {/* Timer bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
          <div
            className="h-full bg-gold transition-all duration-1000 ease-linear"
            style={{ width: `${timerBarWidth}%` }}
          />
        </div>

        <div className="text-5xl mb-4">✅</div>
        <p className="text-gold font-bold text-lg mb-2">Voto enviado</p>
        <p className="text-gray-400 text-sm text-center mb-6">
          Esperando a los demás...
        </p>

        <div className="glass-card w-full max-w-xs text-center">
          <p className="text-2xl font-black text-gold mb-1">
            {guessCount.voted}/{guessCount.total}
          </p>
          <p className="text-gray-400 text-sm">han votado</p>
        </div>

        <p className={`mt-4 font-mono text-lg ${timerColor}`}>
          {timeLeft}s
        </p>
      </div>
    );
  }

  // ═══════════ VOTANDO ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <div className="absolute top-6 right-6 text-gray-500 text-sm font-mono">
        Ronda {turnData.round}
      </div>

      {/* Timer bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
        <div
          className="h-full bg-gold transition-all duration-1000 ease-linear"
          style={{ width: `${timerBarWidth}%` }}
        />
      </div>

      {/* Player name */}
      <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">
        {turnData.currentPlayer} dice:
      </p>

      {/* Affirmation card */}
      <div className="glass-card w-full max-w-sm mb-6 animate-fade-in">
        {turnData.type === 'interpersonal' && (
          <span className="text-xs text-gold/60 uppercase tracking-wider mb-2 block">Interpersonal</span>
        )}
        <p className="text-white text-xl font-bold text-center leading-relaxed">
          "{turnData.affirmation}"
        </p>
      </div>

      {/* Timer big */}
      <p className={`font-mono text-4xl font-black mb-6 ${timerColor} ${timeLeft <= 5 ? 'animate-pulse' : ''}`}>
        {timeLeft}s
      </p>

      {/* Vote buttons */}
      <p className="text-gray-300 text-sm mb-3">¿Verdad o mentira?</p>
      <div className="w-full max-w-sm grid grid-cols-2 gap-3">
        <button
          onClick={() => game.submitGuess('verdad')}
          className="py-5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xl transition-all active:scale-95 shadow-lg shadow-emerald-900/30"
        >
          ✅ Verdad
        </button>
        <button
          onClick={() => game.submitGuess('mentira')}
          className="py-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xl transition-all active:scale-95 shadow-lg shadow-red-900/30"
        >
          ❌ Mentira
        </button>
      </div>

      {/* Vote count */}
      <p className="text-gray-500 text-xs mt-4">
        {guessCount.voted}/{guessCount.total} han votado
      </p>
    </div>
  );
}
