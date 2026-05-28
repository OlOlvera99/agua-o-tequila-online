import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { RoomManager } from './RoomManager';
import { GROUP_VIBE_CONFIG, RELATION_KIND_LABELS } from './viralAffirmations';
import { generateTurnImage, isImageGenAvailable } from './imageService';
import type { ClientEvents, ServerEvents, GroupVibe, RelationKind } from './types';

const app = express();
const httpServer = createServer(app);

const allowedOrigins = (process.env.FRONTEND_URL || 'http://localhost:3000')
  .split(',')
  .map(s => s.trim());

app.use(cors({ origin: allowedOrigins, credentials: true }));

const io = new Server<ClientEvents, ServerEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  maxHttpBufferSize: 5e6, // 5MB (para selfies en base64 hasta ~3.5MB)
});

const roomManager = new RoomManager();

// ═══════════ HEALTH CHECK ═══════════
app.get('/', (_req, res) => {
  res.json({ status: 'ok' });
});

if (process.env.NODE_ENV !== 'production') {
  app.get('/debug/:roomId', (_req, res) => {
    const room = roomManager.getRoom(_req.params.roomId.toUpperCase());
    if (!room) return res.json({ error: 'Sala no encontrada' });
    res.json({
      id: room.id,
      phase: room.phase,
      round: room.round,
      settings: room.settings,
      playerCount: room.players.length,
      players: room.players.map(p => ({
        name: p.name,
        isHost: p.isHost,
        questionnaireReady: p.questionnaireReady,
        hasProfile: !!p.profile,
        profile: p.profile ? { ...p.profile, selfieBase64: p.profile.selfieBase64 ? `(${p.profile.selfieBase64.length} chars)` : undefined } : null,
      })),
      currentAffirmation: room.currentAffirmation,
      currentRelationType: room.currentRelationType,
    });
  });
}

// ═══════════ VALIDATION ═══════════
const LIMITS = {
  playerName: 30,
  roomId: 12,
  selfieBase64: 3_500_000,  // ~2.5MB de imagen JPEG/PNG
};

const VALID_GROUP_VIBES = Object.keys(GROUP_VIBE_CONFIG) as GroupVibe[];
const VALID_RELATION_KINDS = Object.keys(RELATION_KIND_LABELS) as RelationKind[];
const VALID_GENDERS = ['hombre', 'mujer', 'otro'] as const;
const VALID_LEVELS = ['suave', 'picante', 'extrema'] as const;

function sanitizeStr(s: unknown, maxLen: number): string | null {
  if (typeof s !== 'string') return null;
  const trimmed = s.trim();
  if (!trimmed) return null;
  if (trimmed.length > maxLen) return null;
  return trimmed;
}

// Rate limit casero por socket
const rateLimits = new Map<string, number[]>();
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
    if (!checkRate(socket.id, 3, 60_000)) return callback({ roomId: '' } as any);
    const name = sanitizeStr(playerName, LIMITS.playerName);
    if (!name) return callback({ roomId: '' } as any);

    const room = roomManager.createRoom(socket.id, name, settings || {});
    socket.join(room.id);
    callback({ roomId: room.id });
    io.to(room.id).emit('ROOM_UPDATE', room.getLobbyState());
  });

  socket.on('JOIN_ROOM', ({ roomId, playerName }, callback) => {
    if (!checkRate(socket.id, 10, 60_000)) return callback({ error: 'Demasiados intentos, espera un momento' });
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
    if (!checkRate(socket.id, 30, 60_000)) return;
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id) return;
    if (!settings || typeof settings !== 'object') return;

    const cleaned: any = {};
    if (settings.level && VALID_LEVELS.includes(settings.level as any)) {
      cleaned.level = settings.level;
    }
    if (settings.groupVibe && VALID_GROUP_VIBES.includes(settings.groupVibe as any)) {
      cleaned.groupVibe = settings.groupVibe;
    }
    room.updateSettings(cleaned);
    io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
  });

  // ═══════════ CUESTIONARIO ═══════════

  socket.on('SUBMIT_PROFILE', ({ roomId, profile }) => {
    if (!checkRate(socket.id, 8, 60_000)) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (!profile || typeof profile !== 'object') return;

    const otherNames = new Set(
      room.players.filter(p => p.socketId !== socket.id).map(p => p.name)
    );

    // Validar relationships: solo otras names existentes y kinds válidos
    const cleanRelationships: Record<string, RelationKind> = {};
    if (profile.relationships && typeof profile.relationships === 'object') {
      for (const [name, kind] of Object.entries(profile.relationships)) {
        if (otherNames.has(name) && VALID_RELATION_KINDS.includes(kind as any)) {
          cleanRelationships[name] = kind as RelationKind;
        }
      }
    }

    // Validar selfie (opcional, max LIMITS.selfieBase64)
    let cleanSelfie: string | undefined;
    if (typeof profile.selfieBase64 === 'string' && profile.selfieBase64.length > 0) {
      if (profile.selfieBase64.length <= LIMITS.selfieBase64) {
        cleanSelfie = profile.selfieBase64;
      }
    }

    const cleanProfile = {
      gender: VALID_GENDERS.includes(profile.gender as any) ? profile.gender : 'otro',
      role: typeof profile.role === 'string' && profile.role.length <= 30
        ? profile.role.trim()
        : undefined,
      relationships: cleanRelationships,
      selfieBase64: cleanSelfie,
    };

    room.submitProfile(socket.id, cleanProfile as any);

    const progress = room.getQuestionnaireProgress();
    io.to(roomId).emit('QUESTIONNAIRE_PROGRESS', progress);
    io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
  });

  // ═══════════ INICIAR JUEGO ═══════════

  socket.on('START_GAME', ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id || room.players.length < 2) return;

    if (room.phase === 'lobby') {
      room.phase = 'questionnaire';
      io.to(roomId).emit('QUESTIONNAIRE_START', { players: room.players.map(p => p.name) });
      io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
      return;
    }

    if (room.phase === 'questionnaire') {
      room.initPool();
      startTurn(room, roomId);
    }
  });

  socket.on('CONFIRM_TRUTH', ({ roomId, isTrue }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || socket.id !== room.getCurrentPlayerId()) return;

    room.setTruth(isTrue);
    room.phase = 'guessing';

    io.to(roomId).emit('PLAYER_CONFIRMED');
    io.to(roomId).emit('NEW_TURN', {
      currentPlayer: room.getCurrentPlayerName(),
      currentPlayerId: room.getCurrentPlayerId(),
      affirmation: room.currentAffirmation,
      round: room.round,
      phase: room.phase,
      type: room.currentAffirmationType,
    });
    // SIN auto-timer — termina solo cuando todos votan (o el host fuerza reveal)
  });

  socket.on('SUBMIT_GUESS', ({ roomId, guess }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.phase !== 'guessing') return;
    if (socket.id === room.getCurrentPlayerId()) return;

    room.submitGuess(socket.id, guess);
    const status = room.getGuessStatus();
    io.to(roomId).emit('GUESS_COUNT', status);

    if (status.voted === status.total) doReveal(room, roomId);
  });

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
    triggerImageGen(room, roomId);
  }

  function triggerImageGen(room: any, roomId: string) {
    if (!isImageGenAvailable() || !room.currentAffirmationTemplate) return;
    const turnRound = room.round;
    const yoPlayer = room.getCurrentPlayer();
    const otroPlayer = room.getOtherPlayer();
    if (!yoPlayer?.profile?.selfieBase64) return; // no selfie → skip

    const yoArg = {
      name: yoPlayer.name,
      gender: yoPlayer.profile.gender,
      selfieBase64: yoPlayer.profile.selfieBase64,
      role: yoPlayer.profile.role,
    };
    const otroArg = otroPlayer?.profile
      ? {
          name: otroPlayer.name,
          gender: otroPlayer.profile.gender,
          selfieBase64: otroPlayer.profile.selfieBase64,
          role: otroPlayer.profile.role,
        }
      : undefined;

    generateTurnImage(
      room.currentRelationType,
      room.currentAffirmationTemplate,
      yoArg,
      otroArg,
    ).then((imageBase64: string | null) => {
      if (!imageBase64) return;
      // Si ya cambiamos de turno, no emitimos
      if (room.round !== turnRound) return;
      room.currentImageBase64 = imageBase64;
      io.to(roomId).emit('IMAGE_READY', { round: turnRound, imageBase64 });
    }).catch((err: any) => {
      console.error('Image gen failed for turn', turnRound, err?.message || err);
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
      imageBase64: room.currentImageBase64 || undefined,
    });
    io.to(roomId).emit('SCOREBOARD', { scores: room.getScoreboard() });
    // SIN auto-advance — solo el host avanza con NEXT_TURN
  }

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
    triggerImageGen(room, roomId);
  });

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
