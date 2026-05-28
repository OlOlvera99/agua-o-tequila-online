'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

// ═══════════ TYPES (mirror del backend) ═══════════

export type GamePhase = 'landing' | 'lobby' | 'questionnaire' | 'starting' | 'confirming' | 'guessing' | 'reveal';
export type AffirmationType = 'general' | 'interpersonal';

export type RelationKind =
  | 'pareja' | 'ex_pareja' | 'mejor_amigo' | 'amigo' | 'hermano'
  | 'mama' | 'papa' | 'hijo'
  | 'suegra' | 'suegro' | 'nuera' | 'yerno'
  | 'roomie' | 'jefe' | 'empleado' | 'profesor' | 'exalumno'
  | 'companero_trabajo' | 'crush' | 'rival' | 'conocido' | 'otro';

export const RELATION_KIND_OPTIONS: { key: RelationKind; label: string; group: string }[] = [
  { key: 'pareja',             label: 'Mi pareja',                   group: 'Romántico' },
  { key: 'ex_pareja',          label: 'Mi ex pareja',                group: 'Romántico' },
  { key: 'crush',              label: 'Nos gustamos (crush)',        group: 'Romántico' },
  { key: 'mejor_amigo',        label: 'Mi mejor amig@',              group: 'Amistad' },
  { key: 'amigo',              label: 'Amig@',                       group: 'Amistad' },
  { key: 'rival',              label: 'Rival',                       group: 'Amistad' },
  { key: 'hermano',            label: 'Herman@',                     group: 'Familia' },
  { key: 'mama',               label: 'Mi mamá',                     group: 'Familia' },
  { key: 'papa',               label: 'Mi papá',                     group: 'Familia' },
  { key: 'hijo',               label: 'Mi hij@',                     group: 'Familia' },
  { key: 'suegra',             label: 'Mi suegra',                   group: 'Familia política' },
  { key: 'suegro',             label: 'Mi suegro',                   group: 'Familia política' },
  { key: 'nuera',              label: 'Mi nuera',                    group: 'Familia política' },
  { key: 'yerno',              label: 'Mi yerno',                    group: 'Familia política' },
  { key: 'roomie',             label: 'Mi roomie',                   group: 'Convivencia' },
  { key: 'jefe',               label: 'Mi jefe/jefa',                group: 'Trabajo' },
  { key: 'empleado',           label: 'Mi emplead@',                 group: 'Trabajo' },
  { key: 'profesor',           label: 'Mi maestr@',                  group: 'Trabajo' },
  { key: 'exalumno',           label: 'Mi ex-alumn@',                group: 'Trabajo' },
  { key: 'companero_trabajo',  label: 'Compañer@ de trabajo',        group: 'Trabajo' },
  { key: 'conocido',           label: 'Conocid@',                    group: 'Otros' },
  { key: 'otro',               label: 'Otro',                        group: 'Otros' },
];

export type GroupVibe =
  | 'amigos_h' | 'amigos_m' | 'amigos_mixto' | 'parejas_amigas'
  | 'oficina' | 'familia' | 'evento_social';

export const GROUP_VIBE_OPTIONS: { key: GroupVibe; label: string }[] = [
  { key: 'amigos_mixto',   label: 'Grupo mixto de amigos' },
  { key: 'amigos_h',       label: 'Grupo de amigos (hombres)' },
  { key: 'amigos_m',       label: 'Grupo de amigas (mujeres)' },
  { key: 'parejas_amigas', label: 'Parejas que son amigas entre sí' },
  { key: 'oficina',        label: 'Colegas de trabajo / oficina' },
  { key: 'familia',        label: 'Reunión familiar' },
  { key: 'evento_social',  label: 'Evento social (fiesta, cumple…)' },
];

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
  settings: { level: 'suave' | 'picante' | 'extrema'; groupVibe: GroupVibe; timerSeconds: number };
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
  imageBase64?: string;
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
  imageBase64?: string;
}

export interface ScoreEntry {
  playerName: string;
  shotsTaken: number;
  correctGuesses: number;
}

export interface PlayerProfile {
  gender: 'hombre' | 'mujer' | 'otro';
  role?: string;
  relationships: Record<string, RelationKind>;
  selfieBase64?: string;
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
    socket.on('STARTING_GAME', () => setPhase('starting'));

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

    socket.on('IMAGE_READY', (data: { round: number; imageBase64: string }) => {
      // Late-arriving image for current turn — patch into turnData
      setTurnData(prev => prev && prev.round === data.round ? { ...prev, imageBase64: data.imageBase64 } : prev);
      setRevealData(prev => prev ? { ...prev, imageBase64: data.imageBase64 } : prev);
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
