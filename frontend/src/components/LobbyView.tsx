'use client';

import { useState } from 'react';

export default function LobbyView({ game }: { game: any }) {
  const [copied, setCopied] = useState(false);

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
        title: 'Agua o Tequila 🥃',
        text: `Únete a mi sala: ${game.roomId}`,
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

  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8">
      {/* Header */}
      <div className="text-center mb-6">
        <p className="text-gray-400 text-xs uppercase tracking-widest mb-1">Sala</p>
        <button
          onClick={copyCode}
          className="text-3xl font-black text-gold font-mono tracking-widest hover:text-gold-light transition"
        >
          {game.roomId}
        </button>
        <p className="text-gray-500 text-xs mt-1">
          {copied ? '✅ Copiado' : 'Toca para copiar'}
        </p>
      </div>

      {/* Share button */}
      <button
        onClick={shareLink}
        className="w-full py-3 rounded-xl bg-gray-800 border border-gray-700 text-white font-bold mb-6 hover:border-gold transition active:scale-95"
      >
        📤 Compartir link de invitación
      </button>

      {/* Level */}
      {settings && (
        <div className="glass-card mb-4 flex items-center justify-between">
          <span className="text-gray-400 text-sm">Nivel</span>
          <span className="font-bold">
            {settings.level === 'suave' && '🟢 Suave'}
            {settings.level === 'picante' && '🟡 Picante'}
            {settings.level === 'extrema' && '🔴 Extrema'}
          </span>
        </div>
      )}

      {/* Players */}
      <div className="glass-card mb-6">
        <div className="flex justify-between items-center mb-3">
          <span className="text-gray-400 text-sm">Jugadores</span>
          <span className="text-gold font-bold">{players.length}/12</span>
        </div>

        <div className="space-y-2 max-h-[40vh] overflow-y-auto">
          {players.map((p: any, i: number) => (
            <div
              key={p.socketId}
              className="flex items-center justify-between py-2 px-3 bg-gray-800/50 rounded-lg animate-slide-up"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">
                  {p.isHost ? '👑' : '🎮'}
                </span>
                <span className={`font-medium ${
                  p.socketId === game.mySocketId ? 'text-gold' : 'text-white'
                }`}>
                  {p.name}
                  {p.socketId === game.mySocketId && ' (tú)'}
                </span>
              </div>
              {p.isHost && (
                <span className="text-xs text-gray-500 bg-gray-700 px-2 py-0.5 rounded">host</span>
              )}
            </div>
          ))}
        </div>

        {players.length < 2 && (
          <p className="text-gray-500 text-xs text-center mt-4">
            Necesitas al menos 2 jugadores para empezar
          </p>
        )}
      </div>

      {/* Start button (host only) */}
      {game.isHost && (
        <button
          onClick={game.startGame}
          disabled={players.length < 2}
          className="btn-gold w-full text-lg"
        >
          {players.length < 2 ? 'Esperando jugadores...' : '🥃 ¡A Jugar!'}
        </button>
      )}

      {!game.isHost && (
        <div className="text-center py-4">
          <p className="text-gray-400 text-sm">Esperando a que el host inicie...</p>
          <div className="mt-2 flex justify-center gap-1">
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" />
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: '200ms' }} />
            <div className="w-2 h-2 rounded-full bg-gold animate-pulse" style={{ animationDelay: '400ms' }} />
          </div>
        </div>
      )}
    </div>
  );
}
