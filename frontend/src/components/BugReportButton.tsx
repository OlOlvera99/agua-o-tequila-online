'use client';

import { useState } from 'react';

/**
 * Botón flotante (solo host) para reportar una falla en medio del juego.
 * Envía el comentario al server, que guarda un dump completo del estado
 * de la sala en los logs para análisis posterior.
 */
export default function BugReportButton({ game }: { game: any }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  if (!game.isHost || !game.roomId) return null;

  const submit = async () => {
    if (status === 'sending') return;
    setStatus('sending');
    try {
      await game.reportIssue(comment.trim() || '(sin comentario)');
      setStatus('sent');
      setTimeout(() => {
        setOpen(false);
        setComment('');
        setStatus('idle');
      }, 1500);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2500);
    }
  };

  return (
    <>
      {/* Botón flotante */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Reportar falla"
        className="fixed bottom-4 left-4 z-40 w-10 h-10 rounded-full bg-white/70 backdrop-blur-md border border-white/90 shadow-md text-base flex items-center justify-center opacity-60 hover:opacity-100 transition-opacity"
      >
        🐞
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/30 backdrop-blur-sm p-4">
          <div className="lg-hero w-full max-w-sm">
            {status === 'sent' ? (
              <div className="text-center py-6">
                <div className="text-3xl mb-2">✅</div>
                <p className="text-ink font-bold">Reporte enviado</p>
                <p className="text-ink-soft text-sm mt-1">Gracias — quedó guardado con todo el estado del juego.</p>
              </div>
            ) : (
              <>
                <h3 className="text-ink font-bold text-lg mb-1">🐞 Reportar falla</h3>
                <p className="text-ink-soft text-xs mb-3 leading-relaxed">
                  Describe qué pasó. Se guarda junto con el estado completo de la sala
                  (ronda, afirmación, jugadores, cola de imágenes) para analizarlo.
                </p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  maxLength={500}
                  rows={4}
                  placeholder="ej. A Fulanito le salió una afirmación que no tiene sentido…"
                  className="lg-input mb-3"
                  autoFocus
                />
                {status === 'error' && (
                  <p className="text-red-500 text-xs mb-2">No se pudo enviar — intenta de nuevo.</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => { setOpen(false); setStatus('idle'); }}
                    className="btn-ghost flex-1 text-sm"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={submit}
                    disabled={status === 'sending'}
                    className="btn-water flex-1 text-sm"
                  >
                    {status === 'sending' ? 'Enviando…' : 'Enviar reporte'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
