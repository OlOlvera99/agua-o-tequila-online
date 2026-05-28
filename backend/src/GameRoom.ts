import { customAlphabet } from 'nanoid';
import { AFFIRMATIONS } from './affirmations';
import {
  getPoolForPair, fillTemplate, GROUP_VIBE_CONFIG, ViralAffirmation
} from './viralAffirmations';
import type {
  Player, GameSettings, GamePhase, RoundResults, ScoreEntry,
  PlayerProfile, AffirmationType, RelationType, GroupVibe,
} from './types';

const generateId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

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

  addPlayer(socketId: string, name: string, isHost = false) {
    this.players.push({
      socketId,
      name,
      isHost,
      shotsTaken: 0,
      correctGuesses: 0,
      currentGuess: null,
      profile: null,
      questionnaireReady: false,
    });
    this.touch();
  }

  removePlayer(socketId: string) {
    this.players = this.players.filter(p => p.socketId !== socketId);
    if (this.hostId === socketId && this.players.length > 0) {
      this.hostId = this.players[0].socketId;
      this.players[0].isHost = true;
    }
    this.touch();
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
    const yoPlayer = this.players[yoIdx];
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

    const available = pool.filter(a => !this.usedTemplates.has(a.text));
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
    const others = this.players.filter(p => p.socketId !== currentPlayer.socketId);
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

    // Consumir el siguiente PendingTurn de la cola
    const next = this.upcomingTurns.shift();
    if (next) {
      this.applyPendingTurnAsCurrent(next);
    } else {
      // Fallback (cola vacía): construir uno fresco
      this.round++;
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
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
      // Player desconectado — usar índice 0 como fallback
      this.currentPlayerIndex = 0;
    }
    this.currentAffirmation = t.affirmation;
    this.currentAffirmationTemplate = t.template;
    this.currentAffirmationType = t.type;
    this.currentRelationType = t.relationType;
    this.currentOtherPlayerName = t.otroName;
    this.currentImageBase64 = t.imageBase64 || '';
    console.log(`🎯 R${t.round} [${t.relationType}] ${t.yoName}→${t.otroName}: "${t.affirmation}"${t.imageBase64 ? ' 🖼️' : ''}`);
  }

  getCurrentPlayerId(): string {
    return this.players[this.currentPlayerIndex].socketId;
  }

  getCurrentPlayerName(): string {
    return this.players[this.currentPlayerIndex].name;
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
    const voters = this.players.filter(p => p.socketId !== this.getCurrentPlayerId());
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
    const voters = this.players.filter(p => p.socketId !== this.getCurrentPlayerId());
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
      })),
      settings: this.settings,
      phase: this.phase,
      playerCount: this.players.length,
      questionnaireProgress: this.getQuestionnaireProgress(),
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
