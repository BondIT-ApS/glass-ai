/**
 * Shared types for GlassAI.
 *
 * Kept framework-agnostic so the bridge layer doesn't pull React into glasses-only
 * code paths. Persisted shapes (conversation cache) are versioned for forward-compat.
 */

export type LaunchSource = 'appMenu' | 'glassesMenu';

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
  /** Unix ms when this turn was added. Used for stale-cache pruning. */
  ts: number;
}

export interface PersistedConfig {
  endpoint: string;
  /** Bearer token. Stored via bridge.setLocalStorage on the phone, never logged. */
  apiKey: string;
  model: string;
}

export interface PersistedHistory {
  /** Bump when the shape changes so older payloads are discarded cleanly. */
  version: 1;
  turns: ChatTurn[];
}

export type AsrStatus = 'idle' | 'listening' | 'transcribing' | 'thinking' | 'error';

export interface GlassesUiState {
  status: AsrStatus;
  /** Last transcribed user prompt, displayed on the glasses while Hermes responds. */
  prompt: string;
  /** Hermes response. Paginated across containers on render. */
  response: string;
  errorMessage?: string;
}
