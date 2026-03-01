export const STORAGE_KEY = 'game_platform_session';

export function saveSession(name: string, code: string): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ name, code }));
}

export function loadSession(): { name: string; code: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { name: string; code: string }) : null;
  } catch {
    return null;
  }
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEY);
}
