'use client';

import { useState, useEffect } from 'react';

export default function RevealView({ game }: { game: any }) {
  const { revealData, scoreboard, turnData, isHost } = game;
  const [showResult, setShowResult] = useState(false);
  const [showDrinkers, setShowDrinkers] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const [autoTimer, setAutoTimer] = useState(10);

  // Countdown animation: 3...2...1...REVEAL
  useEffect(() => {
    setShowResult(false);
    setShowDrinkers(false);
    setShowScoreboard(false);
    setCountdown(3);

    const cd = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(cd);
          setShowResult(true);
          setTimeout(() => setShowDrinkers(true), 800);
          setTimeout(() => setShowScoreboard(true), 1600);
          return 0;
        }
        return prev - 1;
      });
    }, 700);

    return () => clearInterval(cd);
  }, [revealData]);

  // Auto-advance timer (10s after full reveal)
  useEffect(() => {
    if (!showScoreboard) return;
    setAutoTimer(10);
    const timer = setInterval(() => {
      setAutoTimer(prev => {
        if (prev <= 1) { clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showScoreboard]);

  if (!revealData || !turnData) return null;

  const reasonText: Record<string, string> = {
    all_correct: '¡Todos acertaron! 😱',
    all_wrong: '¡Todos fallaron! 😂',
    mixed: 'Hubo de todo',
  };

  // ═══════════ COUNTDOWN ═══════════
  if (!showResult) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <p className="text-gray-400 text-sm uppercase tracking-widest mb-6">La respuesta es...</p>
        <div className="text-8xl font-black text-gold animate-countdown" key={countdown}>
          {countdown}
        </div>
      </div>
    );
  }

  // ═══════════ FULL REVEAL ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8 overflow-y-auto">
      {/* Auto-advance bar */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800">
        <div
          className="h-full bg-gold transition-all duration-1000 ease-linear"
          style={{ width: `${(autoTimer / 10) * 100}%` }}
        />
      </div>

      {/* Truth/Lie result */}
      <div className="text-center mb-6 animate-fade-in">
        <div className="text-6xl mb-3">
          {revealData.truth ? '✅' : '❌'}
        </div>
        <p className="text-3xl font-black text-white mb-1">
          {revealData.truth ? 'VERDAD' : 'MENTIRA'}
        </p>
        <div className="glass-card mt-3">
          {revealData.type === 'interpersonal' && (
            <span className="text-xs text-gold/60 uppercase tracking-wider mb-1 block">Interpersonal</span>
          )}
          <p className="text-gray-300 text-sm italic">
            "{revealData.affirmation}"
          </p>
        </div>
      </div>

      {/* Who guessed what */}
      {showDrinkers && (
        <div className="animate-slide-up mb-4">
          {/* Reason */}
          <p className="text-center text-gray-400 text-sm mb-3">
            {reasonText[revealData.reason]}
          </p>

          {/* Guesses list */}
          <div className="glass-card mb-4">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Votos</p>
            <div className="space-y-2">
              {revealData.guesses.map((g: any) => (
                <div key={g.playerName} className="flex items-center justify-between py-1.5">
                  <span className="text-white text-sm">{g.playerName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {g.guess === 'verdad' ? '✅ Verdad' : '❌ Mentira'}
                    </span>
                    <span className={`text-lg ${g.correct ? '' : ''}`}>
                      {g.correct ? '🎯' : '💀'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* DRINKERS - the money shot */}
          <div className={`rounded-2xl p-5 text-center ${
            revealData.drinkers.length > 0
              ? 'bg-gradient-to-b from-amber-900/40 to-amber-950/40 border border-gold/20'
              : 'glass-card'
          }`}>
            <p className="text-4xl mb-2 shot-animation">🥃</p>
            {revealData.drinkers.length > 0 ? (
              <>
                <p className="text-gold font-black text-lg mb-1">¡TOMAN SHOT!</p>
                <p className="text-white text-xl font-bold">
                  {revealData.drinkers.join(', ')}
                </p>
              </>
            ) : (
              <p className="text-gray-400 text-sm">Nadie toma esta ronda</p>
            )}
          </div>
        </div>
      )}

      {/* Scoreboard */}
      {showScoreboard && scoreboard.length > 0 && (
        <div className="animate-slide-up glass-card mb-20">
          <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">Marcador</p>
          <div className="space-y-2">
            {scoreboard.map((s: any, i: number) => (
              <div key={s.playerName} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 text-xs w-4">{i + 1}.</span>
                  <span className="text-white text-sm font-medium">{s.playerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-xs">🎯 {s.correctGuesses}</span>
                  <span className="text-gold font-bold text-sm">🥃 {s.shotsTaken}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual advance (host) / auto timer */}
      {showScoreboard && (
        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-900 via-gray-900">
          {isHost ? (
            <button onClick={game.nextTurn} className="btn-gold w-full text-lg">
              Siguiente turno →
            </button>
          ) : (
            <p className="text-gray-500 text-sm text-center">
              Siguiente turno en {autoTimer}s...
            </p>
          )}
        </div>
      )}
    </div>
  );
}
