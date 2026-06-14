# Sideloading GlassAI on G2 hardware

The Even Realities G2 doesn't run sideloaded native apps — it loads a remote WebView
URL supplied by the Even App on the paired phone. This means "sideloading" GlassAI
is really *hosting* the built bundle somewhere the phone can reach.

## Build

```bash
npm ci
npm run build
```

The output lands in `dist/`. The bundle is fully static — no server-side rendering.

## Host the bundle

Pick any HTTPS-capable static host. Options that work today:

- **GitHub Pages** — push `dist/` to a `gh-pages` branch on a private mirror.
- **DigitalOcean App Platform / Cloudflare Pages** — point at the repo, set the build
  command to `npm run build`, publish `dist`.
- **Self-hosted** — Caddy / Nginx serving `dist/` over HTTPS works fine.

Whatever you pick, the URL must be HTTPS — the Even App WebView will refuse plain HTTP.

## Register the URL with the Even App

1. Open the Even App on your phone
2. Developer menu → *Add WebView App* (exact menu name depends on Even App version)
3. Paste the hosted URL
4. Optional: pass `?endpoint=…&apiKey=…` as URL parameters for one-shot provisioning.
   The query string is consumed once and persisted via the SDK's local storage,
   then dropped from subsequent navigations.

## First launch

The Even App will push a `launchSource` of `appMenu` when you tap the app icon. The
WebView renders the companion settings screen — enter your Hermes endpoint and API
key here and save.

Open GlassAI from the on-glasses menu next. The launch source is `glassesMenu`,
the webview swaps to the heads-up view, and `createStartUpPageContainer` builds the
three text containers (prompt / response / status). The glasses are now ready.

## Tap-to-speak

The bridge surfaces on-glasses gesture input as a single `listEvent`. GlassAI binds
that to mic on/off:

1. First tap → start streaming PCM, show "Listening…"
2. Second tap *or* 1.5s of silence → stop, encode WAV, send to Hermes
3. Transcription returns → "Thinking…" while the chat completion runs
4. Reply renders into the response container

## Verifying in the simulator

There is no official G2 simulator yet. The best dev loop is:

```bash
npm run dev
# Open http://localhost:5173 in any modern browser.
```

In a browser, `waitForEvenAppBridge()` times out after ~1.5s and the app falls back
to the companion view, so you can iterate on settings/history UX without hardware.
For glasses-side UI iteration, use a debug build that injects a mock bridge — see
`src/glasses-bridge.ts` for the surface to mock.
