'use client';

import { useState, useEffect } from 'react';
import { RELATION_OPTIONS, RelationType } from '@/hooks/useGameSocket';

export default function LandingView({ game }: { game: any }) {
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [level, setLevel] = useState<'suave' | 'picante' | 'extrema'>('picante');
  const [relationType, setRelationType] = useState<RelationType>('amigos_generico');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');
    if (roomCode) {
      setCode(roomCode.toUpperCase());
      setMode('join');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return setError('Escribe tu nombre');
    setLoading(true);
    setError('');
    try {
      await game.createRoom(name.trim(), { level, relationType });
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
        <img
          src="/brand/Logotipo_AGUA_TEQUILA_TRANSPARENTE.png"
          alt="Agua o Tequila"
          className="w-72 max-w-[80vw] mb-2 liquid-float drop-shadow-xl"
        />
        <p className="text-ink-soft text-sm font-medium mb-12 text-center">
          ¿Verdad o mentira? Quien falla, toma.
        </p>

        <div className="w-full max-w-xs space-y-3">
          <button onClick={() => setMode('create')} className="btn-water text-base">
            Crear sala
          </button>
          <button onClick={() => setMode('join')} className="btn-ghost text-base">
            Unirme a sala
          </button>
        </div>

        <p className="text-ink-faint text-[10px] mt-10 uppercase tracking-[0.2em]">
          by Mati Media
        </p>
      </div>
    );
  }

  // Agrupar relation options por categoría para el dropdown
  const grouped = RELATION_OPTIONS.reduce((acc, opt) => {
    (acc[opt.group] ||= []).push(opt);
    return acc;
  }, {} as Record<string, typeof RELATION_OPTIONS>);

  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center px-6 py-8 relative">
      <button
        onClick={() => { setMode('menu'); setError(''); }}
        className="absolute top-5 left-5 text-ink-soft hover:text-ink text-sm font-medium px-3 py-1.5 rounded-full bg-white/60 backdrop-blur-md border border-ink/10 transition"
      >
        ← Atrás
      </button>

      <img
        src="/brand/Logotipo_AGUA_O_TEQUILA_SHOTS_TRANSPARENTE.png"
        alt=""
        className="w-20 mb-4"
      />
      <h2 className="text-2xl font-black text-ink mb-8">
        {mode === 'create' ? 'Crear sala' : 'Unirme a sala'}
      </h2>

      <div className="w-full max-w-xs space-y-4">
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-1.5 block">
            Tu nombre
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="¿Cómo te llaman?"
            maxLength={15}
            className="lg-input"
          />
        </div>

        {mode === 'join' && (
          <div>
            <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-1.5 block">
              Código de sala
            </label>
            <input
              type="text"
              value={code}
              onChange={e => setCode(e.target.value.toUpperCase())}
              placeholder="EJ: RJZD96KUL9"
              maxLength={10}
              className="lg-input font-mono text-center tracking-[0.2em]"
            />
          </div>
        )}

        {mode === 'create' && (
          <>
            <div>
              <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-1.5 block">
                Tipo de relación
              </label>
              <select
                value={relationType}
                onChange={e => setRelationType(e.target.value as RelationType)}
                className="lg-input"
              >
                {Object.entries(grouped).map(([group, opts]) => (
                  <optgroup key={group} label={group}>
                    {opts.map(o => (
                      <option key={o.key} value={o.key}>
                        {o.label}{!o.ready ? ' (beta — pool limitado)' : ''}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div>
              <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-1.5 block">
                Nivel
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(['suave', 'picante', 'extrema'] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`seg ${level === l ? 'seg-active' : ''}`}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {error && (
          <p className="text-red-500 text-sm text-center font-medium animate-shake">{error}</p>
        )}

        <button
          onClick={mode === 'create' ? handleCreate : handleJoin}
          disabled={loading}
          className="btn-water text-base mt-2"
        >
          {loading ? 'Cargando…' : mode === 'create' ? 'Crear' : 'Unirme'}
        </button>
      </div>
    </div>
  );
}
