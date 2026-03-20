import { customAlphabet } from 'nanoid';
import { AFFIRMATIONS } from './affirmations';
import { ClaudeService } from './ClaudeService';
import { generatePersonalizedAffirmations } from './PersonalizedEngine';
import type {
  Player, GameSettings, GamePhase, RoundResults, ScoreEntry,
  PlayerProfile, HostSecrets, GeneratedAffirmation, RoundHistory, AffirmationType
} from './types';

// IDs legibles tipo "RJZD96KUL9"
const generateId = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 10);

const claude = new ClaudeService();

export class GameRoom {
  id: string;
  hostId: string;
  players: Player[] = [];
  phase: GamePhase = 'lobby';
  settings: GameSettings;
  lastActivity: number = Date.now();

  // Estado del turno
  round: number = 0;
  currentPlayerIndex: number = -1;
  currentAffirmation: string = '';
  currentAffirmationType: AffirmationType = 'general';
  currentTruth: boolean | null = null;

  // Pool de afirmaciones (orden de prioridad: personalized > ai > fallback)
  personalizedPool: GeneratedAffirmation[] = [];
  aiPool: GeneratedAffirmation[] = [];
  affirmationPool: string[] = [];
  usedAffirmations: Set<string> = new Set();

  // Cuestionario + IA
  hostSecrets: HostSecrets = {};
  private roundHistory: RoundHistory[] = [];
  private isGenerating: boolean = false;

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
      context: settings.context || '',
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
    // Transferir host si se fue
    if (this.hostId === socketId && this.players.length > 0) {
      this.hostId = this.players[0].socketId;
      this.players[0].isHost = true;
    }
    this.touch();
  }

  updateSettings(settings: Partial<GameSettings>) {
    if (settings.level) this.settings.level = settings.level;
    if (settings.context !== undefined) this.settings.context = settings.context;
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

  setHostSecrets(secrets: HostSecrets) {
    this.hostSecrets = secrets;
    this.touch();
  }

  getQuestionnaireProgress(): { ready: number; total: number } {
    const ready = this.players.filter(p => p.questionnaireReady).length;
    return { ready, total: this.players.length };
  }

  allQuestionnairesReady(): boolean {
    return this.players.every(p => p.questionnaireReady);
  }

  // ═══════════ AFIRMACIONES ═══════════

  /** Genera pool local como fallback base */
  generateFallbackPool() {
    const pool = [...AFFIRMATIONS[this.settings.level]];
    const playerNames = this.players.map(p => p.name);

    this.affirmationPool = pool.map(aff => {
      return aff.replace(/\{nombre\}/g, () => {
        const randomName = playerNames[Math.floor(Math.random() * playerNames.length)];
        return randomName;
      });
    });
    this.shuffleArray(this.affirmationPool);

    // ═══════════ GENERAR PERSONALIZADAS (regex + virales) ═══════════
    this.personalizedPool = generatePersonalizedAffirmations(
      this.players,
      this.hostSecrets,
      this.settings.level,
    );

    console.log(`📋 Pool personalizado: ${this.personalizedPool.length} afirmaciones`);
    console.log(`📋 Pool fallback (genérico): ${this.affirmationPool.length} afirmaciones`);
  }

  /** 
   * Genera catalizadores inteligentes con Claude IA.
   * Estos tienen MÁXIMA prioridad (110) y se basan en el texto libre del cuestionario.
   * Se agregan al personalizedPool al inicio.
   */
  async generateAICatalysts(): Promise<boolean> {
    if (!claude.isAvailable()) {
      console.log('⚠️ Claude API no disponible, usando solo regex + fallback');
      return false;
    }

    const playersWithProfiles = this.players
      .filter(p => p.profile)
      .map(p => ({ name: p.name, profile: p.profile! }));

    if (playersWithProfiles.length === 0) return false;

    try {
      const catalysts = await claude.generateCatalystBatch(
        playersWithProfiles,
        this.hostSecrets,
        this.settings.level,
      );

      if (catalysts.length > 0) {
        // Insertar al INICIO del pool personalizado (máxima prioridad)
        this.personalizedPool = [...catalysts, ...this.personalizedPool];
        // Re-ordenar por prioridad
        this.personalizedPool.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        console.log(`🤖 Pool final: ${this.personalizedPool.length} personalizadas (${catalysts.length} IA + ${this.personalizedPool.length - catalysts.length} regex)`);
        return true;
      }
    } catch (err) {
      console.error('Error generando catalizadores IA:', err);
    }
    return false;
  }

  /** Genera afirmaciones con IA (adaptativas) */
  async generateAIBatch(): Promise<boolean> {
    if (!claude.isAvailable() || this.isGenerating) return false;

    const playersWithProfiles = this.players
      .filter(p => p.profile)
      .map(p => ({ name: p.name, profile: p.profile! }));

    if (playersWithProfiles.length === 0) return false;

    this.isGenerating = true;

    try {
      const currentPlayer = this.players[
        (this.currentPlayerIndex + 1) % this.players.length // next player
      ];

      const batch = await claude.generateBatch({
        players: playersWithProfiles,
        hostSecrets: this.hostSecrets,
        settings: this.settings,
        history: this.roundHistory,
        currentPlayerName: currentPlayer.name,
      }, 8);

      if (batch.length > 0) {
        this.aiPool.push(...batch);
        this.isGenerating = false;
        return true;
      }
    } catch (err) {
      console.error('Error generating AI batch:', err);
    }

    this.isGenerating = false;
    return false;
  }

  private pickAffirmation() {
    const currentPlayerName = this.getCurrentPlayerName();

    // ═══════════ PRIORIDAD 1: PERSONALIZADAS (del cuestionario/chisme) ═══════════
    const personalizedIndex = this.personalizedPool.findIndex(a =>
      a.targetPlayer === currentPlayerName && !this.usedAffirmations.has(a.text)
    );

    if (personalizedIndex !== -1) {
      const aff = this.personalizedPool.splice(personalizedIndex, 1)[0];
      this.currentAffirmation = aff.text;
      this.currentAffirmationType = aff.type;
      this.usedAffirmations.add(aff.text);
      console.log(`🎯 Afirmación PERSONALIZADA (prioridad ${aff.priority}): "${aff.text}"`);
      return;
    }

    // ═══════════ PRIORIDAD 2: IA GENERADA ═══════════
    const aiIndex = this.aiPool.findIndex(a =>
      a.targetPlayer === currentPlayerName && !this.usedAffirmations.has(a.text)
    );

    if (aiIndex !== -1) {
      const aiAff = this.aiPool.splice(aiIndex, 1)[0];
      this.currentAffirmation = aiAff.text;
      this.currentAffirmationType = aiAff.type;
      this.usedAffirmations.add(aiAff.text);
      console.log(`🧠 Afirmación IA: "${aiAff.text}"`);
      return;
    }

    // ═══════════ PRIORIDAD 3: PERSONALIZADAS DE OTROS (si no hay para este jugador) ═══════════
    const anyPersonalized = this.personalizedPool.findIndex(a =>
      !this.usedAffirmations.has(a.text)
    );

    if (anyPersonalized !== -1) {
      const aff = this.personalizedPool.splice(anyPersonalized, 1)[0];
      this.currentAffirmation = aff.text;
      this.currentAffirmationType = aff.type;
      this.usedAffirmations.add(aff.text);
      console.log(`🎯 Afirmación PERSONALIZADA (otro jugador): "${aff.text}"`);
      return;
    }

    // ═══════════ PRIORIDAD 4: FALLBACK GENÉRICO ═══════════
    const available = this.affirmationPool.filter(a => !this.usedAffirmations.has(a));

    if (available.length === 0) {
      this.usedAffirmations.clear();
      this.shuffleArray(this.affirmationPool);
      this.currentAffirmation = this.affirmationPool[0];
    } else {
      this.currentAffirmation = available[Math.floor(Math.random() * available.length)];
    }
    this.currentAffirmationType = 'general';
    this.usedAffirmations.add(this.currentAffirmation);
    console.log(`📦 Afirmación GENÉRICA: "${this.currentAffirmation}"`);
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
    this.phase = 'confirming'; // Jugador en turno ve la afirmación primero

    // Reset votos de todos
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

  // ═══════════ FASE 2: CONFIRMACIÓN ═══════════

  setTruth(isTrue: boolean) {
    this.currentTruth = isTrue;
    this.touch();
  }

  // ═══════════ FASE 3: ADIVINANZAS ═══════════

  startGuessTimer() {
    this.clearTimers();
    this.guessTimerId = setTimeout(() => {
      // Timer expiró → los que no votaron cuentan como fallo
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

  /** Timer expiró: los que no votaron se marcan como fallo automático */
  private forceGuessTimeout() {
    const truthAnswer = this.currentTruth ? 'verdad' : 'mentira';
    // A los que no votaron les asignamos la respuesta INCORRECTA
    const wrongAnswer = truthAnswer === 'verdad' ? 'mentira' : 'verdad';

    this.players.forEach(p => {
      if (p.socketId !== this.getCurrentPlayerId() && p.currentGuess === null) {
        p.currentGuess = wrongAnswer; // forzar respuesta incorrecta
      }
    });
  }

  // ═══════════ FASE 4: RESULTADOS ═══════════

  calculateResults(): RoundResults {
    const truthAnswer = this.currentTruth ? 'verdad' : 'mentira';
    const voters = this.players.filter(p => p.socketId !== this.getCurrentPlayerId());
    const currentPlayer = this.players[this.currentPlayerIndex];

    const guesses = voters.map(p => ({
      playerName: p.name,
      guess: p.currentGuess || truthAnswer === 'verdad' ? 'mentira' : 'verdad' as 'verdad' | 'mentira',
      correct: p.currentGuess === truthAnswer
    }));

    const allCorrect = guesses.every(g => g.correct);
    const allWrong = guesses.every(g => !g.correct);

    let drinkers: string[] = [];
    let reason: 'all_correct' | 'all_wrong' | 'mixed';

    if (allCorrect) {
      // Todos acertaron → jugador del turno toma
      drinkers = [currentPlayer.name];
      currentPlayer.shotsTaken++;
      reason = 'all_correct';
    } else if (allWrong) {
      // Todos fallaron → jugador del turno toma
      drinkers = [currentPlayer.name];
      currentPlayer.shotsTaken++;
      reason = 'all_wrong';
    } else {
      // Mix → los que fallaron toman
      reason = 'mixed';
      voters.forEach(p => {
        if (p.currentGuess !== truthAnswer) {
          p.shotsTaken++;
          drinkers.push(p.name);
        }
      });
    }

    // Actualizar aciertos
    voters.forEach(p => {
      if (p.currentGuess === truthAnswer) {
        p.correctGuesses++;
      }
    });

    // ═══════════ HISTORIAL PARA IA ADAPTATIVA ═══════════
    const groupAccuracy = guesses.filter(g => g.correct).length / guesses.length;
    this.roundHistory.push({
      round: this.round,
      playerName: currentPlayer.name,
      affirmation: this.currentAffirmation,
      type: this.currentAffirmationType,
      truth: this.currentTruth!,
      guesses,
      groupAccuracy,
      blindSpotDetected: groupAccuracy < 0.4, // menos del 40% acertó = punto ciego
    });

    // Después de cada ronda, pre-generar siguiente lote de IA en background
    if (claude.isAvailable() && this.aiPool.length < 4) {
      this.generateAIBatch().catch(() => {}); // fire and forget
    }

    this.touch();
    return { guesses, drinkers, reason };
  }

  /** Inicia timer de 10s para auto-avanzar después de revelación */
  startRevealTimer() {
    this.clearTimers();
    this.revealTimerId = setTimeout(() => {
      if (this.onAutoAdvance) this.onAutoAdvance();
    }, 10_000);
  }

  // ═══════════ ESTADOS PARA EMITIR ═══════════

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
      aiAvailable: claude.isAvailable(),
    };
  }

  // ═══════════ UTILS ═══════════

  private touch() {
    this.lastActivity = Date.now();
  }

  private clearTimers() {
    if (this.guessTimerId) { clearTimeout(this.guessTimerId); this.guessTimerId = null; }
    if (this.revealTimerId) { clearTimeout(this.revealTimerId); this.revealTimerId = null; }
  }

  destroy() {
    this.clearTimers();
  }

  private shuffleArray(arr: any[]) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
