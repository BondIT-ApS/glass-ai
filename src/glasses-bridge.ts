/**
 * Glasses-side bridge wrapper.
 *
 * Wraps `@evenrealities/even_hub_sdk` and exposes the narrow surface GlassAI actually
 * uses: launch-source detection, mic control, audio frames, list-selection events,
 * and container-based text rendering.
 *
 * The SDK requires `createStartUpPageContainer` to be called before any other UI op,
 * so we expose a single `init()` that does that setup, then `renderResponse()` updates
 * the existing containers in place via `textContainerUpgrade`.
 */

import {
  waitForEvenAppBridge,
  CreateStartUpPageContainer,
  TextContainerProperty,
  TextContainerUpgrade,
  type EvenAppBridge,
  type EvenHubEvent,
} from '@evenrealities/even_hub_sdk';
import type { LaunchSource } from './types';

/** G2 display dimensions, in CSS-like pixels. */
export const DISPLAY_W = 576;
export const DISPLAY_H = 288;

const PROMPT_CONTAINER_ID = 1;
const RESPONSE_CONTAINER_ID = 2;
const STATUS_CONTAINER_ID = 3;

export interface BridgeCallbacks {
  onLaunchSource?: (source: LaunchSource) => void;
  onListSelected?: () => void;
  onAudioChunk?: (pcm: Uint8Array) => void;
  onError?: (error: unknown) => void;
}

export class GlassesBridge {
  private bridge: EvenAppBridge | null = null;
  private cbs: BridgeCallbacks;
  private listenersAttached = false;

  constructor(callbacks: BridgeCallbacks) {
    this.cbs = callbacks;
  }

  /** Wait for the WebView bridge, register listeners, and build the initial UI. */
  async init(): Promise<void> {
    this.bridge = await waitForEvenAppBridge();

    if (this.cbs.onLaunchSource) {
      this.bridge.onLaunchSource((source) => {
        this.cbs.onLaunchSource?.(source as LaunchSource);
      });
    }

    this.bridge.onEvenHubEvent((event: EvenHubEvent) => {
      try {
        if (event.listEvent && this.cbs.onListSelected) {
          this.cbs.onListSelected();
        }
        if (event.audioEvent && this.cbs.onAudioChunk) {
          this.cbs.onAudioChunk(event.audioEvent.audioPcm);
        }
      } catch (error) {
        this.cbs.onError?.(error);
      }
    });

    this.listenersAttached = true;
    await this.buildStartupPage();
  }

  /** Local key/value store, persisted by the host phone app across launches. */
  get storage() {
    return {
      get: async (key: string) => {
        if (!this.bridge) return null;
        return (await this.bridge.getLocalStorage(key)) ?? null;
      },
      set: async (key: string, value: string) => {
        if (!this.bridge) return;
        await this.bridge.setLocalStorage(key, value);
      },
    };
  }

  /** Begin/stop streaming PCM from the on-glasses microphone. */
  async setMicEnabled(enabled: boolean): Promise<void> {
    if (!this.bridge) throw new Error('Bridge not initialised.');
    await this.bridge.audioControl(enabled);
  }

  /** Render the user's prompt + Hermes response into the on-glasses containers. */
  async renderResponse(prompt: string, response: string, status: string): Promise<void> {
    if (!this.bridge) return;
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: PROMPT_CONTAINER_ID,
        content: truncate(prompt, 80),
      }),
    );
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: RESPONSE_CONTAINER_ID,
        content: truncate(response, 400),
      }),
    );
    await this.bridge.textContainerUpgrade(
      new TextContainerUpgrade({
        containerID: STATUS_CONTAINER_ID,
        content: status,
      }),
    );
  }

  private async buildStartupPage(): Promise<void> {
    if (!this.bridge) return;
    await this.bridge.createStartUpPageContainer(
      new CreateStartUpPageContainer({
        containerTotalNum: 3,
        textObject: [
          new TextContainerProperty({
            xPosition: 16,
            yPosition: 12,
            width: DISPLAY_W - 32,
            height: 48,
            containerID: PROMPT_CONTAINER_ID,
            containerName: 'prompt',
            content: 'Tap to speak.',
            isEventCapture: 0,
          }),
          new TextContainerProperty({
            xPosition: 16,
            yPosition: 72,
            width: DISPLAY_W - 32,
            height: 168,
            containerID: RESPONSE_CONTAINER_ID,
            containerName: 'response',
            content: '',
            isEventCapture: 1, // capture list-select events on the response container
          }),
          new TextContainerProperty({
            xPosition: 16,
            yPosition: 252,
            width: DISPLAY_W - 32,
            height: 24,
            containerID: STATUS_CONTAINER_ID,
            containerName: 'status',
            content: 'Ready',
            isEventCapture: 0,
          }),
        ],
        listObject: [],
      }),
    );
  }

  get isReady(): boolean {
    return this.listenersAttached;
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + '…';
}
