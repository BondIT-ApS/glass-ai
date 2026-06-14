import { describe, expect, it } from 'vitest';
import type { PersistedConfig } from './types';
import {
  DEFAULTS,
  isConfigured,
  loadConfig,
  saveConfig,
  type ConfigStorage,
} from './config';

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

function stored(cfg: Partial<PersistedConfig>): Record<string, string> {
  return { 'glassai.config.v1': JSON.stringify(cfg) };
}

// ---------------------------------------------------------------------------
// DEFAULTS
// ---------------------------------------------------------------------------

describe('DEFAULTS', () => {
  it('has a non-empty endpoint', () => {
    expect(DEFAULTS.endpoint).toBeTruthy();
  });

  it('has an empty apiKey (credentials are never baked in)', () => {
    expect(DEFAULTS.apiKey).toBe('');
  });

  it('has a non-empty model', () => {
    expect(DEFAULTS.model).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// loadConfig
// ---------------------------------------------------------------------------

describe('loadConfig', () => {
  it('returns DEFAULTS when storage is empty', async () => {
    const cfg = await loadConfig(makeStorage());
    expect(cfg).toEqual(DEFAULTS);
  });

  it('uses persisted endpoint over default', async () => {
    const cfg = await loadConfig(makeStorage(stored({ endpoint: 'https://custom.example.com' })));
    expect(cfg.endpoint).toBe('https://custom.example.com');
  });

  it('uses persisted apiKey over default', async () => {
    const cfg = await loadConfig(makeStorage(stored({ apiKey: 'hk_test_123' })));
    expect(cfg.apiKey).toBe('hk_test_123');
  });

  it('uses persisted model over default', async () => {
    const cfg = await loadConfig(makeStorage(stored({ model: 'gpt-4o' })));
    expect(cfg.model).toBe('gpt-4o');
  });

  it('loads all three persisted values at once', async () => {
    const persisted = { endpoint: 'https://e.test', apiKey: 'key', model: 'gpt-4o' };
    const cfg = await loadConfig(makeStorage(stored(persisted)));
    expect(cfg).toEqual(persisted);
  });

  it('falls back to DEFAULTS for a field missing in stored config', async () => {
    // Only endpoint is stored; model and apiKey should come from DEFAULTS
    const cfg = await loadConfig(makeStorage(stored({ endpoint: 'https://e.test' })));
    expect(cfg.endpoint).toBe('https://e.test');
    expect(cfg.apiKey).toBe(DEFAULTS.apiKey);
    expect(cfg.model).toBe(DEFAULTS.model);
  });

  it('falls back to DEFAULTS when stored JSON is corrupt', async () => {
    const cfg = await loadConfig(
      makeStorage({ 'glassai.config.v1': 'not-valid-json' }),
    );
    expect(cfg).toEqual(DEFAULTS);
  });

  it('falls back to DEFAULTS when stored value is null', async () => {
    const cfg = await loadConfig(makeStorage());
    expect(cfg).toEqual(DEFAULTS);
  });
});

// ---------------------------------------------------------------------------
// saveConfig
// ---------------------------------------------------------------------------

describe('saveConfig', () => {
  it('persists all fields so loadConfig reads them back identically', async () => {
    const storage = makeStorage();
    const original: PersistedConfig = {
      endpoint: 'https://save.test',
      apiKey: 'hk_save_key',
      model: 'custom-model',
    };
    await saveConfig(original, storage);
    const loaded = await loadConfig(storage);
    expect(loaded).toEqual(original);
  });

  it('overwrites a previous saved config', async () => {
    const storage = makeStorage();
    await saveConfig({ endpoint: 'https://old.test', apiKey: 'old', model: 'old-m' }, storage);
    await saveConfig({ endpoint: 'https://new.test', apiKey: 'new', model: 'new-m' }, storage);
    const loaded = await loadConfig(storage);
    expect(loaded.endpoint).toBe('https://new.test');
    expect(loaded.apiKey).toBe('new');
  });
});

// ---------------------------------------------------------------------------
// isConfigured
// ---------------------------------------------------------------------------

describe('isConfigured', () => {
  it('returns false when apiKey is empty', () => {
    expect(isConfigured({ endpoint: 'https://x.com', apiKey: '', model: 'm' })).toBe(false);
  });

  it('returns false when endpoint is empty', () => {
    expect(isConfigured({ endpoint: '', apiKey: 'key', model: 'm' })).toBe(false);
  });

  it('returns false when both endpoint and apiKey are empty', () => {
    expect(isConfigured({ endpoint: '', apiKey: '', model: 'm' })).toBe(false);
  });

  it('returns true when both endpoint and apiKey are set', () => {
    expect(isConfigured({ endpoint: 'https://x.com', apiKey: 'key', model: 'm' })).toBe(true);
  });
});
