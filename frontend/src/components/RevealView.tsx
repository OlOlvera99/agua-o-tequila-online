'use client';

import { useState, useEffect } from 'react';

export default function RevealView({ game }: { game: any }) {
  const { revealData, scoreboard, turnData, isHost } = game;
  const [showResult, setShowResult] = useState(false);
  const [showDrinkers, setShowDrinkers] = useState(false);
  const [showScoreboard, setShowScoreboard] = useState(false);
  const [countdown, setCountdown] = useState(3);

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

  if (!revealData || !turnData) return null;

  const reasonText: Record<string, string> = {
    all_correct: '¡Todos acertaron!',
    all_wrong: '¡Todos fallaron!',
    mixed: 'Hubo de todo',
  };

  const isTruth = revealData.truth;
  const resultColor = isTruth ? 'text-water-deep' : 'text-tequila-deep';
  const resultBgGradient = isTruth
    ? 'from-water-light/30 via-water/15 to-transparent'
    : 'from-tequila-light/40 via-tequila/20 to-transparent';

  if (!showResult) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <p className="text-ink-soft text-[11px] uppercase tracking-[0.2em] font-semibold mb-8">
          La respuesta es…
        </p>
        <div
          className="text-9xl font-black text-ink animate-countdown"
          key={countdown}
          style={{ textShadow: '0 8px 32px rgba(15,20,25,0.15)' }}
        >
          {countdown}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8 overflow-y-auto max-w-md mx-auto w-full">
      <div className="text-center mb-6 animate-fade-in">
        <p className={`text-[11px] uppercase tracking-[0.2em] font-bold mb-2 ${resultColor}`}>
          {isTruth ? 'Agua' : 'Tequila'}
        </p>
        <p className={`text-5xl font-black mb-4 ${resultColor}`}
           style={{ textShadow: '0 4px 24px rgba(15,20,25,0.12)' }}>
          {isTruth ? 'VERDAD' : 'MENTIRA'}
        </p>

        {revealData.imageBase64 && (
          <div className="w-full mb-4 rounded-2xl overflow-hidden shadow-xl border border-white/60">
            <img
              src={`data:image/png;base64,${revealData.imageBase64}`}
              alt="Escena"
              className="w-full aspect-square object-cover"
            />
          </div>
        )}

        <div className={`lg-card-sm p-4 bg-gradient-to-br ${resultBgGradient}`}>
          {revealData.type === 'interpersonal' && (
            <span className="text-[10px] uppercase tracking-[0.18em] text-water font-bold mb-1.5 block">
              Interpersonal
            </span>
          )}
          <p className="text-ink text-sm italic font-medium">
            “{revealData.affirmation}”
          </p>
        </div>
      </div>

      {showDrinkers && (
        <div className="animate-slide-up mb-4">
          <p className="text-center text-ink-soft text-sm mb-3 font-semibold">
            {reasonText[revealData.reason]}
          </p>

          <div className="lg-card mb-4">
            <p className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-3">
              Votos
            </p>
            <div className="space-y-1.5">
              {revealData.guesses.map((g: any) => (
                <div key={g.playerName} className="flex items-center justify-between py-1.5">
                  <span className="text-ink text-sm font-semibold">{g.playerName}</span>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-[11px] uppercase tracking-wider font-bold ${
                      g.guess === 'verdad' ? 'text-water-deep' : 'text-tequila-deep'
                    }`}>
                      {g.guess === 'verdad' ? 'Agua' : 'Tequila'}
                    </span>
                    <span className={`w-2 h-2 rounded-full ${
                      g.correct ? 'bg-water shadow-[0_0_8px_rgba(45,111,163,0.6)]' : 'bg-ink-hint'
                    }`} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-3xl p-6 text-center backdrop-blur-xl border ${
            revealData.drinkers.length > 0
              ? 'bg-gradient-to-br from-tequila-light/40 via-tequila/25 to-tequila-deep/15 border-tequila/30 shadow-[0_20px_60px_rgba(198,135,41,0.25)]'
              : 'bg-white/60 border-white/80 shadow-[0_8px_32px_rgba(15,20,25,0.06)]'
          }`}>
            <img
              src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
              alt=""
              className="w-16 mx-auto mb-3 shot-animation"
            />
            {revealData.drinkers.length > 0 ? (
              <>
                <p className="text-tequila-deep font-black text-base uppercase tracking-[0.15em] mb-2">
                  ¡Toman shot!
                </p>
                <p className="text-ink text-xl font-black">
                  {revealData.drinkers.join(', ')}
                </p>
              </>
            ) : (
              <p className="text-ink-soft text-sm font-semibold">Nadie toma esta ronda</p>
            )}
          </div>
        </div>
      )}

      {showScoreboard && scoreboard.length > 0 && (
        <div className="animate-slide-up lg-card mb-24">
          <p className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-3">
            Marcador
          </p>
          <div className="space-y-1.5">
            {scoreboard.map((s: any, i: number) => (
              <div key={s.playerName} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-ink-faint text-xs w-4 font-bold">{i + 1}.</span>
                  <span className="text-ink text-sm font-semibold">{s.playerName}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-water-deep text-xs font-bold">
                    {s.correctGuesses} aciertos
                  </span>
                  <span className="text-tequila-deep font-black text-sm">
                    {s.shotsTaken} shots
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showScoreboard && (
        <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-gradient-to-t from-paper via-paper/95 to-transparent">
          <div className="max-w-md mx-auto">
            {isHost ? (
              <button onClick={game.nextTurn} className="btn-water text-base">
                Siguiente turno
              </button>
            ) : (
              <p className="text-ink-soft text-sm text-center font-medium">
                Esperando al host para siguiente turno…
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
