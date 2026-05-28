// ═══════════ TIPOS COMPARTIDOS ═══════════

export interface Player {
  socketId: string;
  name: string;
  isHost: boolean;
  shotsTaken: number;
  correctGuesses: number;
  currentGuess: 'verdad' | 'mentira' | null;
  profile: PlayerProfile | null;
  questionnaireReady: boolean;
}

// ═══════════ CUESTIONARIO ═══════════
//
// Cada jugador responde:
//   - su género
//   - opcionalmente un rol (solo para relaciones jerárquicas como suegra/nuera, jefe/empleado)
//   - una matriz: "qué eres de X?" para cada otro jugador en la sala
//   - opcionalmente una selfie en base64 (para image-gen con Gemini)

export interface PlayerProfile {
  gender: 'hombre' | 'mujer' | 'otro';
  role?: string;            // rol opcional para hierárquicas
  relationships: Record<string, RelationKind>;  // key = otro player name; value = RelationKind
  selfieBase64?: string;    // opcional — JPEG/PNG en base64 sin data URL prefix
}

// User-facing relation choices que cada jugador elige por par
// (más simples que los RelationType internos del motor, que dependen de género).
export type RelationKind =
  | 'pareja'
  | 'ex_pareja'
  | 'mejor_amigo'         // mejor amig@ (cualquier género)
  | 'amigo'               // amig@ casual
  | 'hermano'             // herman@
  | 'mama'
  | 'papa'
  | 'hijo'                // hij@
  | 'suegra'
  | 'suegro'
  | 'nuera'
  | 'yerno'
  | 'roomie'
  | 'jefe'
  | 'empleado'
  | 'profesor'
  | 'exalumno'
  | 'companero_trabajo'
  | 'crush'               // nos gustamos / hay tensión
  | 'rival'
  | 'conocido'
  | 'otro';

// ═══════════ RELATION TYPES (claves de pools del motor) ═══════════

export type RelationType =
  // Parejas
  | 'novios_hetero' | 'novios_gay' | 'novias_lesbianas' | 'ex_pareja' | 'se_gustan'
  // Amigos
  | 'mejores_amigos_hh' | 'mejores_amigas_mm' | 'amigos_hm' | 'amigos_generico' | 'rivalidad'
  // Hermanos
  | 'hermanos_hh' | 'hermanos_mm' | 'hermanos_hm'
  // Padres/hijos
  | 'madre_hija' | 'madre_hijo' | 'padre_hijo' | 'padre_hija'
  // Familia política
  | 'suegra_nuera' | 'suegro_yerno'
  // Roomies
  | 'roomies_hh' | 'roomies_mm' | 'roomies_hm'
  // Laboral
  | 'jefe_empleado' | 'profesor_exalumno' | 'companeros_trabajo';

// ═══════════ GROUP VIBES (host classification) ═══════════
//
// El host elige UNA al crear sala. Se usa como:
//   - fallback cuando un par de jugadores no tiene matriz definida
//   - context para afirmaciones de "todos vs uno" / whole-group
//   - flavor para el image-gen (e.g. office party vs casa familiar vs cantina)

export type GroupVibe =
  | 'amigos_h'         // grupo de amigos hombres
  | 'amigos_m'         // grupo de amigas mujeres
  | 'amigos_mixto'     // grupo mixto de amigos
  | 'parejas_amigas'   // grupo de parejas que son amigos entre sí
  | 'oficina'          // colegas de trabajo
  | 'familia'          // reunión familiar
  | 'evento_social';   // genérico (fiesta de casa, cumple, etc)

// ═══════════ GAME CONFIG ═══════════

export interface GameSettings {
  level: 'suave' | 'picante' | 'extrema';
  groupVibe: GroupVibe;
  timerSeconds: number;
}

export type GamePhase = 'lobby' | 'questionnaire' | 'confirming' | 'guessing' | 'reveal';

export type AffirmationType = 'general' | 'interpersonal';

export interface GuessResult {
  playerName: string;
  guess: 'verdad' | 'mentira';
  correct: boolean;
}

export interface RoundResults {
  guesses: GuessResult[];
  drinkers: string[];
  reason: 'all_correct' | 'all_wrong' | 'mixed';
}

export interface ScoreEntry {
  playerName: string;
  shotsTaken: number;
  correctGuesses: number;
}

// ═══════════ EVENTOS CLIENTE → SERVIDOR ═══════════

export interface ClientEvents {
  CREATE_ROOM: (data: { playerName: string; settings: Partial<GameSettings> }, cb: (res: { roomId: string }) => void) => void;
  JOIN_ROOM: (data: { roomId: string; playerName: string }, cb: (res: { success?: boolean; error?: string }) => void) => void;
  UPDATE_SETTINGS: (data: { roomId: string; settings: Partial<GameSettings> }) => void;
  SUBMIT_PROFILE: (data: { roomId: string; profile: PlayerProfile }) => void;
  START_GAME: (data: { roomId: string }) => void;
  CONFIRM_TRUTH: (data: { roomId: string; isTrue: boolean }) => void;
  SUBMIT_GUESS: (data: { roomId: string; guess: 'verdad' | 'mentira' }) => void;
  NEXT_TURN: (data: { roomId: string }) => void;
  REGENERATE_AFFIRMATION: (data: { roomId: string }) => void;
}

// ═══════════ EVENTOS SERVIDOR → CLIENTE ═══════════

export interface ServerEvents {
  ROOM_UPDATE: (state: any) => void;
  QUESTIONNAIRE_START: (data: { players: string[] }) => void;
  QUESTIONNAIRE_PROGRESS: (data: { ready: number; total: number }) => void;
  STARTING_GAME: () => void;  // host clickeó Empezar, server pre-genera primeros turnos
  NEW_TURN: (data: {
    currentPlayer: string;
    affirmation: string;
    round: number;
    currentPlayerId: string;
    phase: GamePhase;
    type: AffirmationType;
    imageBase64?: string;  // opcional — preview AI image cuando esté lista (Fase 2)
  }) => void;
  IMAGE_READY: (data: { round: number; imageBase64: string }) => void;  // Fase 2: emite cuando termina la generación tardía
  PLAYER_CONFIRMED: () => void;
  GUESS_COUNT: (data: { voted: number; total: number }) => void;
  REVEAL: (data: {
    affirmation: string;
    truth: boolean;
    guesses: GuessResult[];
    drinkers: string[];
    reason: string;
    type: AffirmationType;
    imageBase64?: string;
  }) => void;
  SCOREBOARD: (data: { scores: ScoreEntry[] }) => void;
}
