/**
 * Audio capture from the glasses microphone.
 *
 * The G2 bridge delivers PCM in chunks via `event.audioEvent.audioPcm` (Uint8Array).
 * We buffer chunks while the user is speaking, then wrap them in a WAV container so the
 * Hermes Whisper endpoint can consume them as a regular audio file.
 *
 * Recording stops when:
 *   - The user releases the gesture (signalled by listEvent), or
 *   - A silence window of `silenceMs` passes with no new audio chunks.
 *
 * Sample rate is hardcoded to 16 kHz mono PCM-16 — the format the G2 mic delivers.
 * If a future SDK update changes this, update SAMPLE_RATE and the WAV header.
 */

const SAMPLE_RATE = 16_000;
const BITS_PER_SAMPLE = 16;
const CHANNELS = 1;

export interface AudioBufferState {
  chunks: Uint8Array[];
  totalBytes: number;
}

export function createBuffer(): AudioBufferState {
  return { chunks: [], totalBytes: 0 };
}

export function appendChunk(state: AudioBufferState, chunk: Uint8Array): void {
  state.chunks.push(chunk);
  state.totalBytes += chunk.byteLength;
}

export function reset(state: AudioBufferState): void {
  state.chunks = [];
  state.totalBytes = 0;
}

/** Convert buffered PCM chunks into a single WAV-formatted Blob. */
export function toWavBlob(state: AudioBufferState): Blob {
  const pcmLength = state.totalBytes;
  const wav = new ArrayBuffer(44 + pcmLength);
  const view = new DataView(wav);

  // RIFF header
  writeAscii(view, 0, 'RIFF');
  view.setUint32(4, 36 + pcmLength, true);
  writeAscii(view, 8, 'WAVE');

  // fmt chunk
  writeAscii(view, 12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, (SAMPLE_RATE * CHANNELS * BITS_PER_SAMPLE) / 8, true);
  view.setUint16(32, (CHANNELS * BITS_PER_SAMPLE) / 8, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);

  // data chunk
  writeAscii(view, 36, 'data');
  view.setUint32(40, pcmLength, true);

  // payload
  let offset = 44;
  for (const chunk of state.chunks) {
    new Uint8Array(wav, offset, chunk.byteLength).set(chunk);
    offset += chunk.byteLength;
  }

  return new Blob([wav], { type: 'audio/wav' });
}

function writeAscii(view: DataView, offset: number, text: string): void {
  for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
}

/** Minimum audio length we'll bother sending to Whisper. Shorter = likely accidental tap. */
export const MIN_AUDIO_BYTES = (SAMPLE_RATE * 2) / 4; // ~250ms of 16-bit mono
