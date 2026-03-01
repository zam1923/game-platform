import { create } from 'zustand';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export type GameProvider = 'claude' | 'openai' | 'gemini' | 'manual';

export interface DeployedGameMeta {
  id: string;
  name: string;
  deployedBy: string;
  deployedAt: number;
  provider: GameProvider;
}

export interface GeneratingInfo {
  playerName: string;
  description: string;
  provider: GameProvider;
}

export type CreationMode = 'solo' | 'free' | 'challenge';
export type NavPage = 'home' | 'lobby' | 'library';

export interface RoomSnapshot {
  code: string;
  apiKey: string;
  players: Player[];
  phase: 'waiting' | 'playing';
  games: DeployedGameMeta[];
  activeGameId: string | null;
  creationMode: CreationMode;
  challengePrompt: string | null;
}

interface PlatformStore {
  // 自分の情報
  me: Player | null;

  // ルーム
  room: RoomSnapshot | null;

  // ゲームプレイ中の状態
  gameState: unknown;
  lastAction: { action: unknown; playerId: string } | null;
  lastEvent: unknown;

  // Challenge モードのお題（入力フォームに反映するため）
  pendingChallenge: string | null;

  // 生成中のゲーム情報（ルームの全員に表示）
  generatingGames: GeneratingInfo[];

  // ナビゲーション（ルーム未参加時のページ）
  navPage: NavPage;
  setNavPage: (page: NavPage) => void;

  // Actions
  setMe: (player: Player) => void;
  setRoom: (room: RoomSnapshot) => void;
  clearRoom: () => void;
  addDeployedGame: (game: { id: string; name: string; deployedBy: string; provider?: GameProvider }) => void;
  setActiveGame: (gameId: string) => void;
  setGameState: (state: unknown) => void;
  setLastAction: (a: { action: unknown; playerId: string }) => void;
  setLastEvent: (event: unknown) => void;
  addPlayer: (player: Player) => void;
  removePlayer: (playerId: string) => void;
  setChallengePrompt: (prompt: string) => void;
  addGenerating: (info: GeneratingInfo) => void;
  removeGenerating: (playerName: string) => void;
}

export const useStore = create<PlatformStore>((set) => ({
  me: null,
  room: null,
  gameState: null,
  lastAction: null,
  lastEvent: null,
  pendingChallenge: null,
  generatingGames: [],
  navPage: 'home',

  setNavPage: (page) => set({ navPage: page }),

  setMe: (player) => set({ me: player }),

  setRoom: (room) => set((s) => ({
    room,
    // 自分の最新情報を更新
    me: room.players.find(p => p.id === s.me?.id) ?? s.me,
  })),

  clearRoom: () => set({ room: null, me: null, gameState: null, lastAction: null, lastEvent: null, generatingGames: [] }),

  addDeployedGame: (game) => set((s) => {
    if (!s.room) return {};
    const exists = s.room.games.some(g => g.id === game.id);
    if (exists) return {};
    return {
      room: {
        ...s.room,
        games: [...s.room.games, { ...game, deployedAt: Date.now(), provider: game.provider ?? 'manual' }],
      },
      // デプロイ完了したら生成中リストから削除
      generatingGames: s.generatingGames.filter(g => g.playerName !== game.deployedBy),
    };
  }),

  setActiveGame: (gameId) => set((s) => {
    if (!s.room) return {};
    return {
      room: { ...s.room, activeGameId: gameId, phase: 'playing' },
      gameState: null,
      lastAction: null,
      lastEvent: null,
    };
  }),

  setGameState: (state) => set({ gameState: state }),

  setLastAction: (a) => set({ lastAction: a }),

  setLastEvent: (event) => set({ lastEvent: event }),

  addPlayer: (player) => set((s) => {
    if (!s.room) return {};
    const exists = s.room.players.some(p => p.id === player.id);
    if (exists) return {};
    return { room: { ...s.room, players: [...s.room.players, player] } };
  }),

  removePlayer: (playerId) => set((s) => {
    if (!s.room) return {};
    return {
      room: {
        ...s.room,
        players: s.room.players.filter(p => p.id !== playerId),
      },
    };
  }),

  setChallengePrompt: (prompt) => set({ pendingChallenge: prompt }),

  addGenerating: (info) => set((s) => ({
    generatingGames: [
      ...s.generatingGames.filter(g => g.playerName !== info.playerName),
      info,
    ],
  })),

  removeGenerating: (playerName) => set((s) => ({
    generatingGames: s.generatingGames.filter(g => g.playerName !== playerName),
  })),
}));
