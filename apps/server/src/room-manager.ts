import { nanoid } from 'nanoid';
import { customAlphabet } from 'nanoid';

const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6);

export type CreationMode = 'solo' | 'free' | 'challenge';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

export type GameProvider = 'claude' | 'openai' | 'gemini' | 'manual';

export interface DeployedGame {
  id: string;
  name: string;
  html: string;
  deployedBy: string;  // player name
  deployedAt: number;
  provider: GameProvider;
}

export interface Room {
  code: string;
  apiKey: string;
  players: Map<string, Player>;
  phase: 'waiting' | 'playing';
  games: DeployedGame[];
  activeGameId: string | null;
  creationMode: CreationMode;
  challengePrompt: string | null;
  createdAt: number;
}

export interface RoomSnapshot {
  code: string;
  apiKey: string;
  players: Player[];
  phase: Room['phase'];
  games: Omit<DeployedGame, 'html'>[];  // HTMLは送らない（重いので）
  activeGameId: string | null;
  creationMode: CreationMode;
  challengePrompt: string | null;
}

// ゲーム生成中の通知用
export interface GeneratingInfo {
  playerName: string;
  description: string;
  provider: GameProvider;
}

export function toSnapshot(room: Room): RoomSnapshot {
  return {
    code: room.code,
    apiKey: room.apiKey,
    players: [...room.players.values()],
    phase: room.phase,
    games: room.games.map(({ id, name, deployedBy, deployedAt, provider }) => ({
      id, name, deployedBy, deployedAt, provider,
    })),
    activeGameId: room.activeGameId,
    creationMode: room.creationMode,
    challengePrompt: room.challengePrompt,
  };
}

export class RoomManager {
  private rooms = new Map<string, Room>();
  private playerToRoom = new Map<string, string>();
  private emptyRoomTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly GRACE_MS = 60 * 60 * 1000; // 60分（ゲーム作成中の切断でも復帰できる）

  createRoom(host: Player): Room {
    const code = this.uniqueCode();
    const apiKey = nanoid(24);
    const room: Room = {
      code,
      apiKey,
      players: new Map([[host.id, host]]),
      phase: 'waiting',
      games: [],
      activeGameId: null,
      creationMode: 'free',
      challengePrompt: null,
      createdAt: Date.now(),
    };
    this.rooms.set(code, room);
    this.playerToRoom.set(host.id, code);
    return room;
  }

  joinRoom(code: string, player: Player): Room | { error: string } {
    const room = this.rooms.get(code.toUpperCase());
    if (!room) return { error: 'ルームが見つかりません' };
    if (room.players.size >= 12) return { error: '満員です' };

    // 空ルームへの再参加 → 削除タイマーをキャンセル
    const timer = this.emptyRoomTimers.get(code.toUpperCase());
    if (timer) {
      clearTimeout(timer);
      this.emptyRoomTimers.delete(code.toUpperCase());
    }

    // 空ルームに最初に入ったプレイヤーは自動でホストに昇格
    const willBeHost = room.players.size === 0;
    room.players.set(player.id, { ...player, isHost: willBeHost });
    this.playerToRoom.set(player.id, code.toUpperCase());
    return room;
  }

  removePlayer(playerId: string): { room: Room } | null {
    const code = this.playerToRoom.get(playerId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;

    room.players.delete(playerId);
    this.playerToRoom.delete(playerId);

    if (room.players.size === 0) {
      // 即削除ではなく60分後に削除（ゲーム作成中の切断でも復帰できる）
      const timer = setTimeout(() => {
        if ((this.rooms.get(code)?.players.size ?? 1) === 0) {
          this.rooms.delete(code);
        }
        this.emptyRoomTimers.delete(code);
      }, this.GRACE_MS);
      this.emptyRoomTimers.set(code, timer);
      return null;
    }

    // ホストが抜けたら次のプレイヤーをホストに昇格
    const wasHost = !([...room.players.values()].some(p => p.isHost));
    if (wasHost) {
      const next = room.players.values().next().value;
      if (next) next.isHost = true;
    }

    return { room };
  }

  getRoomByPlayer(playerId: string): Room | null {
    const code = this.playerToRoom.get(playerId);
    return code ? this.rooms.get(code) ?? null : null;
  }

  getRoom(code: string): Room | null {
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  getRoomByApiKey(apiKey: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.apiKey === apiKey) return room;
    }
    return null;
  }

  deployGame(room: Room, game: Omit<DeployedGame, 'id' | 'deployedAt'> & { provider?: GameProvider }): DeployedGame {
    const deployed: DeployedGame = {
      ...game,
      provider: game.provider ?? 'manual',
      id: nanoid(12),
      deployedAt: Date.now(),
    };
    room.games.push(deployed);
    return deployed;
  }

  selectGame(room: Room, gameId: string): boolean {
    const game = room.games.find(g => g.id === gameId);
    if (!game) return false;
    room.activeGameId = gameId;
    room.phase = 'playing';
    return true;
  }

  getGame(room: Room, gameId: string): DeployedGame | null {
    return room.games.find(g => g.id === gameId) ?? null;
  }

  setMode(room: Room, mode: CreationMode): void {
    room.creationMode = mode;
  }

  setChallenge(room: Room, prompt: string): void {
    room.challengePrompt = prompt;
  }

  // 4時間以上経過した空のルームをGC
  cleanup(): void {
    const cutoff = Date.now() - 4 * 60 * 60 * 1000;
    for (const [code, room] of this.rooms) {
      if (room.createdAt < cutoff) {
        for (const id of room.players.keys()) {
          this.playerToRoom.delete(id);
        }
        this.rooms.delete(code);
      }
    }
  }

  private uniqueCode(): string {
    let code: string;
    do { code = generateCode(); } while (this.rooms.has(code));
    return code;
  }
}
