# Security & Credentials

## Threat model

GlassAI runs as a WebView inside the Even App on a paired smartphone. The webview
talks to the Hermes proxy at `https://glassai.bondit.dk` over HTTPS, using a bearer
token. Three actors hold parts of the secret material:

| Actor | What they hold |
|---|---|
| **Phone (Even App WebView)** | The bearer token, stored via the SDK's `setLocalStorage` bridge |
| **Hermes proxy** | The real upstream provider keys (OpenAI, Anthropic, …) — these never reach the glasses or the phone |
| **G2 glasses hardware** | No credentials. The glasses only receive rendered text containers and emit input events |

## Credential storage

The bearer token is entered once on the companion phone screen and persisted via
`bridge.setLocalStorage('glassai.config.v1', …)`. The Even App is responsible for
keeping that store private to the GlassAI package ID — it is not accessible to
other WebView apps on the host.

Tokens **must not**:

- Be hardcoded in source or in `.env` files committed to the repo
- Be passed in URL query strings outside of the one-time setup flow (URL params are
  consumed on first launch and the resulting state is saved via the bridge, not the URL)
- Be logged. The Hermes client redacts the `Authorization` header in any thrown error

## Token rotation

1. Generate a fresh bearer token on the Hermes proxy
2. Open GlassAI from the App menu on the phone
3. Paste the new token, save — the old one is overwritten in the same storage key
4. Revoke the old token at the proxy

## Network surface

The webview talks to exactly one origin: the Hermes endpoint configured at setup.
Add other origins to the proxy and never to the glasses bundle. The Even App
sandbox is the only enforcement boundary for the device — keep that boundary tight.
