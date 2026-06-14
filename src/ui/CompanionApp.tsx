/**
 * CompanionApp — phone-side settings and history.
 *
 * Rendered when the WebView is launched from the App menu (not the glasses menu).
 * Lets the user enter / rotate the Hermes endpoint + API key, pick a model, view
 * the last cached exchanges, and clear history.
 */

import { useEffect, useState } from 'react';
import { browserStorage, DEFAULTS, isConfigured, loadConfig, saveConfig } from '../config';
import { clearHistory, loadHistory } from '../conversation';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import type { ChatTurn, PersistedConfig } from '../types';

interface BridgeStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export function CompanionApp() {
  const [cfg, setCfg] = useState<PersistedConfig>(DEFAULTS);
  const [history, setHistory] = useState<ChatTurn[]>([]);
  const [storage, setStorage] = useState<BridgeStorage>(browserStorage);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let s: BridgeStorage = browserStorage;
      try {
        const bridge = await waitForEvenAppBridge();
        s = {
          get: async (key) => (await bridge.getLocalStorage(key)) ?? null,
          set: async (key, value) => {
            await bridge.setLocalStorage(key, value);
          },
        };
      } catch {
        // No bridge — use browser localStorage. This path also enables web preview.
      }
      if (cancelled) return;
      setStorage(s);
      const loaded = await loadConfig(s);
      setCfg(loaded);
      setHistory(await loadHistory(s));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await saveConfig(cfg, storage);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleClear = async () => {
    await clearHistory(storage);
    setHistory([]);
  };

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col gap-6 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">GlassAI</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Voice assistant for Even Realities G2 — bridged to Hermes.
        </p>
      </header>

      <section className="space-y-4 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
          Hermes Connection
        </h2>

        <label className="block">
          <span className="text-xs text-zinc-400">Endpoint URL</span>
          <input
            type="url"
            value={cfg.endpoint}
            onChange={(e) => setCfg((prev) => ({ ...prev, endpoint: e.target.value }))}
            placeholder="https://glassai.bondit.dk"
            className="mt-1 w-full rounded border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">API Key</span>
          <input
            type="password"
            value={cfg.apiKey}
            autoComplete="new-password"
            onChange={(e) => setCfg((prev) => ({ ...prev, apiKey: e.target.value }))}
            placeholder="hk_..."
            className="mt-1 w-full rounded border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
          <span className="mt-1 block text-[11px] text-zinc-500">
            Stored on this phone only. See SECURITY.md.
          </span>
        </label>

        <label className="block">
          <span className="text-xs text-zinc-400">Model</span>
          <input
            type="text"
            value={cfg.model}
            onChange={(e) => setCfg((prev) => ({ ...prev, model: e.target.value }))}
            className="mt-1 w-full rounded border border-zinc-800 bg-black px-3 py-2 text-sm text-white focus:border-emerald-500 focus:outline-none"
          />
        </label>

        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !cfg.endpoint || !cfg.apiKey}
          className="w-full rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>

        {!isConfigured(cfg) ? (
          <p className="text-xs text-amber-400">
            Endpoint and API key are required before voice will work on the glasses.
          </p>
        ) : null}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium uppercase tracking-widest text-zinc-500">
            Recent Conversation
          </h2>
          <button
            type="button"
            onClick={handleClear}
            className="text-xs text-zinc-500 underline-offset-4 hover:text-rose-400 hover:underline"
          >
            Clear
          </button>
        </div>
        {history.length === 0 ? (
          <p className="text-sm text-zinc-500">No exchanges yet.</p>
        ) : (
          <ul className="space-y-3">
            {history.map((turn, i) => (
              <li
                key={`${turn.ts}-${i}`}
                className="rounded border border-zinc-800 bg-black p-3 text-sm"
              >
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {turn.role}
                </div>
                <div className="mt-1 whitespace-pre-wrap text-zinc-100">{turn.content}</div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <footer className="pb-4 text-center text-[11px] text-zinc-600">
        GlassAI · maintained by BondIT
      </footer>
    </div>
  );
}
