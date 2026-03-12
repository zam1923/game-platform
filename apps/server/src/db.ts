import { supabase } from './supabase.js';
import type { Room, GameType } from './room-manager.js';

export interface PersistedRoom {
  code: string;
  api_key: string;
  name: string | null;
  type: GameType;
  owner_id: string | null;
}

export async function saveRoomToDb(room: Room): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('persistent_rooms').upsert({
    code: room.code,
    api_key: room.apiKey,
    name: room.name ?? null,
    type: room.gameType,
    owner_id: room.ownerId ?? null,
    last_active_at: new Date().toISOString(),
  }, { onConflict: 'code' });
  if (error) console.error('saveRoomToDb error:', error.message);
}

export async function loadAllRoomsFromDb(): Promise<PersistedRoom[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('persistent_rooms')
    .select('code, api_key, name, type, owner_id');
  if (error) { console.error('loadAllRoomsFromDb error:', error.message); return []; }
  return (data ?? []) as PersistedRoom[];
}

export async function deleteRoomFromDb(code: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('persistent_rooms').delete().eq('code', code);
  if (error) console.error('deleteRoomFromDb error:', error.message);
}

export async function getSoloRoomFromDb(ownerId: string): Promise<PersistedRoom | null> {
  if (!supabase) return null;
  const { data } = await supabase
    .from('persistent_rooms')
    .select('code, api_key, name, type, owner_id')
    .eq('owner_id', ownerId)
    .eq('type', 'solo')
    .maybeSingle();
  return data as PersistedRoom | null;
}

export async function getMultiRoomsFromDb(ownerId: string): Promise<PersistedRoom[]> {
  if (!supabase) return [];
  const { data } = await supabase
    .from('persistent_rooms')
    .select('code, api_key, name, type, owner_id')
    .eq('owner_id', ownerId)
    .eq('type', 'multi')
    .order('last_active_at', { ascending: false });
  return (data ?? []) as PersistedRoom[];
}
