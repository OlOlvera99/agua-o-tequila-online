'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000';

// ═══════════ TYPES (mirror del backend) ═══════════

export type GamePhase = 'landing' | 'lobby' | 'questionnaire' | 'confirming' | 'guessing' | 'reveal';
export type AffirmationType = 'general' | 'interpersonal';

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
  settings: { level: string; context: string; timerSeconds: number };
  phase: string;
  playerCount: number;
  questionnaireProgress: { ready: number; total: number };
  aiAvailable: boolean;
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
  orientation: 'heterosexual' | 'homosexual' | 'bisexual' | 'prefiero no decir';
  tags: string[];
  bio: string;
  relationships: { targetName: string; type: string; comment: string }[];
}

// ═══════════ HOOK ═══════════

export function useGameSocket() {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [mySocketId, setMySocketId] = useState<string>('');
  const [myName, setMyName] = useState<string>('');
  const [roomId, setRoomId] = useState<string>('');

  // Game state
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

  // Derived
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

    // Lobby
    socket.on('ROOM_UPDATE', (state: RoomState) => {
      setRoomState(state);
      if (state.phase === 'lobby' && phase === 'landing') setPhase('lobby');
      if (state.phase === 'questionnaire') setPhase('questionnaire');
    });

    // Cuestionario
    socket.on('QUESTIONNAIRE_START', () => {
      setPhase('questionnaire');
    });

    socket.on('QUESTIONNAIRE_PROGRESS', (data) => {
      setQuestionnaireProgress(data);
    });

    socket.on('GENERATING_AFFIRMATIONS', () => {
      setIsGenerating(true);
    });

    // Turno
    socket.on('NEW_TURN', (data: TurnData) => {
      setTurnData(data);
      setRevealData(null);
      setGuessCount({ voted: 0, total: 0 });
      setIsGenerating(false);
      setHasSubmittedGuess(false);
      setHasConfirmed(false);

      if (data.phase === 'confirming') {
        setPhase('confirming');
      } else if (data.phase === 'guessing') {
        setPhase('guessing');
      }
    });

    // Jugador confirmó → pasar a votación
    socket.on('PLAYER_CONFIRMED', () => {
      setPhase('guessing');
    });

    // Conteo de votos
    socket.on('GUESS_COUNT', (data) => {
      setGuessCount(data);
    });

    // Revelación
    socket.on('REVEAL', (data: RevealData) => {
      setRevealData(data);
      setPhase('reveal');
    });

    socket.on('SCOREBOARD', (data) => {
      setScoreboard(data.scores);
    });

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
        } else {
          reject(res.error);
        }
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
        } else {
          reject(res.error);
        }
      });
    });
  }, []);

  const updateSettings = useCallback((settings: any) => {
    socketRef.current?.emit('UPDATE_SETTINGS', { roomId, settings });
  }, [roomId]);

  const submitProfile = useCallback((profile: PlayerProfile) => {
    socketRef.current?.emit('SUBMIT_PROFILE', { roomId, profile });
  }, [roomId]);

  const submitHostSecrets = useCallback((secrets: Record<string, string>) => {
    socketRef.current?.emit('SUBMIT_HOST_SECRETS', { roomId, secrets });
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
    // Connection
    connected, mySocketId, myName, roomId,
    // State
    phase, roomState, turnData, guessCount,
    revealData, scoreboard, isGenerating,
    questionnaireProgress,
    hasSubmittedGuess, hasConfirmed,
    // Derived
    isHost, isMyTurn,
    // Actions
    createRoom, joinRoom, updateSettings,
    submitProfile, submitHostSecrets,
    startGame, confirmTruth, submitGuess,
    nextTurn, regenerate,
  };
}
