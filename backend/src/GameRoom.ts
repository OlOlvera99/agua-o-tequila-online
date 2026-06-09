import { customAlphabet } from 'nanoid';
import { AFFIRMATIONS } from './affirmations';
import {
  getPoolForPair, fillTemplate, GROUP_VIBE_CONFIG, ViralAffirmation,
  getYoRoleForPair, filterByOrientation,
} from './viralAffirmations';
import type {
  Player, GameSettings, GamePhase, RoundResults, ScoreEntry,
  PlayerProfile, AffirmationType, RelationType, GroupVibe,
} from './types';

const generateId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);
const generateToken = customAlphabet('abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 24);

/**
 * Un turno preparado pero todavía no jugado.
 * Permite pre-generar imágenes mientras se juegan turnos anteriores.
 */
export interface PendingTurn {
  round: number;
  yoSocketId: string;
  yoName: string;
  otroName: string;
  template: string;          // texto con {yo}/{otro}
  affirmation: string;       // texto ya rellenado
  type: AffirmationType;
  relationType: RelationType;
  imageBase64?: string;
  imageGenStarted: boolean;
  imageGenAttempts?: number; // para retry con límite tras errores transitorios
}

export class GameRoom {
  id: string;
  hostId: string;
  players: Player[] = [];
  phase: GamePhase = 'lobby';
  settings: GameSettings;
  lastActivity: number = Date.now();

  // Turno actual
  round: number = 0;
  currentPlayerIndex: number = -1;
  currentAffirmation: string = '';
  currentAffirmationTemplate: string = '';
  currentAffirmationType: AffirmationType = 'general';
  currentTruth: boolean | null = null;
  currentRelationType: RelationType = 'amigos_generico';
  currentOtherPlayerName: string = '';
  currentImageBase64: string = '';
  /** Referencia al PendingTurn aplicado como current (para image-gen tardía/regeneración). */
  currentTurnRef: PendingTurn | null = null;
  /** Último payload de REVEAL — para restaurar estado al reconectarse en fase reveal. */
  lastReveal: any = null;

  /** Historial corto de eventos para contexto en bug reports. */
  history: string[] = [];

  logEvent(msg: string) {
    this.history.push(`${new Date().toISOString().slice(11, 19)} ${msg}`);
    if (this.history.length > 50) this.history.shift();
  }

  // ═══════════ COLA DE TURNOS PRE-COMPUTADOS ═══════════
  // Permite pre-generar imágenes mientras se juega.
  upcomingTurns: PendingTurn[] = [];
  readonly LOOKAHEAD = 3;

  // Pool tracking
  private usedTemplates: Set<string> = new Set();
  private fallbackPool: string[] = [];

  // Timer
  private guessTimerId: NodeJS.Timeout | null = null;
  private revealTimerId: NodeJS.Timeout | null = null;
  onTimerExpired: (() => void) | null = null;
  onAutoAdvance: (() => void) | null = null;

  constructor(hostId: string, hostName: string, settings: Partial<GameSettings>) {
    this.id = generateId();
    this.hostId = hostId;
    this.settings = {
      level: settings.level || 'picante',
      groupVibe: settings.groupVibe || 'amigos_mixto',
      timerSeconds: 30,
    };
    this.addPlayer(hostId, hostName, true);
  }

  // ═══════════ JUGADORES ═══════════

  addPlayer(socketId: string, name: string, isHost = false): Player {
    const player: Player = {
      socketId,
      name,
      isHost,
      shotsTaken: 0,
      correctGuesses: 0,
      currentGuess: null,
      profile: null,
      questionnaireReady: false,
      connected: true,
      token: generateToken(),
    };
    this.players.push(player);
    this.touch();
    return player;
  }

  removePlayer(socketId: string) {
    this.players = this.players.filter(p => p.socketId !== socketId);
    if (this.hostId === socketId && this.players.length > 0) {
      this.hostId = this.players[0].socketId;
      this.players[0].isHost = true;
    }
    this.touch();
  }

  /** Marca un jugador como desconectado SIN sacarlo del juego (puede volver). */
  markDisconnected(socketId: string): Player | undefined {
    const p = this.players.find(pl => pl.socketId === socketId);
    if (p) {
      p.connected = false;
      this.logEvent(`DISCONNECT ${p.name} (fase ${this.phase}, R${this.round})`);
      console.log(`🔌💤 ${p.name} desconectado (puede reconectarse)`);
    }
    this.touch();
    return p;
  }

  /**
   * Re-asocia un jugador existente a un socket nuevo (reconexión).
   * - Si el jugador sigue marcado como conectado, exige token correcto
   *   (protege contra suplantación de nombre).
   * - Remapea hostId y los sockets de la cola de turnos.
   */
  reattachPlayer(name: string, token: string | null | undefined, newSocketId: string): Player | null {
    const p = this.players.find(pl => pl.name === name);
    if (!p) return null;
    if (p.connected && (!token || token !== p.token)) return null;
    if (token && token !== p.token) return null;

    const oldId = p.socketId;
    p.socketId = newSocketId;
    p.connected = true;
    if (this.hostId === oldId) this.hostId = newSocketId;
    this.upcomingTurns.forEach(t => { if (t.yoSocketId === oldId) t.yoSocketId = newSocketId; });
    if (this.currentTurnRef && this.currentTurnRef.yoSocketId === oldId) {
      this.currentTurnRef.yoSocketId = newSocketId;
    }
    this.logEvent(`RECONNECT ${p.name} (fase ${this.phase}, R${this.round})`);
    console.log(`🔌✅ ${p.name} reconectado (${oldId.slice(0, 6)}… → ${newSocketId.slice(0, 6)}…)`);
    this.touch();
    return p;
  }

  connectedPlayers(): Player[] {
    return this.players.filter(p => p.connected !== false);
  }

  updateSettings(settings: Partial<GameSettings>) {
    if (settings.level) this.settings.level = settings.level;
    if (settings.groupVibe) this.settings.groupVibe = settings.groupVibe;
    this.touch();
  }

  // ═══════════ CUESTIONARIO ═══════════

  submitProfile(socketId: string, profile: PlayerProfile) {
    const player = this.players.find(p => p.socketId === socketId);
    if (player) {
      player.profile = profile;
      player.questionnaireReady = true;
    }
    this.touch();
  }

  getQuestionnaireProgress(): { ready: number; total: number } {
    const ready = this.players.filter(p => p.questionnaireReady).length;
    return { ready, total: this.players.length };
  }

  allQuestionnairesReady(): boolean {
    return this.players.every(p => p.questionnaireReady);
  }

  // ═══════════ POOL DE AFIRMACIONES ═══════════

  initPool() {
    this.fallbackPool = [...(AFFIRMATIONS[this.settings.level] || [])];
    this.shuffleArray(this.fallbackPool);
    this.usedTemplates.clear();
    this.upcomingTurns = [];
    console.log(`📋 Pool inicial — groupVibe: ${this.settings.groupVibe} | ${this.fallbackPool.length} fallback genéricas`);
  }

  /**
   * Pre-computa los siguientes N turnos (afirmación + yo + otro) y los mete a la cola.
   * NO inicia generación de imagen — eso lo hace el server.
   */
  precomputeUpcoming(n: number = this.LOOKAHEAD): PendingTurn[] {
    const newlyAdded: PendingTurn[] = [];
    while (this.upcomingTurns.length < n) {
      const offset = this.upcomingTurns.length + 1;
      const nextRound = this.round + offset;
      const nextPlayerIdx = (this.currentPlayerIndex + offset) % this.players.length;
      const turn = this.buildTurnForPlayer(nextRound, nextPlayerIdx);
      if (!turn) break;
      this.upcomingTurns.push(turn);
      newlyAdded.push(turn);
    }
    return newlyAdded;
  }

  /** Construye un PendingTurn sin mutar currentPlayerIndex/round. */
  private buildTurnForPlayer(roundNum: number, yoIdx: number): PendingTurn | null {
    // Si el jugador en yoIdx está desconectado, avanzar al siguiente conectado
    let yoPlayer: Player | undefined;
    for (let i = 0; i < this.players.length; i++) {
      const candidate = this.players[(yoIdx + i) % this.players.length];
      if (candidate && candidate.connected !== false) { yoPlayer = candidate; break; }
    }
    if (!yoPlayer) return null;
    const otro = this.pickOtroFor(yoPlayer);

    if (!otro) {
      // 1 jugador — fallback genérico
      return this.buildFallbackTurn(roundNum, yoPlayer, null);
    }

    const kindA = yoPlayer.profile?.relationships?.[otro.name];
    const kindB = otro.profile?.relationships?.[yoPlayer.name];
    const genderA = yoPlayer.profile?.gender || 'otro';
    const genderB = otro.profile?.gender || 'otro';

    const { pool, relationType } = getPoolForPair(
      kindA, kindB, genderA, genderB,
      this.settings.level, this.settings.groupVibe,
    );

    // ── Filtro de orientación para pools asimétricos (madre/hijo, suegra/nuera…) ──
    // Evita que a la mamá le toque un template escrito desde la perspectiva del hijo.
    const yoRole = getYoRoleForPair(relationType, kindA, kindB);
    const oriented = filterByOrientation(pool, yoRole);

    let available = oriented.filter(a => !this.usedTemplates.has(a.text));
    if (available.length === 0 && oriented.length > 0) {
      // ── Reciclar pool curado en vez de caer a genéricas (que no tienen imagen) ──
      oriented.forEach(a => this.usedTemplates.delete(a.text));
      available = oriented.filter(a => a.text !== this.currentAffirmationTemplate);
      if (available.length === 0) available = oriented;
      console.log(`♻️  Pool ${relationType} reciclado (${oriented.length} templates, yoRole=${yoRole ?? '—'})`);
    }
    if (available.length === 0) {
      return this.buildFallbackTurn(roundNum, yoPlayer, otro);
    }

    const chosen = available[Math.floor(Math.random() * available.length)];
    this.usedTemplates.add(chosen.text);

    return {
      round: roundNum,
      yoSocketId: yoPlayer.socketId,
      yoName: yoPlayer.name,
      otroName: otro.name,
      template: chosen.text,
      affirmation: fillTemplate(chosen.text, yoPlayer.name, otro.name),
      type: chosen.text.includes('{otro}') ? 'interpersonal' : 'general',
      relationType,
      imageGenStarted: false,
    };
  }

  private buildFallbackTurn(roundNum: number, yoPlayer: Player, otro: Player | null): PendingTurn | null {
    const available = this.fallbackPool.filter(t => !this.usedTemplates.has(t));
    if (available.length === 0) {
      // Si está vacío, reciclar
      this.usedTemplates.clear();
      this.shuffleArray(this.fallbackPool);
      if (this.fallbackPool.length === 0) return null;
      return this.buildFallbackTurn(roundNum, yoPlayer, otro);
    }
    const template = available[Math.floor(Math.random() * available.length)];
    this.usedTemplates.add(template);
    const playerNames = this.players.map(p => p.name);
    const text = template.replace(/\{nombre\}/g, () => playerNames[Math.floor(Math.random() * playerNames.length)]);
    return {
      round: roundNum,
      yoSocketId: yoPlayer.socketId,
      yoName: yoPlayer.name,
      otroName: otro?.name || '',
      template,
      affirmation: text,
      type: 'general',
      relationType: 'amigos_generico',
      imageGenStarted: false,
    };
  }

  /**
   * Elige al otro jugador con quien se construye la afirmación interpersonal.
   * Preferencia: alguien con relación específica reportada > cualquier otro.
   */
  private pickOtroFor(currentPlayer: Player): Player | undefined {
    // Solo jugadores conectados — no construir afirmaciones sobre alguien ausente
    const others = this.players.filter(p => p.socketId !== currentPlayer.socketId && p.connected !== false);
    if (others.length === 0) return undefined;
    const rels = currentPlayer.profile?.relationships || {};
    const withSpecificRel = others.filter(p => {
      const r = rels[p.name];
      return r && r !== 'conocido' && r !== 'otro';
    });
    const candidates = withSpecificRel.length > 0 ? withSpecificRel : others;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  /** Marca un PendingTurn como que ya empezó su generación de imagen. */
  markImageGenStarted(round: number) {
    const t = this.upcomingTurns.find(t => t.round === round);
    if (t) t.imageGenStarted = true;
  }

  /** Guarda la imagen generada en el PendingTurn correspondiente. */
  setImageForRound(round: number, imageBase64: string) {
    const t = this.upcomingTurns.find(t => t.round === round);
    if (t) t.imageBase64 = imageBase64;
    // Si es el round actual, también update current
    if (this.round === round) {
      this.currentImageBase64 = imageBase64;
    }
  }

  /** Para regenerar la afirmación actual sin perder el ritmo del pipeline. */
  regenerateAffirmation() {
    // Quitar el current de "used"
    if (this.currentAffirmationTemplate) {
      this.usedTemplates.delete(this.currentAffirmationTemplate);
    }
    const newTurn = this.buildTurnForPlayer(this.round, this.currentPlayerIndex);
    if (newTurn) {
      this.applyPendingTurnAsCurrent(newTurn);
    }
    this.touch();
  }

  // ═══════════ TURNOS ═══════════

  startNextTurn() {
    this.clearTimers();
    this.players.forEach(p => { p.currentGuess = null; });
    this.currentTruth = null;
    this.phase = 'confirming';

    // Consumir el siguiente PendingTurn VÁLIDO de la cola.
    // Turnos cuyo {yo} u {otro} está desconectado se descartan (ya no aplican).
    let next: PendingTurn | undefined;
    while ((next = this.upcomingTurns.shift())) {
      const yoP = this.players.find(pl => pl.socketId === next!.yoSocketId);
      const otroOk = !next.otroName || this.players.some(
        pl => pl.name === next!.otroName && pl.connected !== false
      );
      if (yoP && yoP.connected !== false && otroOk) break;
      console.log(`⏭️  Turno descartado (jugador ausente): R${next.round} ${next.yoName}→${next.otroName}`);
      next = undefined;
    }

    if (next) {
      this.applyPendingTurnAsCurrent(next);
    } else {
      // Fallback (cola vacía): construir uno fresco para el siguiente conectado
      this.round++;
      for (let i = 1; i <= this.players.length; i++) {
        const idx = (this.currentPlayerIndex + i) % this.players.length;
        if (this.players[idx]?.connected !== false) { this.currentPlayerIndex = idx; break; }
      }
      const fresh = this.buildTurnForPlayer(this.round, this.currentPlayerIndex);
      if (fresh) this.applyPendingTurnAsCurrent(fresh);
    }

    // Refill cola
    this.precomputeUpcoming(this.LOOKAHEAD);
    this.touch();
  }

  private applyPendingTurnAsCurrent(t: PendingTurn) {
    this.round = t.round;
    this.currentPlayerIndex = this.players.findIndex(p => p.socketId === t.yoSocketId);
    if (this.currentPlayerIndex === -1) {
      // Defensivo (startNextTurn ya valida): primer conectado disponible
      this.currentPlayerIndex = Math.max(0, this.players.findIndex(p => p.connected !== false));
    }
    this.currentTurnRef = t;
    this.currentAffirmation = t.affirmation;
    this.currentAffirmationTemplate = t.template;
    this.currentAffirmationType = t.type;
    this.currentRelationType = t.relationType;
    this.currentOtherPlayerName = t.otroName;
    this.currentImageBase64 = t.imageBase64 || '';
    this.logEvent(`TURN R${t.round} [${t.relationType}] ${t.yoName}→${t.otroName} "${t.affirmation}" img=${t.imageBase64 ? 'sí' : 'no'}`);
    console.log(`🎯 R${t.round} [${t.relationType}] ${t.yoName}→${t.otroName}: "${t.affirmation}"${t.imageBase64 ? ' 🖼️' : ''}`);
  }

  getCurrentPlayerId(): string {
    return this.players[this.currentPlayerIndex]?.socketId || '';
  }

  getCurrentPlayerName(): string {
    return this.players[this.currentPlayerIndex]?.name || '';
  }

  getCurrentPlayer(): Player {
    return this.players[this.currentPlayerIndex];
  }

  getOtherPlayer(): Player | undefined {
    return this.players.find(p => p.name === this.currentOtherPlayerName);
  }

  // ═══════════ FASE 2: CONFIRMACIÓN ═══════════

  setTruth(isTrue: boolean) {
    this.currentTruth = isTrue;
    this.touch();
  }

  // ═══════════ FASE 3: ADIVINANZAS ═══════════

  startGuessTimer() {
    this.clearTimers();
    this.guessTimerId = setTimeout(() => {
      this.forceGuessTimeout();
      if (this.onTimerExpired) this.onTimerExpired();
    }, this.settings.timerSeconds * 1000);
  }

  submitGuess(socketId: string, guess: 'verdad' | 'mentira') {
    const player = this.players.find(p => p.socketId === socketId);
    if (player && player.socketId !== this.getCurrentPlayerId()) {
      player.currentGuess = guess;
    }
    this.touch();
  }

  getGuessStatus(): { voted: number; total: number } {
    // Solo conectados — si alguien se cae a media ronda, la votación no se atora esperándolo
    const voters = this.players.filter(
      p => p.socketId !== this.getCurrentPlayerId() && p.connected !== false
    );
    const voted = voters.filter(p => p.currentGuess !== null).length;
    return { voted, total: voters.length };
  }

  private forceGuessTimeout() {
    const truthAnswer = this.currentTruth ? 'verdad' : 'mentira';
    const wrongAnswer = truthAnswer === 'verdad' ? 'mentira' : 'verdad';
    this.players.forEach(p => {
      if (p.socketId !== this.getCurrentPlayerId() && p.currentGuess === null) {
        p.currentGuess = wrongAnswer;
      }
    });
  }

  // ═══════════ FASE 4: RESULTADOS ═══════════

  calculateResults(): RoundResults {
    const truthAnswer = this.currentTruth ? 'verdad' : 'mentira';
    const voters = this.players.filter(
      p => p.socketId !== this.getCurrentPlayerId() && p.connected !== false
    );
    const currentPlayer = this.players[this.currentPlayerIndex];
    const wrongAnswer: 'verdad' | 'mentira' = truthAnswer === 'verdad' ? 'mentira' : 'verdad';

    const guesses = voters.map(p => ({
      playerName: p.name,
      guess: (p.currentGuess ?? wrongAnswer) as 'verdad' | 'mentira',
      correct: p.currentGuess === truthAnswer,
    }));

    const allCorrect = guesses.every(g => g.correct);
    const allWrong = guesses.every(g => !g.correct);

    let drinkers: string[] = [];
    let reason: 'all_correct' | 'all_wrong' | 'mixed';

    if (allCorrect) {
      drinkers = [currentPlayer.name];
      currentPlayer.shotsTaken++;
      reason = 'all_correct';
    } else if (allWrong) {
      drinkers = [currentPlayer.name];
      currentPlayer.shotsTaken++;
      reason = 'all_wrong';
    } else {
      reason = 'mixed';
      voters.forEach(p => {
        if (p.currentGuess !== truthAnswer) {
          p.shotsTaken++;
          drinkers.push(p.name);
        }
      });
    }

    voters.forEach(p => {
      if (p.currentGuess === truthAnswer) p.correctGuesses++;
    });

    this.touch();
    return { guesses, drinkers, reason };
  }

  startRevealTimer() {
    this.clearTimers();
    this.revealTimerId = setTimeout(() => {
      if (this.onAutoAdvance) this.onAutoAdvance();
    }, 10_000);
  }

  // ═══════════ STATE EMITS ═══════════

  getScoreboard(): ScoreEntry[] {
    return this.players
      .map(p => ({
        playerName: p.name,
        shotsTaken: p.shotsTaken,
        correctGuesses: p.correctGuesses,
      }))
      .sort((a, b) => b.shotsTaken - a.shotsTaken);
  }

  getLobbyState() {
    return {
      id: this.id,
      hostId: this.hostId,
      players: this.players.map(p => ({
        name: p.name,
        socketId: p.socketId,
        isHost: p.isHost,
        questionnaireReady: p.questionnaireReady,
        connected: p.connected !== false,
      })),
      settings: this.settings,
      phase: this.phase,
      playerCount: this.players.length,
      questionnaireProgress: this.getQuestionnaireProgress(),
    };
  }

  /**
   * Snapshot completo del estado del juego para reconexiones —
   * suficiente para que el cliente repinte la pantalla correcta.
   */
  getSnapshotFor(socketId: string) {
    const me = this.players.find(p => p.socketId === socketId);
    const hasTurn = this.phase === 'confirming' || this.phase === 'guessing' || this.phase === 'reveal';
    return {
      lobby: this.getLobbyState(),
      phase: this.phase,
      turn: hasTurn && this.currentAffirmation ? {
        currentPlayer: this.getCurrentPlayerName(),
        currentPlayerId: this.getCurrentPlayerId(),
        affirmation: this.currentAffirmation,
        round: this.round,
        phase: this.phase,
        type: this.currentAffirmationType,
        imageBase64: this.currentImageBase64 || undefined,
      } : null,
      guessCount: this.phase === 'guessing' ? this.getGuessStatus() : null,
      scoreboard: this.getScoreboard(),
      reveal: this.phase === 'reveal' ? this.lastReveal : null,
      myGuess: me?.currentGuess ?? null,
    };
  }

  /**
   * Dump completo para bug reports — todo lo necesario para analizar la falla,
   * SIN base64 (selfies/imágenes) para que el log sea legible y ligero.
   */
  getDebugDump() {
    return {
      roomId: this.id,
      phase: this.phase,
      round: this.round,
      settings: this.settings,
      currentAffirmation: this.currentAffirmation,
      currentTemplate: this.currentAffirmationTemplate,
      currentRelationType: this.currentRelationType,
      currentPlayer: this.getCurrentPlayerName(),
      currentOtherPlayer: this.currentOtherPlayerName,
      currentTruth: this.currentTruth,
      currentHasImage: !!this.currentImageBase64,
      players: this.players.map(p => ({
        name: p.name,
        isHost: p.isHost,
        connected: p.connected !== false,
        ready: p.questionnaireReady,
        gender: p.profile?.gender,
        hasSelfie: !!p.profile?.selfieBase64,
        relationships: p.profile?.relationships,
        guess: p.currentGuess,
        shots: p.shotsTaken,
      })),
      upcomingTurns: this.upcomingTurns.map(t => ({
        round: t.round,
        yo: t.yoName,
        otro: t.otroName,
        relationType: t.relationType,
        affirmation: t.affirmation,
        imageReady: !!t.imageBase64,
        imageGenStarted: t.imageGenStarted,
        imageGenAttempts: t.imageGenAttempts || 0,
      })),
      history: this.history,
    };
  }

  // ═══════════ UTILS ═══════════

  private touch() { this.lastActivity = Date.now(); }

  private clearTimers() {
    if (this.guessTimerId) { clearTimeout(this.guessTimerId); this.guessTimerId = null; }
    if (this.revealTimerId) { clearTimeout(this.revealTimerId); this.revealTimerId = null; }
  }

  destroy() { this.clearTimers(); }

  private shuffleArray(arr: any[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
