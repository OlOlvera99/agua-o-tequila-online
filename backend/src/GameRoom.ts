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

export class GameRoom {
  id: string;
  hostId: string;
  players: Player[] = [];
  phase: GamePhase = 'lobby';
  settings: GameSettings;
  lastActivity: number = Date.now();

  // Turno
  round: number = 0;
  currentPlayerIndex: number = -1;
  currentAffirmation: string = '';
  currentAffirmationType: AffirmationType = 'general';
  currentTruth: boolean | null = null;
  currentRelationType: RelationType = 'amigos_generico';
  currentOtherPlayerName: string = '';

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
    console.log(`📋 Pool inicial — groupVibe: ${this.settings.groupVibe} | ${this.fallbackPool.length} fallback genéricas`);
  }

  /**
   * Elige al otro jugador con quien se construye la afirmación interpersonal.
   * Preferencia:
   *   1) Alguien con quien el current player tenga una relación REPORTADA específica (no 'conocido'/'otro')
   *   2) Cualquier otro jugador
   */
  private pickOtroFor(currentPlayer: Player): Player {
    const others = this.players.filter(p => p.socketId !== currentPlayer.socketId);
    const rels = currentPlayer.profile?.relationships || {};

    const withSpecificRel = others.filter(p => {
      const r = rels[p.name];
      return r && r !== 'conocido' && r !== 'otro';
    });

    const candidates = withSpecificRel.length > 0 ? withSpecificRel : others;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  private pickAffirmation(): void {
    const currentPlayer = this.players[this.currentPlayerIndex];
    const otro = this.pickOtroFor(currentPlayer);

    if (!otro) {
      // Sala con 1 jugador (edge case) — pick from fallback genérico
      this.pickFromFallback(currentPlayer);
      return;
    }

    // Resolver pool basado en la relación específica entre estos dos
    const kindA = currentPlayer.profile?.relationships?.[otro.name];
    const kindB = otro.profile?.relationships?.[currentPlayer.name];
    const genderA = currentPlayer.profile?.gender || 'otro';
    const genderB = otro.profile?.gender || 'otro';

    const { pool, relationType } = getPoolForPair(
      kindA, kindB, genderA, genderB,
      this.settings.level, this.settings.groupVibe,
    );

    const available = pool.filter(a => !this.usedTemplates.has(a.text));

    if (available.length > 0) {
      const chosen = available[Math.floor(Math.random() * available.length)];
      this.usedTemplates.add(chosen.text);
      this.currentAffirmation = fillTemplate(chosen.text, currentPlayer.name, otro.name);
      this.currentAffirmationType = chosen.text.includes('{otro}') ? 'interpersonal' : 'general';
      this.currentRelationType = relationType;
      this.currentOtherPlayerName = otro.name;
      console.log(`🎯 [${relationType}] (${currentPlayer.name} → ${otro.name}): "${this.currentAffirmation}"`);
      return;
    }

    // Si el pool específico ya se agotó, intentar pool de groupVibe como respaldo,
    // y si todo se agota, reciclar usados.
    this.pickFromFallback(currentPlayer, otro);
  }

  private pickFromFallback(currentPlayer: Player, otro?: Player): void {
    const available = this.fallbackPool.filter(t => !this.usedTemplates.has(t));
    if (available.length === 0) {
      // Se acabó todo → reciclar
      this.usedTemplates.clear();
      this.shuffleArray(this.fallbackPool);
      // Re-intentar una vez (sin recursión infinita: si fallback está vacío, abort)
      if (this.fallbackPool.length === 0) {
        this.currentAffirmation = 'Se acabaron las afirmaciones.';
        this.currentAffirmationType = 'general';
        return;
      }
      return this.pickFromFallback(currentPlayer, otro);
    }
    const template = available[Math.floor(Math.random() * available.length)];
    this.usedTemplates.add(template);
    const playerNames = this.players.map(p => p.name);
    const text = template.replace(/\{nombre\}/g, () => playerNames[Math.floor(Math.random() * playerNames.length)]);
    this.currentAffirmation = text;
    this.currentAffirmationType = 'general';
    this.currentRelationType = 'amigos_generico';
    this.currentOtherPlayerName = otro?.name || '';
    console.log(`📦 Fallback: "${this.currentAffirmation}"`);
  }

  regenerateAffirmation() {
    this.pickAffirmation();
    this.touch();
  }

  // ═══════════ TURNOS ═══════════

  startNextTurn() {
    this.clearTimers();
    this.round++;
    this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
    this.currentTruth = null;
    this.phase = 'confirming';

    this.players.forEach(p => { p.currentGuess = null; });

    this.pickAffirmation();
    this.touch();
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
