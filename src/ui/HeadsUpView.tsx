/**
 * HeadsUpView — the on-glasses experience.
 *
 * Rendered into the 576x288 G2 display via the SDK's text containers. The React tree
 * here is mostly a state machine driving the bridge; visible DOM is minimal because
 * the actual pixels are drawn by the host app from the container properties we push.
 *
 * Flow:
 *   1. listSelected (debounced) → start mic capture
 *   2. audioChunk events buffer PCM
 *   3. listSelected again, or 1.5s of silence → stop mic, encode WAV, send to Hermes
 *   4. Transcribe → chat → render response → append to history
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { GlassesBridge } from '../glasses-bridge';
import { HermesClient } from '../hermes-client';
import { loadConfig, isConfigured } from '../config';
import { appendChunk, createBuffer, MIN_AUDIO_BYTES, reset, toWavBlob } from '../audio';
import { appendTurn, loadHistory } from '../conversation';
import { debounce } from '../debounce';
import type { ChatTurn, GlassesUiState } from '../types';

const SILENCE_TIMEOUT_MS = 1500;

export function HeadsUpView() {
  const [state, setState] = useState<GlassesUiState>({
    status: 'idle',
    prompt: '',
    response: '',
  });
  const bridgeRef = useRef<GlassesBridge | null>(null);
  const hermesRef = useRef<HermesClient | null>(null);
  const historyRef = useRef<ChatTurn[]>([]);
  const audioBufRef = useRef(createBuffer());
  const recordingRef = useRef(false);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pushStatus = useCallback(async (next: Partial<GlassesUiState>) => {
    setState((prev) => {
      const merged = { ...prev, ...next };
      bridgeRef.current
        ?.renderResponse(merged.prompt, merged.response, statusLabel(merged))
        .catch(() => {
          // Render failures are non-fatal — the bridge logs them itself.
        });
      return merged;
    });
  }, []);

  const finishRecording = useCallback(async () => {
    if (!recordingRef.current) return;
    recordingRef.current = false;
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    const bridge = bridgeRef.current;
    const hermes = hermesRef.current;
    if (!bridge || !hermes) return;
    try {
      await bridge.setMicEnabled(false);
    } catch (error) {
      // Mic disable failures aren't fatal; the host will reset on next launch.
      console.warn('[GlassAI] mic disable failed', error);
    }

    if (audioBufRef.current.totalBytes < MIN_AUDIO_BYTES) {
      reset(audioBufRef.current);
      await pushStatus({ status: 'idle', errorMessage: undefined });
      return;
    }

    await pushStatus({ status: 'transcribing' });
    try {
      const wav = toWavBlob(audioBufRef.current);
      reset(audioBufRef.current);
      const prompt = await hermes.transcribe(wav);
      if (!prompt) {
        await pushStatus({ status: 'idle' });
        return;
      }
      await pushStatus({ status: 'thinking', prompt, response: '' });
      const reply = await hermes.chat(historyRef.current, prompt);
      const ts = Date.now();
      historyRef.current = await appendTurn(
        { role: 'user', content: prompt, ts },
        bridge.storage,
      );
      historyRef.current = await appendTurn(
        { role: 'assistant', content: reply, ts: Date.now() },
        bridge.storage,
      );
      await pushStatus({ status: 'idle', prompt, response: reply });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('[GlassAI] pipeline error', error);
      await pushStatus({ status: 'error', errorMessage: message });
    }
  }, [pushStatus]);

  const handleListSelected = useCallback(async () => {
    const bridge = bridgeRef.current;
    if (!bridge) return;
    if (recordingRef.current) {
      await finishRecording();
      return;
    }
    if (!hermesRef.current) {
      await pushStatus({
        status: 'error',
        errorMessage: 'Open GlassAI on your phone to add your Hermes API key.',
      });
      return;
    }
    reset(audioBufRef.current);
    recordingRef.current = true;
    await pushStatus({ status: 'listening', prompt: '', response: '', errorMessage: undefined });
    try {
      await bridge.setMicEnabled(true);
    } catch (error) {
      recordingRef.current = false;
      const message = error instanceof Error ? error.message : String(error);
      await pushStatus({ status: 'error', errorMessage: `Mic error: ${message}` });
    }
  }, [finishRecording, pushStatus]);

  useEffect(() => {
    let mounted = true;
    const debouncedListSelect = debounce(() => {
      void handleListSelected();
    }, 250);

    const bridge = new GlassesBridge({
      onListSelected: debouncedListSelect,
      onAudioChunk: (pcm) => {
        if (!recordingRef.current) return;
        appendChunk(audioBufRef.current, pcm);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
          void finishRecording();
        }, SILENCE_TIMEOUT_MS);
      },
      onError: (error) => {
        console.warn('[GlassAI] bridge event error', error);
      },
    });
    bridgeRef.current = bridge;

    (async () => {
      try {
        await bridge.init();
        const cfg = await loadConfig(bridge.storage);
        if (isConfigured(cfg)) hermesRef.current = new HermesClient(cfg);
        historyRef.current = await loadHistory(bridge.storage);
        if (!mounted) return;
        await bridge.renderResponse(
          isConfigured(cfg) ? 'Tap to speak.' : 'Set up GlassAI on your phone.',
          '',
          isConfigured(cfg) ? 'Ready' : 'Setup required',
        );
      } catch (error) {
        console.error('[GlassAI] init failed', error);
      }
    })();

    return () => {
      mounted = false;
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };
  }, [handleListSelected, finishRecording]);

  // Visible DOM is a debug overlay only — the user sees the glasses display, not this.
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 p-4 text-zinc-300">
      <div className="text-xs uppercase tracking-widest text-zinc-500">GlassAI · heads-up</div>
      <div className="w-full max-w-g2-display rounded border border-zinc-800 bg-zinc-950 p-3 text-sm">
        <div className="mb-2 text-zinc-500">Status: {statusLabel(state)}</div>
        <div className="mb-2"><span className="text-zinc-500">Prompt:</span> {state.prompt || '—'}</div>
        <div><span className="text-zinc-500">Response:</span> {state.response || '—'}</div>
        {state.errorMessage ? (
          <div className="mt-2 text-rose-400">⚠ {state.errorMessage}</div>
        ) : null}
      </div>
    </div>
  );
}

function statusLabel(state: GlassesUiState): string {
  switch (state.status) {
    case 'listening':
      return 'Listening…';
    case 'transcribing':
      return 'Transcribing…';
    case 'thinking':
      return 'Thinking…';
    case 'error':
      return state.errorMessage ?? 'Error';
    default:
      return 'Ready';
  }
}
