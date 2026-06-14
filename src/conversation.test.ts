import { describe, expect, it } from 'vitest';
import type { ChatTurn } from './types';
import type { ConfigStorage } from './config';
import { appendTurn, clearHistory, loadHistory } from './conversation';

// ---------------------------------------------------------------------------
// Test double
// ---------------------------------------------------------------------------

function makeStorage(initial: Record<string, string> = {}): ConfigStorage {
  const store: Record<string, string> = { ...initial };
  return {
    get: async (key) => store[key] ?? null,
    set: async (key, value) => {
      store[key] = value;
    },
  };
}

function turn(role: 'user' | 'assistant', content: string, ts = 0): ChatTurn {
  return { role, content, ts };
}

/** Build N complete exchanges (user + assistant) in the given storage. */
async function buildExchanges(n: number, storage: ConfigStorage): Promise<void> {
  for (let i = 0; i < n; i++) {
    await appendTurn(turn('user', `q${i}`), storage);
    await appendTurn(turn('assistant', `a${i}`), storage);
  }
}

// ---------------------------------------------------------------------------
// loadHistory
// ---------------------------------------------------------------------------

describe('loadHistory', () => {
  it('returns an empty array when storage is empty', async () => {
    expect(await loadHistory(makeStorage())).toEqual([]);
  });

  it('returns parsed turns from valid stored JSON', async () => {
    const data = JSON.stringify({ version: 1, turns: [turn('user', 'hello')] });
    const turns = await loadHistory(makeStorage({ 'glassai.history.v1': data }));
    expect(turns).toHaveLength(1);
    expect(turns[0]).toMatchObject({ role: 'user', content: 'hello' });
  });

  it('returns empty array for corrupt JSON', async () => {
    expect(
      await loadHistory(makeStorage({ 'glassai.history.v1': 'not-json' })),
    ).toEqual([]);
  });

  it('returns empty array when version field does not match', async () => {
    const data = JSON.stringify({ version: 2, turns: [turn('user', 'hi')] });
    expect(
      await loadHistory(makeStorage({ 'glassai.history.v1': data })),
    ).toEqual([]);
  });

  it('returns empty array when turns field is not an array', async () => {
    const data = JSON.stringify({ version: 1, turns: 'oops' });
    expect(
      await loadHistory(makeStorage({ 'glassai.history.v1': data })),
    ).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// appendTurn
// ---------------------------------------------------------------------------

describe('appendTurn', () => {
  it('appends the first turn to empty history', async () => {
    const storage = makeStorage();
    const turns = await appendTurn(turn('user', 'hello'), storage);
    expect(turns).toHaveLength(1);
    expect(turns[0].content).toBe('hello');
  });

  it('appends to existing turns', async () => {
    const storage = makeStorage();
    await appendTurn(turn('user', 'q'), storage);
    const turns = await appendTurn(turn('assistant', 'a'), storage);
    expect(turns).toHaveLength(2);
    expect(turns[1].role).toBe('assistant');
  });

  it('persists across separate calls so loadHistory reflects all turns', async () => {
    const storage = makeStorage();
    await appendTurn(turn('user', 'q'), storage);
    await appendTurn(turn('assistant', 'a'), storage);
    expect(await loadHistory(storage)).toHaveLength(2);
  });

  it('caps history at 5 complete exchanges (10 turns)', async () => {
    const storage = makeStorage();
    await buildExchanges(6, storage);
    const turns = await loadHistory(storage);
    // Oldest exchange (q0/a0) should have been dropped
    expect(turns.length).toBe(10);
    expect(turns[0].content).toBe('q1');
    expect(turns[1].content).toBe('a1');
  });

  it('drops oldest exchange first when overflow occurs', async () => {
    const storage = makeStorage();
    await buildExchanges(5, storage);
    // Add a 6th exchange, forcing q0/a0 to be evicted
    await appendTurn(turn('user', 'q5'), storage);
    const turns = await appendTurn(turn('assistant', 'a5'), storage);
    expect(turns.find((t) => t.content === 'q0')).toBeUndefined();
    expect(turns.find((t) => t.content === 'a0')).toBeUndefined();
    expect(turns[turns.length - 1].content).toBe('a5');
  });

  it('preserves a trailing user turn that has no matching assistant reply yet', async () => {
    const storage = makeStorage();
    await buildExchanges(5, storage);
    // Add a 6th user turn without a reply — should survive the cap
    const turns = await appendTurn(turn('user', 'pending'), storage);
    expect(turns[turns.length - 1]).toMatchObject({ role: 'user', content: 'pending' });
  });

  it('preserves turn timestamps', async () => {
    const storage = makeStorage();
    const ts = 1_700_000_000_000;
    const turns = await appendTurn(turn('user', 'hi', ts), storage);
    expect(turns[0].ts).toBe(ts);
  });
});

// ---------------------------------------------------------------------------
// clearHistory
// ---------------------------------------------------------------------------

describe('clearHistory', () => {
  it('removes all turns so loadHistory returns empty array', async () => {
    const storage = makeStorage();
    await buildExchanges(3, storage);
    await clearHistory(storage);
    expect(await loadHistory(storage)).toEqual([]);
  });

  it('is idempotent — safe to call on an already-empty history', async () => {
    const storage = makeStorage();
    await clearHistory(storage);
    expect(await loadHistory(storage)).toEqual([]);
  });

  it('does not affect a subsequent appendTurn call', async () => {
    const storage = makeStorage();
    await buildExchanges(2, storage);
    await clearHistory(storage);
    const turns = await appendTurn(turn('user', 'fresh start'), storage);
    expect(turns).toHaveLength(1);
    expect(turns[0].content).toBe('fresh start');
  });
});
