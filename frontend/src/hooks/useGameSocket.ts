'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

// ═══════════ TYPES (mirror del backend) ═══════════

export type GamePhase = 'landing' | 'lobby' | 'questionnaire' | 'confirming' | 'guessing' | 'reveal';
export type AffirmationType = 'general' | 'interpersonal';

export type RelationType =
  | 'novios_hetero' | 'novios_gay' | 'novias_lesbianas' | 'ex_pareja' | 'se_gustan'
  | 'mejores_amigos_hh' | 'mejores_amigas_mm' | 'amigos_hm' | 'amigos_generico' | 'rivalidad'
  | 'hermanos_hh' | 'hermanos_mm' | 'hermanos_hm'
  | 'madre_hija' | 'madre_hijo' | 'padre_hijo' | 'padre_hija'
  | 'suegra_nuera' | 'suegro_yerno'
  | 'roomies_hh' | 'roomies_mm' | 'roomies_hm'
  | 'jefe_empleado' | 'profesor_exalumno' | 'companeros_trabajo';

export interface RelationOption {
  key: RelationType;
  label: string;
  group: string;
  roles?: [string, string];
  ready: boolean;
}

// Mirror del RELATION_CONFIG del backend (mantener sincronizado)
export const RELATION_OPTIONS: RelationOption[] = [
  { key: 'novios_hetero',      label: 'Pareja (hombre y mujer)', group: 'Parejas',      ready: true },
  { key: 'novios_gay',         label: 'Pareja (dos hombres)',    group: 'Parejas',      ready: true },
  { key: 'novias_lesbianas',   label: 'Pareja (dos mujeres)',    group: 'Parejas',      ready: true },
  { key: 'ex_pareja',          label: 'Ex-pareja',               group: 'Parejas',      ready: true },
  { key: 'se_gustan',          label: 'Se gustan / hay tensión', group: 'Parejas',      ready: true },
  { key: 'mejores_amigos_hh',  label: 'Mejores amigos (H-H)',    group: 'Amistad',      ready: true },
  { key: 'mejores_amigas_mm',  label: 'Mejores amigas (M-M)',    group: 'Amistad',      ready: true },
  { key: 'amigos_hm',          label: 'Amigo y amiga (H-M)',     group: 'Amistad',      ready: true },
  { key: 'amigos_generico',    label: 'Amigos (grupo)',          group: 'Amistad',      ready: true },
  { key: 'rivalidad',          label: 'Rivalidad',               group: 'Amistad',      ready: true },
  { key: 'hermanos_hh',        label: 'Hermanos (H-H)',          group: 'Familia',      ready: false },
  { key: 'hermanos_mm',        label: 'Hermanas (M-M)',          group: 'Familia',      ready: false },
  { key: 'hermanos_hm',        label: 'Hermano y hermana',       group: 'Familia',      ready: false },
  { key: 'madre_hija',         label: 'Madre e hija',            group: 'Familia',      roles: ['madre','hija'],   ready: false },
  { key: 'madre_hijo',         label: 'Madre e hijo',            group: 'Familia',      roles: ['madre','hijo'],   ready: false },
  { key: 'padre_hijo',         label: 'Padre e hijo',            group: 'Familia',      roles: ['padre','hijo'],   ready: false },
  { key: 'padre_hija',         label: 'Padre e hija',            group: 'Familia',      roles: ['padre','hija'],   ready: false },
  { key: 'suegra_nuera',       label: 'Suegra y nuera',          group: 'Familia',      roles: ['suegra','nuera'], ready: false },
  { key: 'suegro_yerno',       label: 'Suegro y yerno',          group: 'Familia',      roles: ['suegro','yerno'], ready: false },
  { key: 'roomies_hh',         label: 'Roomies (H-H)',           group: 'Convivencia',  ready: false },
  { key: 'roomies_mm',         label: 'Roomies (M-M)',           group: 'Convivencia',  ready: false },
  { key: 'roomies_hm',         label: 'Roomies (H-M)',           group: 'Convivencia',  ready: false },
  { key: 'jefe_empleado',      label: 'Jefe y empleado',         group: 'Trabajo',      roles: ['jefe','empleado'],     ready: false },
  { key: 'profesor_exalumno',  label: 'Profesor y ex-alumno',    group: 'Trabajo',      roles: ['profesor','ex-alumno'], ready: false },
  { key: 'companeros_trabajo', label: 'Compañeros de trabajo',   group: 'Trabajo',      ready: true },
];

export const RELATION_BY_KEY: Record<RelationType, RelationOption> = Object.fromEntries(
  RELATION_OPTIONS.map(o => [o.key, o])
) as Record<RelationType, RelationOption>;

export interface PlayerInfo {
  name: string;
  socketId: string;
  isHost: boolean;
  questionnaireReady?: boolean;
}

export interface RoomState {
  id: string;
  hostId: string;
  players: PlayerInfo[];
  settings: { level: 'suave'|'picante'|'extrema'; relationType: RelationType; timerSeconds: number };
  phase: string;
  playerCount: number;
  questionnaireProgress: { ready: number; total: number };
}

export interface TurnData {
  currentPlayer: string;
  currentPlayerId: string;
  affirmation: string;
  round: number;
  phase: string;
  type: AffirmationType;
}

export interface GuessResult {
  playerName: string;
  guess: 'verdad' | 'mentira';
  correct: boolean;
}

export interface RevealData {
  affirmation: string;
  truth: boolean;
  guesses: GuessResult[];
  drinkers: string[];
  reason: 'all_correct' | 'all_wrong' | 'mixed';
  type: AffirmationType;
}

export interface ScoreEntry {
  playerName: string;
  shotsTaken: number;
  correctGuesses: number;
}

export interface PlayerProfile {
  gender: 'hombre' | 'mujer' | 'otro';
  role?: string;
}

// ═══════════ HOOK ═══════════

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState<string>('');
  const [myName, setMyName] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');

  const [phase, setPhase] = useState<GamePhase>('landing');
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [turnData, setTurnData] = useState<TurnData | null>(null);
  const [guessCount, setGuessCount] = useState({ voted: 0, total: 0 });
  const [revealData, setRevealData] = useState<RevealData | null>(null);
  const [scoreboard, setScoreboard] = useState<ScoreEntry[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [questionnaireProgress, setQuestionnaireProgress] = useState({ ready: 0, total: 0 });
  const [hasSubmittedGuess, setHasSubmittedGuess] = useState(false);
  const [hasConfirmed, setHasConfirmed] = useState(false);

  const isHost = roomState?.hostId === mySocketId;
  const isMyTurn = turnData?.currentPlayerId === mySocketId;

  useEffect(() => {
    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => {
      setConnected(true);
      setMySocketId(socket.id || '');
    });
    socket.on('disconnect', () => setConnected(false));

    socket.on('ROOM_UPDATE', (state: RoomState) => {
      setRoomState(state);
      if (state.phase === 'lobby' && phase === 'landing') setPhase('lobby');
      if (state.phase === 'questionnaire') setPhase('questionnaire');
    });

    socket.on('QUESTIONNAIRE_START', () => setPhase('questionnaire'));
    socket.on('QUESTIONNAIRE_PROGRESS', (data) => setQuestionnaireProgress(data));

    socket.on('NEW_TURN', (data: TurnData) => {
      setTurnData(data);
      setRevealData(null);
      setGuessCount({ voted: 0, total: 0 });
      setIsGenerating(false);
      setHasSubmittedGuess(false);
      setHasConfirmed(false);
      if (data.phase === 'confirming') setPhase('confirming');
      else if (data.phase === 'guessing') setPhase('guessing');
    });

    socket.on('PLAYER_CONFIRMED', () => setPhase('guessing'));
    socket.on('GUESS_COUNT', (data) => setGuessCount(data));

    socket.on('REVEAL', (data: RevealData) => {
      setRevealData(data);
      setPhase('reveal');
    });

    socket.on('SCOREBOARD', (data) => setScoreboard(data.scores));

    socketRef.current = socket;
    return () => { socket.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ═══════════ ACTIONS ═══════════

  const createRoom = useCallback(async (playerName: string, settings: any) => {
    return new Promise<string>((resolve, reject) => {
      socketRef.current?.emit('CREATE_ROOM', { playerName, settings }, (res: any) => {
        if (res.roomId) {
          setMyName(playerName);
          setRoomId(res.roomId);
          setPhase('lobby');
          resolve(res.roomId);
        } else reject(res.error);
      });
    });
  }, []);

  const joinRoom = useCallback(async (targetRoomId: string, playerName: string) => {
    return new Promise<void>((resolve, reject) => {
      socketRef.current?.emit('JOIN_ROOM', { roomId: targetRoomId, playerName }, (res: any) => {
        if (res.success) {
          setMyName(playerName);
          setRoomId(targetRoomId.toUpperCase());
          setPhase('lobby');
          resolve();
        } else reject(res.error);
      });
    });
  }, []);

  const updateSettings = useCallback((settings: any) => {
    socketRef.current?.emit('UPDATE_SETTINGS', { roomId, settings });
  }, [roomId]);

  const submitProfile = useCallback((profile: PlayerProfile) => {
    socketRef.current?.emit('SUBMIT_PROFILE', { roomId, profile });
  }, [roomId]);

  const startGame = useCallback(() => {
    socketRef.current?.emit('START_GAME', { roomId });
  }, [roomId]);

  const confirmTruth = useCallback((isTrue: boolean) => {
    socketRef.current?.emit('CONFIRM_TRUTH', { roomId, isTrue });
    setHasConfirmed(true);
  }, [roomId]);

  const submitGuess = useCallback((guess: 'verdad' | 'mentira') => {
    socketRef.current?.emit('SUBMIT_GUESS', { roomId, guess });
    setHasSubmittedGuess(true);
  }, [roomId]);

  const nextTurn = useCallback(() => {
    socketRef.current?.emit('NEXT_TURN', { roomId });
  }, [roomId]);

  const regenerate = useCallback(() => {
    socketRef.current?.emit('REGENERATE_AFFIRMATION', { roomId });
  }, [roomId]);

  return {
    connected, mySocketId, myName, roomId,
    phase, roomState, turnData, guessCount,
    revealData, scoreboard, isGenerating,
    questionnaireProgress, hasSubmittedGuess, hasConfirmed,
    isHost, isMyTurn,
    createRoom, joinRoom, updateSettings,
    submitProfile, startGame, confirmTruth, submitGuess,
    nextTurn, regenerate,
  };
}
