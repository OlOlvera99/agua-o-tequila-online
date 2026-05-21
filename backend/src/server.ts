import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager';
import type { ClientEvents, ServerEvents } from './types';

const app = express();
const httpServer = createServer(app);

// CORS: acepta múltiples orígenes (localhost + Vercel)
const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

// Express CORS middleware
app.use(cors({ origin: allowedOrigins, credentials: true }));

const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

const roomManager = new RoomManager();

// ═══════════ HEALTH CHECK ═══════════
app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

// ═══════════ DEBUG ENDPOINT (solo en desarrollo) ═══════════
// En producción expone perfiles privados, chismes del host, etc. — bloqueado.
if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/:roomId', (_req, res) => {
    const room = roomManager.getRoom(_req.params.roomId.toUpperCase());
    if (!room) return res.json({ error: 'Sala no encontrada' });

    res.json({
      id: room.id,
      phase: room.phase,
      round: room.round,
      playerCount: room.players.length,
      players: room.players.map(p => ({
        name: p.name,
        isHost: p.isHost,
        questionnaireReady: p.questionnaireReady,
        hasProfile: !!p.profile,
        profile: p.profile,
      })),
      hostSecrets: room.hostSecrets,
      currentAffirmation: room.currentAffirmation,
      currentAffirmationType: room.currentAffirmationType,
      personalizedPoolSize: room.personalizedPool?.length ?? 0,
      personalizedPool: room.personalizedPool?.map(a => ({
        text: a.text, type: a.type, target: a.targetPlayer, involved: a.involvedPlayer, priority: a.priority
      })) ?? [],
      aiPoolSize: room.aiPool?.length ?? 0,
      fallbackPoolSize: room.affirmationPool?.length ?? 0,
      usedCount: room.usedAffirmations?.size ?? 0,
    });
  });
}

// ═══════════ VALIDACIÓN DE INPUT ═══════════
const LIMITS = {
  playerName: 30,
  roomId: 12,
  bio: 500,
  secret: 1000,
  comment: 200,
  tags: 20,
  contextSettings: 1000,
};

function sanitizeStr(s: unknown, maxLen: number): string | null {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return null;
  return trimmed;
}

// ═══════════ RATE LIMIT CASERO POR SOCKET ═══════════
// Tope simple: máx N acciones en una ventana de tiempo.
const rateLimits = new Map<string, number[]>(); // socketId → timestamps

function checkRate(socketId: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const timestamps = (rateLimits.get(socketId) || []).filter(t => now - t < windowMs);
  if (timestamps.length >= max) {
    rateLimits.set(socketId, timestamps);
    return false;
  }
  timestamps.push(now);
  rateLimits.set(socketId, timestamps);
  return true;
}

io.on('connection', (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);

  // ═══════════ LOBBY ═══════════

  socket.on('CREATE_ROOM', ({ playerName, settings }, callback) => {
    if (!checkRate(socket.id, 3, 60_000)) {
      return callback({ roomId: '' } as any); // silent fail por ahora; el cliente debería ignorar
    }
    const name = sanitizeStr(playerName, LIMITS.playerName);
    if (!name) return callback({ roomId: '' } as any);

    const room = roomManager.createRoom(socket.id, name, settings || {});
    socket.join(room.id);
    callback({ roomId: room.id });
    io.to(room.id).emit('ROOM_UPDATE', room.getLobbyState());
  });

  socket.on('JOIN_ROOM', ({ roomId, playerName }, callback) => {
    if (!checkRate(socket.id, 10, 60_000)) {
      return callback({ error: 'Demasiados intentos, espera un momento' });
    }
    const cleanRoomId = sanitizeStr(roomId, LIMITS.roomId);
    const name = sanitizeStr(playerName, LIMITS.playerName);
    if (!cleanRoomId) return callback({ error: 'Código de sala inválido' });
    if (!name) return callback({ error: 'Nombre inválido' });

    const id = cleanRoomId.toUpperCase();
    const room = roomManager.getRoom(id);
    if (!room) return callback({ error: 'Sala no encontrada' });
    if (room.phase !== 'lobby') return callback({ error: 'Juego ya iniciado' });
    if (room.players.length >= 12) return callback({ error: 'Sala llena (máx 12)' });
    if (room.players.some(p => p.name === name)) return callback({ error: 'Nombre en uso' });

    room.addPlayer(socket.id, name);
    socket.join(id);
    callback({ success: true });
    io.to(id).emit('ROOM_UPDATE', room.getLobbyState());
  });

  socket.on('UPDATE_SETTINGS', ({ roomId, settings }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (!settings || typeof settings !== 'object') return;
    // Limpiar settings antes de pasar
    const cleaned: any = {};
    if (settings.level && ['suave', 'picante', 'extrema'].includes(settings.level)) {
      cleaned.level = settings.level;
    }
    if (typeof settings.context === 'string') {
      cleaned.context = settings.context.slice(0, LIMITS.contextSettings);
    }
    room.updateSettings(cleaned);
    io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
  });

  // ═══════════ CUESTIONARIO ═══════════

  socket.on('SUBMIT_PROFILE', ({ roomId, profile }) => {
    if (!checkRate(socket.id, 5, 60_000)) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (!profile || typeof profile !== 'object') return;

    // Validar/sanitizar perfil
    const validGenders = ['hombre', 'mujer', 'otro'];
    const validOrientations = ['heterosexual', 'homosexual', 'bisexual', 'prefiero no decir'];
    const cleanProfile = {
      gender: validGenders.includes(profile.gender) ? profile.gender : 'otro',
      orientation: validOrientations.includes(profile.orientation) ? profile.orientation : 'prefiero no decir',
      tags: Array.isArray(profile.tags)
        ? profile.tags
            .filter((t: any) => typeof t === 'string' && t.length <= LIMITS.tags)
            .slice(0, 15)
        : [],
      bio: typeof profile.bio === 'string' ? profile.bio.slice(0, LIMITS.bio) : '',
      relationships: Array.isArray(profile.relationships)
        ? profile.relationships
            .filter((r: any) =>
              typeof r === 'object' &&
              typeof r.targetName === 'string' &&
              r.targetName.length <= LIMITS.playerName &&
              typeof r.type === 'string'
            )
            .map((r: any) => ({
              targetName: r.targetName,
              type: r.type,
              comment: typeof r.comment === 'string' ? r.comment.slice(0, LIMITS.comment) : '',
            }))
            .slice(0, 11) // máx 11 relaciones (uno menos del límite de 12 jugadores)
        : [],
    };

    room.submitProfile(socket.id, cleanProfile as any);

    const progress = room.getQuestionnaireProgress();
    io.to(roomId).emit('QUESTIONNAIRE_PROGRESS', progress);
    io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
  });

  socket.on('SUBMIT_HOST_SECRETS', ({ roomId, secrets }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (!secrets || typeof secrets !== 'object') return;

    // Sanitizar: cada secret max length, solo strings
    const cleanSecrets: Record<string, string> = {};
    for (const [name, secret] of Object.entries(secrets)) {
      if (typeof name === 'string' && name.length <= LIMITS.playerName &&
          typeof secret === 'string' && secret.length <= LIMITS.secret) {
        cleanSecrets[name] = secret;
      }
    }
    room.setHostSecrets(cleanSecrets);
  });

  // ═══════════ INICIAR JUEGO ═══════════

  socket.on('START_GAME', async ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id || room.players.length < 2) return;

    // Si estamos en lobby → iniciar cuestionario
    if (room.phase === 'lobby') {
      room.phase = 'questionnaire';
      io.to(roomId).emit('QUESTIONNAIRE_START', {
        players: room.players.map(p => p.name)
      });
      io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
      return;
    }

    // Si estamos en cuestionario → verificar que todos llenaron e iniciar juego
    if (room.phase === 'questionnaire') {
      // Generar fallback pool siempre (regex + genéricas)
      room.generateFallbackPool();

      // Intentar generar catalizadores inteligentes con IA (MÁXIMA PRIORIDAD)
      io.to(roomId).emit('GENERATING_AFFIRMATIONS');
      await room.generateAICatalysts();

      // También generar batch adaptativo por turno
      await room.generateAIBatch();

      startTurn(room, roomId);
    }
  });

  // ═══════════ FASE 2: CONFIRMACIÓN PRIVADA ═══════════

  socket.on('CONFIRM_TRUTH', ({ roomId, isTrue }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.getCurrentPlayerId()) return;

    room.setTruth(isTrue);
    room.phase = 'guessing';

    // AHORA sí revelar afirmación a todos los demás
    io.to(roomId).emit('PLAYER_CONFIRMED');
    io.to(roomId).emit('NEW_TURN', {
      currentPlayer: room.getCurrentPlayerName(),
      currentPlayerId: room.getCurrentPlayerId(),
      affirmation: room.currentAffirmation,
      round: room.round,
      phase: room.phase,
      type: room.currentAffirmationType,
    });

    // Iniciar timer de 30s
    room.onTimerExpired = () => {
      // Tiempo expirado → forzar revelación
      doReveal(room, roomId);
    };
    room.startGuessTimer();
  });

  // ═══════════ FASE 3: ADIVINANZAS ═══════════

  socket.on('SUBMIT_GUESS', ({ roomId, guess }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.phase !== 'guessing') return;
    if (socket.id === room.getCurrentPlayerId()) return;

    room.submitGuess(socket.id, guess);
    const status = room.getGuessStatus();
    io.to(roomId).emit('GUESS_COUNT', status);

    // Todos votaron → revelar (cancela timer)
    if (status.voted === status.total) {
      doReveal(room, roomId);
    }
  });

  // ═══════════ HELPERS ═══════════

  function startTurn(room: any, roomId: string) {
    room.startNextTurn();
    io.to(roomId).emit('NEW_TURN', {
      currentPlayer: room.getCurrentPlayerName(),
      currentPlayerId: room.getCurrentPlayerId(),
      affirmation: room.currentAffirmation,
      round: room.round,
      phase: room.phase,
      type: room.currentAffirmationType,
    });
  }

  function doReveal(room: any, roomId: string) {
    const results = room.calculateResults();
    room.phase = 'reveal';

    io.to(roomId).emit('REVEAL', {
      affirmation: room.currentAffirmation,
      truth: room.currentTruth!,
      guesses: results.guesses,
      drinkers: results.drinkers,
      reason: results.reason,
      type: room.currentAffirmationType,
    });
    io.to(roomId).emit('SCOREBOARD', { scores: room.getScoreboard() });

    // Auto-avanzar en 10 segundos
    room.onAutoAdvance = () => {
      startTurn(room, roomId);
    };
    room.startRevealTimer();
  }

  // ═══════════ CONTROL ═══════════

  socket.on('NEXT_TURN', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    startTurn(room, roomId);
  });

  socket.on('REGENERATE_AFFIRMATION', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    room.regenerateAffirmation();
    io.to(roomId).emit('NEW_TURN', {
      currentPlayer: room.getCurrentPlayerName(),
      currentPlayerId: room.getCurrentPlayerId(),
      affirmation: room.currentAffirmation,
      round: room.round,
      phase: room.phase,
      type: room.currentAffirmationType,
    });
  });

  // ═══════════ DESCONEXIÓN ═══════════

  socket.on('disconnect', () => {
    console.log(`❌ Desconectado: ${socket.id}`);
    const room = roomManager.removePlayer(socket.id);
    if (room) {
      io.to(room.id).emit('ROOM_UPDATE', room.getLobbyState());
      if (room.players.length === 0) roomManager.deleteRoom(room.id);
    }
  });
});

setInterval(() => roomManager.cleanup(), 30 * 60 * 1000);

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`🥃 Agua o Tequila server en puerto ${PORT}`);
});
