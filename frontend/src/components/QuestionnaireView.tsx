'use client';

import { useState } from 'react';

const TAGS = [
  'fiestero', 'tímido', 'coqueto', 'intenso', 'bromista',
  'serio', 'dramático', 'competitivo', 'relajado', 'misterioso',
  'romántico', 'sarcástico', 'aventurero', 'reservado', 'payaso',
];

const RELATION_TYPES = [
  { value: 'amigos', label: 'Amigos' },
  { value: 'mejores_amigos', label: 'Mejores amigos' },
  { value: 'novios', label: 'Novios / Pareja' },
  { value: 'ex_pareja', label: 'Ex pareja' },
  { value: 'hermanos', label: 'Hermanos' },
  { value: 'familia', label: 'Familia' },
  { value: 'se_gustan', label: 'Se gustan / hay tensión' },
  { value: 'rivalidad', label: 'Se caen mal / rivalidad' },
  { value: 'compañeros_trabajo', label: 'Compañeros de trabajo' },
];

export default function QuestionnaireView({ game }: { game: any }) {
  const [step, setStep] = useState<'profile' | 'relationships' | 'secrets' | 'done'>('profile');
  const players = game.roomState?.players || [];
  const otherPlayers = players.filter((p: any) => p.socketId !== game.mySocketId);

  const [gender, setGender] = useState<'hombre' | 'mujer' | 'otro'>('hombre');
  const [orientation, setOrientation] = useState<'heterosexual' | 'homosexual' | 'bisexual' | 'prefiero no decir'>('heterosexual');
  const [tags, setTags] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  const [relationships, setRelationships] = useState<Record<string, { type: string; comment: string }>>(
    () => Object.fromEntries(otherPlayers.map((p: any) => [p.name, { type: 'amigos', comment: '' }]))
  );

  const [secrets, setSecrets] = useState<Record<string, string>>(
    () => Object.fromEntries(players.map((p: any) => [p.name, '']))
  );

  const toggleTag = (tag: string) => {
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const updateRelation = (name: string, field: 'type' | 'comment', value: string) => {
    setRelationships(prev => ({
      ...prev,
      [name]: { ...prev[name], [field]: value }
    }));
  };

  const submitProfile = () => {
    const profile = {
      gender,
      orientation,
      tags,
      bio,
      relationships: Object.entries(relationships).map(([name, rel]) => ({
        targetName: name,
        type: rel.type,
        comment: rel.comment,
      })),
    };
    game.submitProfile(profile);

    if (game.isHost) {
      setStep('secrets');
    } else {
      setStep('done');
    }
  };

  const submitSecrets = () => {
    const filtered = Object.fromEntries(
      Object.entries(secrets).filter(([_, v]) => v.trim() !== '')
    );
    game.submitHostSecrets(filtered);
    setStep('done');
  };

  const progress = game.questionnaireProgress || game.roomState?.questionnaireProgress;

  // ═══════════ DONE / WAITING ═══════════
  if (step === 'done') {
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
            : 'Todos listos'
          }
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
            Generar preguntas y empezar
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

  // ═══════════ HOST SECRETS ═══════════
  if (step === 'secrets') {
    return (
      <div className="min-h-[100dvh] flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-ink">Info secreta del host</h2>
          <p className="text-ink-soft text-sm mt-1.5 font-medium">
            Solo la IA verá esto. Escribe chisme, tensiones, secretos.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pb-24">
          {players.map((p: any) => (
            <div key={p.name} className="lg-card-sm p-4">
              <label className="text-ink font-bold text-sm mb-2 block">
                {p.socketId === game.mySocketId ? `${p.name} (tú)` : p.name}
              </label>
              <textarea
                value={secrets[p.name] || ''}
                onChange={e => setSecrets(prev => ({ ...prev, [p.name]: e.target.value }))}
                placeholder={`Ej: Le gusta ${otherPlayers[0]?.name || 'alguien'}, terminó hace poco…`}
                rows={2}
                className="lg-input text-sm"
              />
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-gradient-to-t from-paper via-paper/95 to-transparent">
          <div className="max-w-md mx-auto">
            <button onClick={submitSecrets} className="btn-tequila text-base">
              Listo
            </button>
            <button
              onClick={() => { setStep('done'); }}
              className="w-full mt-2 py-2 text-ink-soft text-sm font-medium hover:text-ink"
            >
              Saltar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ RELATIONSHIPS ═══════════
  if (step === 'relationships') {
    return (
      <div className="min-h-[100dvh] flex flex-col px-6 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-6">
          <h2 className="text-xl font-black text-ink">¿Cómo conoces a cada quien?</h2>
          <p className="text-ink-soft text-sm mt-1.5 font-medium">
            Define tu relación con los demás
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pb-24">
          {otherPlayers.map((p: any) => (
            <div key={p.name} className="lg-card-sm p-4">
              <p className="text-ink font-bold mb-2.5">{p.name}</p>

              <select
                value={relationships[p.name]?.type || 'amigos'}
                onChange={e => updateRelation(p.name, 'type', e.target.value)}
                className="lg-input text-sm mb-2"
              >
                {RELATION_TYPES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              <input
                type="text"
                value={relationships[p.name]?.comment || ''}
                onChange={e => updateRelation(p.name, 'comment', e.target.value)}
                placeholder="Detalle extra (opcional)"
                maxLength={100}
                className="lg-input text-sm"
              />
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-gradient-to-t from-paper via-paper/95 to-transparent">
          <div className="max-w-md mx-auto">
            <button onClick={submitProfile} className="btn-water text-base">
              Enviar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════ PROFILE ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8 max-w-md mx-auto w-full">
      <div className="text-center mb-6">
        <h2 className="text-xl font-black text-ink">Cuéntanos de ti</h2>
        <p className="text-ink-soft text-sm mt-1.5 font-medium">
          Para que las preguntas sean más divertidas
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pb-24">
        {/* Gender */}
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
            Género
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['hombre', 'mujer', 'otro'] as const).map((val) => (
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

        {/* Orientation */}
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
            Orientación
          </label>
          <div className="grid grid-cols-2 gap-2">
            {([
              ['heterosexual', 'Hetero'],
              ['homosexual', 'Homo'],
              ['bisexual', 'Bi'],
              ['prefiero no decir', 'Prefiero no decir'],
            ] as const).map(([val, label]) => (
              <button
                key={val}
                onClick={() => setOrientation(val as any)}
                className={`seg ${orientation === val ? 'seg-active' : ''}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
            ¿Cómo eres? <span className="text-ink-faint normal-case tracking-normal">(elige las que apliquen)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`pill ${tags.includes(tag) ? 'pill-active-water' : ''}`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="text-ink-soft text-[11px] uppercase tracking-[0.15em] font-semibold mb-2 block">
            Algo más sobre ti <span className="text-ink-faint normal-case tracking-normal">(chisme, datos random)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Ej: Le tengo miedo a los payasos, una vez me dormí en el cine…"
            rows={3}
            maxLength={300}
            className="lg-input text-sm"
          />
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 p-6 backdrop-blur-xl bg-gradient-to-t from-paper via-paper/95 to-transparent">
        <div className="max-w-md mx-auto">
          <button onClick={() => setStep('relationships')} className="btn-water text-base">
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
