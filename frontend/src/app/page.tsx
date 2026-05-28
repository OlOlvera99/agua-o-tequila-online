'use client';

import { useGameSocket } from '@/hooks/useGameSocket';
import LandingView from '@/components/LandingView';
import LobbyView from '@/components/LobbyView';
import QuestionnaireView from '@/components/QuestionnaireView';
import StartingView from '@/components/StartingView';
import ConfirmView from '@/components/ConfirmView';
import GuessingView from '@/components/GuessingView';
import RevealView from '@/components/RevealView';

export default function Home() {
  const game = useGameSocket();

  if (!game.connected) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <img
          src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
          alt=""
          className="w-24 mb-6 liquid-float"
        />
        <p className="text-ink-soft text-sm font-medium">Conectando…</p>
      </main>
    );
  }

  if (game.isGenerating) {
    return (
      <main className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <img
          src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
          alt=""
          className="w-28 mb-6 liquid-float"
        />
        <p className="text-ink font-bold text-lg mb-2">Generando preguntas…</p>
        <p className="text-ink-soft text-sm text-center max-w-xs">
          La IA está creando afirmaciones personalizadas para tu grupo
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh]">
      {game.phase === 'landing' && <LandingView game={game} />}
      {game.phase === 'lobby' && <LobbyView game={game} />}
      {game.phase === 'questionnaire' && <QuestionnaireView game={game} />}
      {game.phase === 'starting' && <StartingView />}
      {game.phase === 'confirming' && <ConfirmView game={game} />}
      {game.phase === 'guessing' && <GuessingView game={game} />}
      {game.phase === 'reveal' && <RevealView game={game} />}
    </main>
  );
}
