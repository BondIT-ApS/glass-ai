import { describe, it, expect } from 'vitest';
import {
  appendChunk,
  createBuffer,
  MIN_AUDIO_BYTES,
  reset,
  toWavBlob,
} from './audio';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read a WAV Blob back as a DataView for header inspection. */
async function wavView(blob: Blob): Promise<DataView> {
  return new DataView(await blob.arrayBuffer());
}

function ascii(view: DataView, offset: number, len: number): string {
  return Array.from({ length: len }, (_, i) =>
    String.fromCharCode(view.getUint8(offset + i)),
  ).join('');
}

// ---------------------------------------------------------------------------
// createBuffer
// ---------------------------------------------------------------------------

describe('createBuffer', () => {
  it('returns an empty buffer', () => {
    const buf = createBuffer();
    expect(buf.chunks).toEqual([]);
    expect(buf.totalBytes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// appendChunk
// ---------------------------------------------------------------------------

describe('appendChunk', () => {
  it('stores the chunk and updates totalBytes', () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array([1, 2, 3, 4]));
    expect(buf.chunks).toHaveLength(1);
    expect(buf.totalBytes).toBe(4);
  });

  it('accumulates multiple chunks correctly', () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(100));
    appendChunk(buf, new Uint8Array(200));
    appendChunk(buf, new Uint8Array(50));
    expect(buf.chunks).toHaveLength(3);
    expect(buf.totalBytes).toBe(350);
  });

  it('does not copy chunk data — stores the original reference', () => {
    const buf = createBuffer();
    const chunk = new Uint8Array([0xff]);
    appendChunk(buf, chunk);
    expect(buf.chunks[0]).toBe(chunk);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe('reset', () => {
  it('clears all chunks and resets totalBytes to 0', () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(100));
    appendChunk(buf, new Uint8Array(200));
    reset(buf);
    expect(buf.chunks).toEqual([]);
    expect(buf.totalBytes).toBe(0);
  });

  it('is safe to call on an already-empty buffer', () => {
    const buf = createBuffer();
    expect(() => reset(buf)).not.toThrow();
    expect(buf.totalBytes).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// MIN_AUDIO_BYTES
// ---------------------------------------------------------------------------

describe('MIN_AUDIO_BYTES', () => {
  it('equals ~250 ms of 16-bit mono 16 kHz audio (8 000 bytes)', () => {
    // 16 000 samples/s × 2 bytes/sample ÷ 4 = 8 000 bytes ≈ 250 ms
    expect(MIN_AUDIO_BYTES).toBe(8_000);
  });
});

// ---------------------------------------------------------------------------
// toWavBlob
// ---------------------------------------------------------------------------

describe('toWavBlob', () => {
  it('returns a Blob with type audio/wav', () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(100));
    expect(toWavBlob(buf).type).toBe('audio/wav');
  });

  it('total size is 44-byte WAV header + PCM payload', () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(256));
    expect(toWavBlob(buf).size).toBe(44 + 256);
  });

  it('writes RIFF signature at byte 0', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(ascii(view, 0, 4)).toBe('RIFF');
  });

  it('writes WAVE marker at byte 8', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(ascii(view, 8, 4)).toBe('WAVE');
  });

  it('writes fmt chunk marker at byte 12', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(ascii(view, 12, 4)).toBe('fmt ');
  });

  it('writes data chunk marker at byte 36', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(ascii(view, 36, 4)).toBe('data');
  });

  it('encodes PCM format (audio format = 1) at byte 20', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint16(20, true)).toBe(1);
  });

  it('encodes 1 channel (mono) at byte 22', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint16(22, true)).toBe(1);
  });

  it('encodes 16 000 Hz sample rate at byte 24', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint32(24, true)).toBe(16_000);
  });

  it('encodes 16 bits per sample at byte 34', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(64));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint16(34, true)).toBe(16);
  });

  it('writes PCM byte count in data chunk length field (byte 40)', async () => {
    const pcmLen = 512;
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(pcmLen));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint32(40, true)).toBe(pcmLen);
  });

  it('writes RIFF chunk size = 36 + pcmLen at byte 4', async () => {
    const pcmLen = 100;
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array(pcmLen));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint32(4, true)).toBe(36 + pcmLen);
  });

  it('preserves PCM byte values starting at byte 44', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array([0xde, 0xad, 0xbe, 0xef]));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint8(44)).toBe(0xde);
    expect(view.getUint8(45)).toBe(0xad);
    expect(view.getUint8(46)).toBe(0xbe);
    expect(view.getUint8(47)).toBe(0xef);
  });

  it('concatenates multiple chunks in order', async () => {
    const buf = createBuffer();
    appendChunk(buf, new Uint8Array([0x01, 0x02]));
    appendChunk(buf, new Uint8Array([0x03, 0x04]));
    const view = await wavView(toWavBlob(buf));
    expect(view.getUint8(44)).toBe(0x01);
    expect(view.getUint8(45)).toBe(0x02);
    expect(view.getUint8(46)).toBe(0x03);
    expect(view.getUint8(47)).toBe(0x04);
  });

  it('handles an empty buffer (header only, zero PCM bytes)', () => {
    const buf = createBuffer();
    const blob = toWavBlob(buf);
    expect(blob.size).toBe(44);
  });
});
