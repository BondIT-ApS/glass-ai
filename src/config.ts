/**
 * Configuration loading.
 *
 * Resolution order:
 *   1. Runtime overrides from the in-app settings screen (bridge.localStorage on the phone)
 *   2. URL params (`?endpoint=...&apiKey=...`) — used for first-launch provisioning
 *   3. Vite build-time defaults (VITE_HERMES_DEFAULT_*)
 *
 * The API key is **never** baked into the build. Settings screen is the canonical source.
 */

import type { PersistedConfig } from './types';

const STORAGE_KEY = 'glassai.config.v1';

export const DEFAULTS: PersistedConfig = {
  endpoint: import.meta.env.VITE_HERMES_DEFAULT_ENDPOINT ?? 'https://glassai.bondit.dk',
  apiKey: '',
  model: import.meta.env.VITE_HERMES_DEFAULT_MODEL ?? 'gpt-4o-mini',
};

/** Bridge-backed storage. Falls back to browser localStorage when running outside the WebView. */
export interface ConfigStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export const browserStorage: ConfigStorage = {
  async get(key) {
    return globalThis.localStorage?.getItem(key) ?? null;
  },
  async set(key, value) {
    globalThis.localStorage?.setItem(key, value);
  },
};

export async function loadConfig(storage: ConfigStorage = browserStorage): Promise<PersistedConfig> {
  const url = new URL(globalThis.location?.href ?? 'http://localhost');
  const urlOverrides: Partial<PersistedConfig> = {
    endpoint: url.searchParams.get('endpoint') ?? undefined,
    apiKey: url.searchParams.get('apiKey') ?? undefined,
    model: url.searchParams.get('model') ?? undefined,
  };

  let persisted: Partial<PersistedConfig> = {};
  const raw = await storage.get(STORAGE_KEY);
  if (raw) {
    try {
      persisted = JSON.parse(raw) as Partial<PersistedConfig>;
    } catch {
      // Corrupt payload — discard and fall through to defaults.
    }
  }

  return {
    endpoint: urlOverrides.endpoint || persisted.endpoint || DEFAULTS.endpoint,
    apiKey: urlOverrides.apiKey || persisted.apiKey || DEFAULTS.apiKey,
    model: urlOverrides.model || persisted.model || DEFAULTS.model,
  };
}

export async function saveConfig(cfg: PersistedConfig, storage: ConfigStorage = browserStorage): Promise<void> {
  await storage.set(STORAGE_KEY, JSON.stringify(cfg));
}

export function isConfigured(cfg: PersistedConfig): boolean {
  return Boolean(cfg.endpoint && cfg.apiKey);
}
