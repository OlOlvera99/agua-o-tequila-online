'use client';

import { useState } from 'react';
import { GROUP_VIBE_OPTIONS, GroupVibe } from '@/hooks/useGameSocket';

export default function LobbyView({ game }: { game: any }) {
  const [copied, setCopied] = useState(false);
  const [editingVibe, setEditingVibe] = useState(false);

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}?room=${game.roomId}`
    : '';

  const copyCode = () => {
    navigator.clipboard?.writeText(game.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareLink = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Agua o Tequila',
        text: '¡Únete a jugar!',
        url: shareUrl,
      });
    } else {
      navigator.clipboard?.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const players = game.roomState?.players || [];
  const settings = game.roomState?.settings;

  const levelLabel = settings?.level === 'suave' ? 'Suave'
    : settings?.level === 'picante' ? 'Picante'
    : settings?.level === 'extrema' ? 'Extrema'
    : '';

  const vibeLabel = GROUP_VIBE_OPTIONS.find(g => g.key === settings?.groupVibe)?.label || '';

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <div className="text-center mb-6">
        <img
          src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
          alt=""
          className="w-14 mx-auto mb-3"
        />
        <p className="text-ink-soft text-[11px] uppercase tracking-[0.2em] font-semibold mb-2">
          Sala
        </p>
        <button
          onClick={copyCode}
          className="text-3xl font-black text-ink font-mono tracking-[0.15em] hover:text-water transition"
        >
          {game.roomId}
        </button>
        <p className="text-ink-faint text-xs mt-1">
          {copied ? 'Copiado' : 'Toca para copiar'}
        </p>
      </div>

      <button onClick={shareLink} className="btn-ghost mb-6">
        Compartir link de invitación
      </button>

      {settings && (
        <>
          <div className="lg-card-sm px-5 py-3.5 mb-3 flex items-center justify-between">
            <span className="text-ink-soft text-sm font-medium">Nivel</span>
            <span className="font-bold text-ink">{levelLabel}</span>
          </div>

          <div className="lg-card-sm px-5 py-3.5 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-ink-soft text-sm font-medium">Tipo de grupo</span>
              {game.isHost ? (
                <button
                  onClick={() => setEditingVibe(v => !v)}
                  className="text-water text-xs font-bold uppercase tracking-wider"
                >
                  {editingVibe ? 'Cerrar' : 'Cambiar'}
                </button>
              ) : null}
            </div>
            {!editingVibe && (
              <span className="font-bold text-ink block mt-1">{vibeLabel}</span>
            )}
            {editingVibe && game.isHost && (
              <select
                value={settings.groupVibe}
                onChange={e => game.updateSettings({ groupVibe: e.target.value as GroupVibe })}
                className="lg-input mt-2 text-sm"
              >
                {GROUP_VIBE_OPTIONS.map(o => (
                  <option key={o.key} value={o.key}>{o.label}</option>
                ))}
              </select>
            )}
          </div>
        </>
      )}

      <div className="lg-card mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-ink-soft text-sm font-medium">Jugadores</span>
          <span className="text-water font-black">{players.length}/12</span>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {players.map((p: any, i: number) => {
            const isMe = p.socketId === game.mySocketId;
            return (
              <div
                key={p.socketId}
                className="flex items-center justify-between py-2.5 px-3.5 bg-white/65 backdrop-blur-md rounded-xl border border-white/80 animate-slide-up"
                style={{ animationDelay: `${i * 50}ms` }}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${p.isHost ? 'bg-tequila' : 'bg-water'}`} />
                  <span className={`font-semibold text-sm ${isMe ? 'text-water-deep' : 'text-ink'}`}>
                    {p.name}{isMe && ' (tú)'}
                  </span>
                </div>
                {p.isHost && (
                  <span className="text-[10px] uppercase tracking-wider text-tequila-deep bg-tequila/15 px-2 py-0.5 rounded-full font-bold">
                    host
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {players.length < 2 && (
          <p className="text-ink-faint text-xs text-center mt-4">
            Necesitas al menos 2 jugadores para empezar
          </p>
        )}
      </div>

      {game.isHost && (
        <button
          onClick={game.startGame}
          disabled={players.length < 2}
          className="btn-tequila text-base"
        >
          {players.length < 2 ? 'Esperando jugadores…' : '¡A jugar!'}
        </button>
      )}

      {!game.isHost && (
        <div className="text-center py-4">
          <p className="text-ink-soft text-sm font-medium">Esperando a que el host inicie…</p>
          <div className="mt-3 flex justify-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-water animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-water animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-2 h-2 rounded-full bg-water animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}
