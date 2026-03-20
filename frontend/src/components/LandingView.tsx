'use client';

import { useState, useEffect } from 'react';

export default function LandingView({ game }: { game: any }) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [level, setLevel] = useState<'suave' | 'picante' | 'extrema'>('picante');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // ═══════════ AUTO-DETECT ROOM CODE FROM URL ═══════════
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      setCode(roomCode.toUpperCase());
      setMode('join');
      // Limpiar URL para que no se quede el ?room=
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    setLoading(true);
    setError('');
    try {
      await game.createRoom(name.trim(), { level });
    } catch (e: any) {
      setError(e || 'Error al crear sala');
    }
    setLoading(false);
  };

  const handleJoin = async () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    if (!code.trim()) return setError('Escribe el código de sala');
    setLoading(true);
    setError('');
    try {
      await game.joinRoom(code.trim(), name.trim());
    } catch (e: any) {
      setError(e || 'Error al unirse');
    }
    setLoading(false);
  };

  if (mode === 'menu') {
    return (
      <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
        <div className="text-6xl mb-2">🥃</div>
        <h1 className="text-3xl font-black text-gold mb-1">Agua o Tequila</h1>
        <p className="text-gray-400 text-sm mb-10">¿Verdad o mentira? Quien falla, toma.</p>

        <div className="w-full max-w-xs space-y-3">
          <button
            onClick={() => setMode('create')}
            className="btn-gold w-full text-lg"
          >
            Crear Sala
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full py-3 px-6 rounded-xl font-bold border-2 border-gray-600 text-gray-300 hover:border-gold hover:text-gold transition-all active:scale-95"
          >
            Unirme a Sala
          </button>
        </div>

        <p className="text-gray-600 text-xs mt-8">by Mati Media</p>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6">
      <button
        onClick={() => { setMode('menu'); setError(''); }}
        className="absolute top-4 left-4 text-gray-400 hover:text-white text-sm"
      >
        ← Atrás
      </button>

      <div className="text-4xl mb-4">{mode === 'create' ? '🎉' : '🔗'}</div>
      <h2 className="text-2xl font-bold text-white mb-6">
        {mode === 'create' ? 'Crear Sala' : 'Unirme a Sala'}
      </h2>

      <div className="w-full max-w-xs space-y-4">
        {/* Nombre */}
        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Tu nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="¿Cómo te llaman?"
            maxLength={15}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-gold focus:outline-none transition"
          />
        </div>

        {/* Código de sala (solo para unirse) */}
        {mode === 'join' && (
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Código de sala</label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="Ej: RJZD96KUL9"
              maxLength={10}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:border-gold focus:outline-none transition font-mono text-center tracking-widest"
            />
          </div>
        )}

        {/* Nivel (solo para crear) */}
        {mode === 'create' && (
          <div>
            <label className="text-gray-400 text-xs uppercase tracking-wider mb-1 block">Nivel</label>
            <div className="grid grid-cols-3 gap-2">
              {(['suave', 'picante', 'extrema'] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLevel(l)}
                  className={`py-2 px-3 rounded-lg text-sm font-bold transition-all ${
                    level === l
                      ? 'bg-gold text-gray-900'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {l === 'suave' && '🟢'}
                  {l === 'picante' && '🟡'}
                  {l === 'extrema' && '🔴'}
                  {' '}{l.charAt(0).toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-red-400 text-sm text-center animate-shake">{error}</p>
        )}

        {/* Submit */}
        <button
          onClick={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          className="btn-gold w-full text-lg"
        >
          {loading ? '...' : mode === 'create' ? '🎮 Crear' : '🚀 Unirme'}
        </button>
      </div>
    </div>
  );
}
