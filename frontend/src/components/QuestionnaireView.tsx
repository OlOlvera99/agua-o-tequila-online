'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  RELATION_KIND_OPTIONS, RelationKind, GroupVibe, GROUP_VIBE_OPTIONS,
} from '@/hooks/useGameSocket';

const MAX_SELFIE_EDGE = 1024; // resize antes de subir
const SELFIE_QUALITY = 0.85;

export default function QuestionnaireView({ game }: { game: any }) {
  const players = game.roomState?.players || [];
  // Filtra por socketId Y por nombre (defensive contra races de mySocketId vacío)
  const otherPlayers: { name: string; socketId: string }[] = players.filter(
    (p: any) => p.socketId !== game.mySocketId && p.name !== game.myName
  );
  const settings = game.roomState?.settings;
  const groupVibe: GroupVibe = settings?.groupVibe || 'amigos_mixto';

  const [gender, setGender] = useState<'hombre' | 'mujer' | 'otro'>('hombre');
  const [relationships, setRelationships] = useState<Record<string, RelationKind>>({});
  const [selfieBase64, setSelfieBase64] = useState<string>('');
  const [selfiePreview, setSelfiePreview] = useState<string>('');
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const progress = game.questionnaireProgress || game.roomState?.questionnaireProgress;

  // Default todas las relaciones a 'amigo' si no se ha tocado
  useEffect(() => {
    setRelationships(prev => {
      const next = { ...prev };
      for (const p of otherPlayers) {
        if (!next[p.name]) next[p.name] = 'amigo';
      }
      return next;
    });
  }, [otherPlayers.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelfieChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl, base64 } = await resizeImage(file, MAX_SELFIE_EDGE, SELFIE_QUALITY);
      setSelfiePreview(dataUrl);
      setSelfieBase64(base64);
    } catch (err) {
      console.error('Selfie resize failed:', err);
      alert('No se pudo procesar la foto. Intenta con otra.');
    }
  };

  const handleSubmit = () => {
    game.submitProfile({
      gender,
      relationships,
      selfieBase64: selfieBase64 || undefined,
    });
    setSubmitted(true);
  };

  const relsByGroup = useMemo(() => {
    const groups: Record<string, typeof RELATION_KIND_OPTIONS> = {};
    for (const o of RELATION_KIND_OPTIONS) {
      (groups[o.group] ||= []).push(o);
    }
    return groups;
  }, []);

  const groupVibeLabel = GROUP_VIBE_OPTIONS.find(g => g.key === groupVibe)?.label || 'Grupo';

  // ═══════════ DONE / WAITING ═══════════
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
          {groupVibeLabel}
        </p>
        <h2 className="text-xl font-black text-ink">Cuéntanos</h2>
        <p className="text-ink-soft text-sm mt-1.5 font-medium">
          Tu género, una selfie (opcional) y qué relación tienes con cada quien.
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

        {/* Selfie */}
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
            Selfie <span className="text-ink-faint normal-case tracking-normal">(opcional · para las imágenes del juego)</span>
          </label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="user"
            onChange={handleSelfieChange}
            className="hidden"
          />
          {selfiePreview ? (
            <div className="flex items-center gap-3">
              <img
                src={selfiePreview}
                alt="Selfie"
                className="w-20 h-20 rounded-full object-cover border-2 border-water/40 shadow-md"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="btn-ghost text-sm flex-1"
              >
                Cambiar foto
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="btn-ghost text-sm w-full"
            >
              📸 Subir o tomar selfie
            </button>
          )}
        </div>

        {/* Matriz de relaciones */}
        {otherPlayers.length > 0 && (
          <div>
            <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
              ¿Qué eres de cada quién?
            </label>
            <div className="space-y-2.5">
              {otherPlayers.map((p) => (
                <div key={p.socketId} className="lg-card-sm p-3">
                  <p className="text-ink font-bold text-sm mb-1.5">{p.name}</p>
                  <select
                    value={relationships[p.name] || 'amigo'}
                    onChange={e => setRelationships(prev => ({ ...prev, [p.name]: e.target.value as RelationKind }))}
                    className="lg-input text-sm"
                  >
                    {Object.entries(relsByGroup).map(([gName, opts]) => (
                      <optgroup key={gName} label={gName}>
                        {opts.map(o => (
                          <option key={o.key} value={o.key}>{o.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-gradient-to-t from-paper via-paper/95 to-transparent">
        <div className="max-w-md mx-auto space-y-2">
          <button onClick={handleSubmit} className="btn-water text-base">
            Enviar
          </button>
          {game.isHost && progress && (
            <button
              onClick={game.startGame}
              className="btn-ghost text-sm"
              title="Empieza el juego sin esperar (los que no llenaron no podrán recibir afirmaciones personalizadas)"
            >
              Empezar ya ({progress.ready}/{progress.total} listos)
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── helpers ───

async function resizeImage(file: File, maxEdge: number, quality: number): Promise<{ dataUrl: string; base64: string }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const ratio = Math.min(maxEdge / img.width, maxEdge / img.height, 1);
        const w = Math.round(img.width * ratio);
        const h = Math.round(img.height * ratio);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('No canvas context'));
        ctx.drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        const base64 = dataUrl.split(',')[1] || '';
        resolve({ dataUrl, base64 });
      };
      img.onerror = reject;
      img.src = reader.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
