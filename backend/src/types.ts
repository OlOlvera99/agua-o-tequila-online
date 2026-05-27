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

// ═══════════ CUESTIONARIO (SIMPLIFICADO) ═══════════

export interface PlayerProfile {
  gender: 'hombre' | 'mujer' | 'otro';
  role?: string;            // rol opcional para relaciones jerárquicas: 'madre', 'jefe', 'suegra', etc.
}

// ═══════════ RELATION TYPES ═══════════
// Una sola decisión del host al crear la sala determina de qué pool sacar afirmaciones.

export type RelationType =
  // Parejas románticas
  | 'novios_hetero'
  | 'novios_gay'
  | 'novias_lesbianas'
  | 'ex_pareja'
  // Amigos
  | 'mejores_amigos_hh'
  | 'mejores_amigas_mm'
  | 'amigos_hm'
  | 'amigos_generico'
  | 'se_gustan'
  | 'rivalidad'
  // Hermanos
  | 'hermanos_hh'
  | 'hermanos_mm'
  | 'hermanos_hm'
  // Padres/hijos
  | 'madre_hija'
  | 'madre_hijo'
  | 'padre_hijo'
  | 'padre_hija'
  // Familia política
  | 'suegra_nuera'
  | 'suegro_yerno'
  // Roomies
  | 'roomies_hh'
  | 'roomies_mm'
  | 'roomies_hm'
  // Laboral / formación
  | 'jefe_empleado'
  | 'profesor_exalumno'
  | 'companeros_trabajo';

// ═══════════ GAME CONFIG ═══════════

export interface GameSettings {
  level: 'suave' | 'picante' | 'extrema';
  relationType: RelationType;
  timerSeconds: number;
}

export type GamePhase = 'lobby' | 'questionnaire' | 'confirming' | 'guessing' | 'reveal';

// Compat: el cliente actual usa este tipo para etiquetar afirmaciones. Conservamos 'general'.
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
  NEW_TURN: (data: { currentPlayer: string; affirmation: string; round: number; currentPlayerId: string; phase: GamePhase; type: AffirmationType }) => void;
  PLAYER_CONFIRMED: () => void;
  GUESS_COUNT: (data: { voted: number; total: number }) => void;
  REVEAL: (data: { affirmation: string; truth: boolean; guesses: GuessResult[]; drinkers: string[]; reason: string; type: AffirmationType }) => void;
  SCOREBOARD: (data: { scores: ScoreEntry[] }) => void;
}
