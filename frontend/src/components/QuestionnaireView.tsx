'use client';

import { useMemo, useState } from 'react';
import { RELATION_BY_KEY, RelationType } from '@/hooks/useGameSocket';

export default function QuestionnaireView({ game }: { game: any }) {
  const players = game.roomState?.players || [];
  const settings = game.roomState?.settings;
  const relationType: RelationType = settings?.relationType || 'amigos_generico';
  const relation = RELATION_BY_KEY[relationType];

  const [gender, setGender] = useState<'hombre' | 'mujer' | 'otro'>('hombre');
  const [role, setRole] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);

  const needsRole = !!relation?.roles;
  const progress = game.questionnaireProgress || game.roomState?.questionnaireProgress;

  const handleSubmit = () => {
    if (needsRole && !role) return;
    game.submitProfile({ gender, role: needsRole ? role : undefined });
    setSubmitted(true);
  };

  // ═══════════ ESPERANDO A LOS DEMÁS ═══════════
  if (submitted) {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <img
          src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
          alt=""
          className="w-20 mb-4 liquid-float"
        />
        <h2 className="text-xl font-black text-ink mb-2">¡Listo!</h2>
        <p className="text-ink-soft text-sm text-center mb-6 font-medium">
          {progress && progress.ready < progress.total
            ? `Esperando a los demás (${progress.ready}/${progress.total})`
            : 'Todos listos'}
        </p>

        {progress && (
          <div className="flex gap-2 mb-8">
            {Array.from({ length: progress.total }).map((_, i) => (
              <div
                key={i}
                className={`w-2.5 h-2.5 rounded-full transition-all ${
                  i < progress.ready
                    ? 'bg-gradient-to-br from-water-light to-water-deep shadow-[0_2px_8px_rgba(45,111,163,0.4)]'
                    : 'bg-ink-hint'
                }`}
              />
            ))}
          </div>
        )}

        {game.isHost && progress && progress.ready >= progress.total && (
          <button onClick={game.startGame} className="btn-tequila text-base max-w-xs">
            Empezar partida
          </button>
        )}

        {game.isHost && progress && progress.ready < progress.total && (
          <button onClick={game.startGame} className="btn-tequila text-base max-w-xs opacity-60">
            Empezar sin esperar a todos
          </button>
        )}
      </div>
    );
  }

  // ═══════════ FORMULARIO ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <div className="text-center mb-6">
        <p className="text-water text-[11px] uppercase tracking-[0.2em] font-bold mb-2">
          {relation?.label || 'Cuestionario'}
        </p>
        <h2 className="text-xl font-black text-ink">Cuéntanos rápido</h2>
        <p className="text-ink-soft text-sm mt-1.5 font-medium">
          Solo necesitamos esto para personalizar las preguntas.
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto pb-32">
        {/* Género */}
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
            Tu género
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['hombre', 'mujer', 'otro'] as const).map(val => (
              <button
                key={val}
                onClick={() => setGender(val)}
                className={`seg ${gender === val ? 'seg-active' : ''}`}
              >
                {val.charAt(0).toUpperCase() + val.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Rol (si la relación es jerárquica) */}
        {needsRole && relation?.roles && (
          <div>
            <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
              Tu rol en la dinámica
            </label>
            <div className="grid grid-cols-2 gap-2">
              {relation.roles.map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`seg ${role === r ? 'seg-active' : ''}`}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="lg-card-sm p-4">
          <p className="text-ink-soft text-xs font-medium">
            <span className="text-water font-bold">Tipo elegido por el host:</span>{' '}
            {relation?.label}
          </p>
          {players.length > 0 && (
            <p className="text-ink-faint text-xs mt-2">
              Jugadores en la sala: {players.map((p: any) => p.name).join(', ')}
            </p>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-gradient-to-t from-paper via-paper/95 to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSubmit}
            disabled={needsRole && !role}
            className="btn-water text-base"
          >
            {needsRole && !role ? 'Elige tu rol primero' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  );
}
