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
  maxHttpBufferSize: 5e6,
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
      upcomingTurns: room.upcomingTurns.map(t => ({
        round: t.round,
        yo: t.yoName,
        otro: t.otroName,
        affirmation: t.affirmation,
        imageReady: !!t.imageBase64,
        imageGenStarted: t.imageGenStarted,
      })),
    });
  });
}

// ═══════════ VALIDATION ═══════════
const LIMITS = {
  playerName: 30,
  roomId: 12,
  selfieBase64: 3_500_000,
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

// ═══════════ IMAGE PIPELINE ═══════════
/**
 * Para cada PendingTurn que no haya iniciado generación, dispara gen en paralelo.
 * Cuando termina, guarda el resultado en el turn y emite IMAGE_READY si ese turn
 * coincide con el round actual.
 */
function kickoffPendingImageGen(room: any, roomId: string) {
  if (!isImageGenAvailable()) return;
  for (const turn of room.upcomingTurns) {
    if (turn.imageGenStarted) continue;
    room.markImageGenStarted(turn.round);
    const yoPlayer = room.players.find((p: any) => p.socketId === turn.yoSocketId);
    const otroPlayer = room.players.find((p: any) => p.name === turn.otroName);
    if (!yoPlayer?.profile?.selfieBase64) continue;

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

    const roundCaptured = turn.round;
    const templateCaptured = turn.template;
    generateTurnImage(turn.relationType, turn.template, yoArg, otroArg)
      .then((imageBase64: string | null) => {
        if (!imageBase64) return;
        // Guardar en el turn (puede estar en cola o ser el current)
        room.setImageForRound(roundCaptured, imageBase64);
        // Si es el round actual EN VIVO, emitir IMAGE_READY al room
        if (room.round === roundCaptured) {
          io.to(roomId).emit('IMAGE_READY', { round: roundCaptured, imageBase64 });
        }
      })
      .catch((err: any) => {
        console.error(`Image gen failed for R${roundCaptured} (${templateCaptured.slice(0, 40)}…):`, err?.message || err);
      });
  }
}

/**
 * Espera (con timeout) a que el primer turno de la cola tenga su imagen lista.
 * Para el "loading screen" al inicio del juego.
 */
function waitForFirstImage(room: any, timeoutMs = 35000): Promise<void> {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const check = () => {
      const first = room.upcomingTurns[0];
      if (!first) return resolve(); // sin upcoming → nada que esperar
      if (first.imageBase64) return resolve();
      if (Date.now() - t0 > timeoutMs) return resolve(); // timeout
      setTimeout(check, 500);
    };
    check();
  });
}

io.on('connection', (socket) => {
  console.log(`🔌 Conectado: ${socket.id}`);

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
    if (settings.level && VALID_LEVELS.includes(settings.level as any)) cleaned.level = settings.level;
    if (settings.groupVibe && VALID_GROUP_VIBES.includes(settings.groupVibe as any)) cleaned.groupVibe = settings.groupVibe;
    room.updateSettings(cleaned);
    io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
  });

  socket.on('SUBMIT_PROFILE', ({ roomId, profile }) => {
    if (!checkRate(socket.id, 8, 60_000)) return;
    const room = roomManager.getRoom(roomId);
    if (!room) return;
    if (!profile || typeof profile !== 'object') return;
    const otherNames = new Set(
      room.players.filter(p => p.socketId !== socket.id).map(p => p.name)
    );
    const cleanRelationships: Record<string, RelationKind> = {};
    if (profile.relationships && typeof profile.relationships === 'object') {
      for (const [name, kind] of Object.entries(profile.relationships)) {
        if (otherNames.has(name) && VALID_RELATION_KINDS.includes(kind as any)) {
          cleanRelationships[name] = kind as RelationKind;
        }
      }
    }
    let cleanSelfie: string | undefined;
    if (typeof profile.selfieBase64 === 'string' && profile.selfieBase64.length > 0) {
      if (profile.selfieBase64.length <= LIMITS.selfieBase64) cleanSelfie = profile.selfieBase64;
    }
    const cleanProfile = {
      gender: VALID_GENDERS.includes(profile.gender as any) ? profile.gender : 'otro',
      role: typeof profile.role === 'string' && profile.role.length <= 30 ? profile.role.trim() : undefined,
      relationships: cleanRelationships,
      selfieBase64: cleanSelfie,
    };
    room.submitProfile(socket.id, cleanProfile as any);
    const progress = room.getQuestionnaireProgress();
    io.to(roomId).emit('QUESTIONNAIRE_PROGRESS', progress);
    io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
  });

  // ═══════════ INICIAR JUEGO ═══════════

  socket.on('START_GAME', async ({ roomId }) => {
    const room = roomManager.getRoom(roomId);
    if (!room || room.hostId !== socket.id || room.players.length < 2) return;

    if (room.phase === 'lobby') {
      room.phase = 'questionnaire';
      io.to(roomId).emit('QUESTIONNAIRE_START', { players: room.players.map(p => p.name) });
      io.to(roomId).emit('ROOM_UPDATE', room.getLobbyState());
      return;
    }

    if (room.phase === 'questionnaire') {
      // Aviso al cliente que estamos cargando (esto pinta loading screen)
      io.to(roomId).emit('STARTING_GAME');
      room.initPool();
      // Pre-compute primeros 3 turnos
      room.precomputeUpcoming(room.LOOKAHEAD);
      // Disparar generación de imagen para los 3 en paralelo
      kickoffPendingImageGen(room, roomId);
      // Esperar a que el PRIMER turno tenga imagen (o timeout 35s)
      await waitForFirstImage(room, 35000);
      // Empezar turno 1
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
      imageBase64: room.currentImageBase64 || undefined, // ← bugfix: ahora propagamos imagen al cambiar a guessing
    });
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
      imageBase64: room.currentImageBase64 || undefined,
    });
    // Refill ya se hace en startNextTurn — solo disparar gen de los nuevos en cola
    kickoffPendingImageGen(room, roomId);
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
      imageBase64: room.currentImageBase64 || undefined,
    });
    // Disparar gen para la nueva afirmación si tiene selfie
    // (la generación corre como turno virtual round === room.round)
    // El trigger lo hacemos creando un PendingTurn virtual o usando la lógica existente
    // — por simplicidad: emit con la imagen vacía y el cliente la espera
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
