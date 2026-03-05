export const STORAGE_KEY = 'game_platform_session';

export type GameType = 'solo' | 'multi';

export function saveSession(name: string, code: string, gameType?: GameType): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, code, gameType: gameType ?? 'multi' }));
}

export function loadSession(): { name: string; code: string; gameType: GameType } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { name: string; code: string; gameType?: GameType };
    return { ...parsed, gameType: parsed.gameType ?? 'multi' };
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
