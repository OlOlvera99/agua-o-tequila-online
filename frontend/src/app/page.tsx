'use client';

import { useGameSocket } from '@/hooks/useGameSocket';
import LandingView from '@/components/LandingView';
import LobbyView from '@/components/LobbyView';
import QuestionnaireView from '@/components/QuestionnaireView';
import ConfirmView from '@/components/ConfirmView';
import GuessingView from '@/components/GuessingView';
import RevealView from '@/components/RevealView';

export default function Home() {
  const game = useGameSocket();

  // Connection indicator
  if (!game.connected) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-900 px-6">
        <div className="text-4xl mb-4 animate-pulse-slow">🥃</div>
        <p className="text-gray-400 text-sm">Conectando...</p>
      </div>
    );
  }

  // Loading AI generation
  if (game.isGenerating) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-gray-900 px-6">
        <div className="text-5xl mb-4 animate-pulse-slow">🧠</div>
        <p className="text-gold font-bold text-lg mb-2">Generando preguntas...</p>
        <p className="text-gray-400 text-sm text-center">
          La IA está creando afirmaciones personalizadas para tu grupo
        </p>
      </div>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-gray-900">
      {game.phase === 'landing' && <LandingView game={game} />}
      {game.phase === 'lobby' && <LobbyView game={game} />}
      {game.phase === 'questionnaire' && <QuestionnaireView game={game} />}
      {game.phase === 'confirming' && <ConfirmView game={game} />}
      {game.phase === 'guessing' && <GuessingView game={game} />}
      {game.phase === 'reveal' && <RevealView game={game} />}
    </main>
  );
}
