/**
 * Conversation history cache.
 *
 * Capped at the last 5 user/assistant exchanges (10 turns) — anything older is dropped
 * on save. Persisted via the SDK's localStorage bridge so it survives across launches.
 *
 * Total payload is also size-capped to avoid hitting the bridge's storage quota when
 * Hermes returns a long response. If a single turn exceeds the cap we keep only the
 * latest exchange.
 */

import type { ChatTurn, PersistedHistory } from './types';
import { browserStorage, type ConfigStorage } from './config';

const STORAGE_KEY = 'glassai.history.v1';
const MAX_EXCHANGES = 5;
/** ~16KB ceiling. Bridge localStorage isn't documented to a hard limit so this is conservative. */
const MAX_PAYLOAD_BYTES = 16 * 1024;

export async function loadHistory(storage: ConfigStorage = browserStorage): Promise<ChatTurn[]> {
  const raw = await storage.get(STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PersistedHistory;
    if (parsed.version !== 1 || !Array.isArray(parsed.turns)) return [];
    return parsed.turns;
  } catch {
    return [];
  }
}

export async function appendTurn(
  turn: ChatTurn,
  storage: ConfigStorage = browserStorage,
): Promise<ChatTurn[]> {
  const current = await loadHistory(storage);
  const next = trim([...current, turn]);
  await saveHistory(next, storage);
  return next;
}

export async function clearHistory(storage: ConfigStorage = browserStorage): Promise<void> {
  await storage.set(STORAGE_KEY, JSON.stringify({ version: 1, turns: [] }));
}

async function saveHistory(turns: ChatTurn[], storage: ConfigStorage): Promise<void> {
  let payload: PersistedHistory = { version: 1, turns };
  let serialized = JSON.stringify(payload);
  while (serialized.length > MAX_PAYLOAD_BYTES && payload.turns.length > 2) {
    // Drop the oldest exchange (one user + one assistant) and re-encode.
    payload = { version: 1, turns: payload.turns.slice(2) };
    serialized = JSON.stringify(payload);
  }
  await storage.set(STORAGE_KEY, serialized);
}

function trim(turns: ChatTurn[]): ChatTurn[] {
  // An "exchange" is a (user, assistant) pair. We allow a trailing user turn while waiting
  // for the assistant to respond, but cap historical exchanges at MAX_EXCHANGES.
  const exchanges: ChatTurn[][] = [];
  let current: ChatTurn[] = [];
  for (const turn of turns) {
    current.push(turn);
    if (turn.role === 'assistant') {
      exchanges.push(current);
      current = [];
    }
  }
  const kept = exchanges.slice(-MAX_EXCHANGES).flat();
  return [...kept, ...current];
}
