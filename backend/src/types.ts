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

export interface PlayerProfile {
  gender: 'hombre' | 'mujer' | 'otro';
  orientation: 'heterosexual' | 'homosexual' | 'bisexual' | 'prefiero no decir';
  tags: string[];           // fiestero, tímido, coqueto, intenso, etc.
  bio: string;              // texto libre sobre sí mismo
  relationships: PairRelationship[];
}

export interface PairRelationship {
  targetName: string;
  type: RelationType;
  comment: string;          // opcional: "terminó mal", "hay tensión"
}

export type RelationType =
  | 'amigos'
  | 'mejores_amigos'
  | 'novios'
  | 'ex_pareja'
  | 'hermanos'
  | 'familia'
  | 'se_gustan'
  | 'rivalidad'
  | 'compañeros_trabajo';

export interface HostSecrets {
  [playerName: string]: string;  // chisme privado por jugador
}

export const PLAYER_TAGS = [
  'fiestero', 'tímido', 'coqueto', 'intenso', 'bromista',
  'serio', 'dramático', 'competitivo', 'relajado', 'misterioso',
  'romántico', 'sarcástico', 'aventurero', 'reservado', 'payaso',
] as const;

// ═══════════ IA ADAPTATIVA ═══════════

export type AffirmationType = 'general' | 'interpersonal';

export interface GeneratedAffirmation {
  text: string;
  type: AffirmationType;
  targetPlayer: string;         // sobre quién es la afirmación
  involvedPlayer?: string;      // otro jugador involucrado (si es interpersonal)
  priority?: number;            // mayor = usar primero (personalizadas > genéricas)
}

export interface RoundHistory {
  round: number;
  playerName: string;
  affirmation: string;
  type: AffirmationType;
  truth: boolean;               // qué respondió el jugador
  guesses: { playerName: string; guess: string; correct: boolean }[];
  groupAccuracy: number;        // % del grupo que acertó
  blindSpotDetected: boolean;   // si el grupo falló mayoritariamente
}

// ═══════════ GAME CONFIG ═══════════

export interface GameSettings {
  level: 'suave' | 'picante' | 'extrema';
  context: string;
  timerSeconds: number;
}

export type GamePhase = 'lobby' | 'questionnaire' | 'confirming' | 'guessing' | 'reveal';

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
  SUBMIT_HOST_SECRETS: (data: { roomId: string; secrets: HostSecrets }) => void;
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
  GENERATING_AFFIRMATIONS: () => void;
  NEW_TURN: (data: { currentPlayer: string; affirmation: string; round: number; currentPlayerId: string; phase: GamePhase; type: AffirmationType }) => void;
  PLAYER_CONFIRMED: () => void;
  GUESS_COUNT: (data: { voted: number; total: number }) => void;
  REVEAL: (data: { affirmation: string; truth: boolean; guesses: GuessResult[]; drinkers: string[]; reason: string; type: AffirmationType }) => void;
  SCOREBOARD: (data: { scores: ScoreEntry[] }) => void;
}
