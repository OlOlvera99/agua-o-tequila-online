'use client';

import { useState } from 'react';

const TAGS = [
  'fiestero', 'tímido', 'coqueto', 'intenso', 'bromista',
  'serio', 'dramático', 'competitivo', 'relajado', 'misterioso',
  'romántico', 'sarcástico', 'aventurero', 'reservado', 'payaso',
];

const RELATION_TYPES = [
  { value: 'amigos', label: '👋 Amigos' },
  { value: 'mejores_amigos', label: '🤝 Mejores amigos' },
  { value: 'novios', label: '❤️ Novios/Pareja' },
  { value: 'ex_pareja', label: '💔 Ex pareja' },
  { value: 'hermanos', label: '👨‍👩‍👧 Hermanos' },
  { value: 'familia', label: '🏠 Familia' },
  { value: 'se_gustan', label: '😏 Se gustan / hay tensión' },
  { value: 'rivalidad', label: '⚡ Se caen mal / rivalidad' },
  { value: 'compañeros_trabajo', label: '💼 Compañeros de trabajo' },
];

export default function QuestionnaireView({ game }: { game: any }) {
  const [step, setStep] = useState<'profile' | 'relationships' | 'secrets' | 'done'>('profile');
  const players = game.roomState?.players || [];
  const otherPlayers = players.filter((p: any) => p.socketId !== game.mySocketId);

  // Profile state
  const [gender, setGender] = useState<'hombre' | 'mujer' | 'otro'>('hombre');
  const [orientation, setOrientation] = useState<'heterosexual' | 'homosexual' | 'bisexual' | 'prefiero no decir'>('heterosexual');
  const [tags, setTags] = useState<string[]>([]);
  const [bio, setBio] = useState('');

  // Relationships state
  const [relationships, setRelationships] = useState<Record<string, { type: string; comment: string }>>(
    () => Object.fromEntries(otherPlayers.map((p: any) => [p.name, { type: 'amigos', comment: '' }]))
  );

  // Host secrets state
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
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold text-white mb-2">¡Listo!</h2>
        <p className="text-gray-400 text-sm text-center mb-6">
          {progress && progress.ready < progress.total
            ? `Esperando a los demás... (${progress.ready}/${progress.total})`
            : 'Todos listos'
          }
        </p>

        {/* Progress dots */}
        {progress && (
          <div className="flex gap-2 mb-6">
            {Array.from({ length: progress.total }).map((_, i) => (
              <div
                key={i}
                className={`w-3 h-3 rounded-full transition-all ${
                  i < progress.ready ? 'bg-gold' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>
        )}

        {/* Host can start once all are ready */}
        {game.isHost && progress && progress.ready >= progress.total && (
          <button onClick={game.startGame} className="btn-gold text-lg">
            🧠 Generar preguntas y empezar
          </button>
        )}

        {game.isHost && progress && progress.ready < progress.total && (
          <button onClick={game.startGame} className="btn-gold text-lg opacity-50">
            ⏳ Empezar sin esperar a todos
          </button>
        )}
      </div>
    );
  }

  // ═══════════ HOST SECRETS ═══════════
  if (step === 'secrets') {
    return (
      <div className="min-h-[100dvh] flex flex-col px-6 py-8">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">🤫</div>
          <h2 className="text-xl font-bold text-gold">Info secreta del host</h2>
          <p className="text-gray-400 text-sm mt-1">
            Solo la IA verá esto. Escribe chisme, tensiones, secretos que tú sepas.
          </p>
        </div>

        <div className="flex-1 space-y-3 overflow-y-auto pb-20">
          {players.map((p: any) => (
            <div key={p.name} className="glass-card">
              <label className="text-white font-medium text-sm mb-2 block">
                {p.socketId === game.mySocketId ? `${p.name} (tú)` : p.name}
              </label>
              <textarea
                value={secrets[p.name] || ''}
                onChange={e => setSecrets(prev => ({ ...prev, [p.name]: e.target.value }))}
                placeholder={`Ej: Le gusta ${otherPlayers[0]?.name || 'alguien'}, es muy celoso, terminó con su ex hace poco...`}
                rows={2}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-gold focus:outline-none transition resize-none"
              />
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-900 via-gray-900">
          <button onClick={submitSecrets} className="btn-gold w-full text-lg">
            🎮 Listo
          </button>
          <button
            onClick={() => { setStep('done'); }}
            className="w-full mt-2 py-2 text-gray-500 text-sm"
          >
            Saltar
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ PROFILE + RELATIONSHIPS (combined flow) ═══════════
  if (step === 'relationships') {
    return (
      <div className="min-h-[100dvh] flex flex-col px-6 py-8">
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gold">¿Cómo conoces a cada quien?</h2>
          <p className="text-gray-400 text-sm mt-1">Define tu relación con los demás</p>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto pb-24">
          {otherPlayers.map((p: any) => (
            <div key={p.name} className="glass-card">
              <p className="text-white font-medium mb-2">{p.name}</p>

              {/* Relation dropdown */}
              <select
                value={relationships[p.name]?.type || 'amigos'}
                onChange={e => updateRelation(p.name, 'type', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:border-gold focus:outline-none mb-2"
              >
                {RELATION_TYPES.map(r => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>

              {/* Optional comment */}
              <input
                type="text"
                value={relationships[p.name]?.comment || ''}
                onChange={e => updateRelation(p.name, 'comment', e.target.value)}
                placeholder="Detalle extra (opcional)"
                maxLength={100}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:border-gold focus:outline-none"
              />
            </div>
          ))}
        </div>

        <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-900 via-gray-900">
          <button onClick={submitProfile} className="btn-gold w-full text-lg">
            ✅ Enviar
          </button>
        </div>
      </div>
    );
  }

  // ═══════════ PROFILE: GENDER, ORIENTATION, TAGS, BIO ═══════════
  return (
    <div className="min-h-[100dvh] flex flex-col px-6 py-8">
      <div className="text-center mb-6">
        <div className="text-4xl mb-2">📝</div>
        <h2 className="text-xl font-bold text-gold">Cuéntanos de ti</h2>
        <p className="text-gray-400 text-sm mt-1">
          Para que las preguntas sean más divertidas
        </p>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto pb-24">
        {/* Gender */}
        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Género</label>
          <div className="grid grid-cols-3 gap-2">
            {([['hombre', '👨'], ['mujer', '👩'], ['otro', '🧑']] as const).map(([val, emoji]) => (
              <button
                key={val}
                onClick={() => setGender(val as any)}
                className={`py-2 rounded-lg text-sm font-bold transition-all ${
                  gender === val ? 'bg-gold text-gray-900' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {emoji} {val.charAt(0).toUpperCase() + val.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Orientation */}
        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">Orientación</label>
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
                className={`py-2 px-2 rounded-lg text-xs font-bold transition-all ${
                  orientation === val ? 'bg-gold text-gray-900' : 'bg-gray-800 text-gray-400'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Tags */}
        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">
            ¿Cómo eres? <span className="text-gray-600">(elige las que apliquen)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {TAGS.map(tag => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  tags.includes(tag)
                    ? 'bg-gold text-gray-900'
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Bio */}
        <div>
          <label className="text-gray-400 text-xs uppercase tracking-wider mb-2 block">
            Algo más sobre ti <span className="text-gray-600">(chisme, datos random)</span>
          </label>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Ej: Le tengo miedo a los payasos, una vez me dormí en el cine, me gusta el reggaetón en secreto..."
            rows={3}
            maxLength={300}
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-gold focus:outline-none transition resize-none"
          />
        </div>
      </div>

      {/* Next */}
      <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-gray-900 via-gray-900">
        <button
          onClick={() => setStep('relationships')}
          className="btn-gold w-full text-lg"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
