<div align="center">

# 🕶️ GlassAI

**Voice-first AI assistant for Even Realities G2 smart glasses**
Speak to your glasses, hear from Hermes — all bridged through one BondIT proxy

![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white&style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black&style=for-the-badge)
![Vite](https://img.shields.io/badge/Vite-6-646CFF?logo=vite&logoColor=white&style=for-the-badge)
![Even Realities G2](https://img.shields.io/badge/Even%20Realities-G2-000000?style=for-the-badge)
![OpenAI Compatible](https://img.shields.io/badge/API-OpenAI%20Compatible-412991?logo=openai&logoColor=white&style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge)

</div>

---

<table>
<tr>
<td width="40%" valign="top">

### 📁 Project Structure

```
glass-ai/
├── src/
│   ├── main.tsx            # entry: launch-source gate
│   ├── glasses-bridge.ts   # SDK wrapper
│   ├── hermes-client.ts    # OpenAI-compatible client + retry
│   ├── conversation.ts     # last-5 exchange cache
│   ├── audio.ts            # PCM → WAV encoder
│   ├── config.ts           # endpoint/key resolution
│   ├── debounce.ts
│   ├── types.ts
│   └── ui/
│       ├── HeadsUpView.tsx     # on-glasses flow
│       ├── CompanionApp.tsx    # phone settings + history
│       └── Splash.tsx
├── docs/
│   ├── SIDELOAD.md
│   └── SECURITY.md
├── index.html
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

</td>
<td width="60%" valign="top">

### 🟦 Key Features

| | Feature | Description |
|---|---|---|
| 🎙️ | **Glass-mic voice input** | PCM captured directly on the G2, batched, sent to Hermes Whisper |
| 🧠 | **Hermes chat bridge** | OpenAI-compatible `chat.completions` over HTTPS with bearer auth |
| 📜 | **Conversation memory** | Last 5 exchanges cached via the SDK's host-side local storage |
| 👓 | **Heads-up display** | 3-container layout (prompt / response / status) on the 576×288 panel |
| 📱 | **Companion settings** | Endpoint, API key, model rotation from the paired phone |
| 🔁 | **Retry + abort** | Exponential backoff on transient failures, 30s request timeout |
| 🛡️ | **Credential hygiene** | No token in source or bundle — stored only via the host bridge |

---

### 🟩 Tech Stack

| Layer | Technology |
|---|---|
| **UI** | React 19 + Vite 6 + Tailwind CSS |
| **Glasses SDK** | `@evenrealities/even_hub_sdk` 0.0.10 |
| **Components** | `even-toolkit` (BondIT-friendly Even Realities design system) |
| **AI client** | `openai` SDK pointed at the Hermes proxy |
| **Audio** | Native PCM → in-browser WAV wrap |
| **Persistence** | SDK `setLocalStorage` (phone-side, sandboxed per package ID) |

---

### 🟨 Getting Started

**1. Clone & configure**
```bash
git clone https://github.com/BondIT-ApS/glass-ai.git
cd glass-ai
cp .env.example .env.local
```

**2. Install dependencies**
```bash
npm ci
```

**3. Run the dev server**
```bash
npm run dev
# Open http://localhost:5173 — falls back to companion view in a browser
```

**4. Build for sideloading**
```bash
npm run build
# Static bundle in dist/. See docs/SIDELOAD.md for hosting + Even App pairing.
```

</td>
</tr>
</table>

---

### 🟧 Architecture

```
┌────────────────┐   bridge    ┌──────────────────┐   HTTPS/Bearer   ┌──────────────────────┐
│  G2 glasses    │ ──────────► │  Even App phone  │ ───────────────► │  Hermes proxy        │
│  (heads-up UI) │   PCM/evt   │  WebView host    │   OpenAI shape   │  glassai.bondit.dk   │
└────────────────┘             └──────────────────┘                  └──────────────────────┘
        ▲                                │                                   │
        │ container updates              │ persists config + history         │ talks to upstream
        │ via textContainerUpgrade       │ via setLocalStorage               │ provider out of band
        └────────────────────────────────┴───────────────────────────────────┘
```

The voice loop, end to end:

1. User taps a temple gesture → the host pushes a `listEvent` → debounced handler enables the mic
2. The bridge streams PCM chunks; GlassAI buffers them in memory
3. Another tap (or 1.5s of silence) ends capture → PCM is wrapped as WAV
4. `POST /v1/audio/transcriptions` (Whisper) on the proxy → text
5. `POST /v1/chat/completions` with the trimmed history → reply
6. Reply renders into the response container via `textContainerUpgrade`
7. Both turns persist into the host-side cache

---

### 🟪 Testing

| Path | What to run |
|---|---|
| **Browser preview** | `npm run dev` — bridge call times out, companion UI renders |
| **Type safety** | `npm run typecheck` |
| **Build verification** | `npm run build` |
| **Hardware** | Build, host the bundle over HTTPS, register the URL in the Even App. See [`docs/SIDELOAD.md`](docs/SIDELOAD.md) |

There is no public G2 simulator yet. The browser dev loop covers the companion app
end-to-end and most of the glasses logic via the mockable bridge surface.

---

### 🟥 Known Limitations

| Constraint | Impact |
|---|---|
| **576 × 288 display** | Replies must be short — system prompt caps responses at ~60 words by default |
| **No streaming render** | Whole-response push only; long replies feel slow before they appear |
| **Latency budget** | ~1–3 s typical: STT round trip dominates, chat completion adds the rest |
| **Mic format** | 16 kHz mono PCM-16; remote sample-rate change would require a WAV header bump |
| **No native gestures** | Only `listEvent` is exposed — fine-grained gestures (R1 ring, double-tap) surface as the same selection event today |
| **Token cap** | `max_tokens: 512` per reply to protect the display and the budget |

---

### 🔐 Configuration

The Hermes endpoint and bearer token are set from the **companion app screen**
(phone-side), not from source code or `.env`:

1. Pair the G2 with the Even App on your phone
2. Open GlassAI from the App menu (not the glasses menu)
3. Paste the Hermes endpoint URL and bearer token, save
4. Launch GlassAI from the on-glasses menu — the credentials are read out of the
   host's secure key-value store via the SDK bridge

For the security model and rotation procedure, see [`docs/SECURITY.md`](docs/SECURITY.md).

---

<div align="center">

Built by the incredible builders at <a href="https://bondit.dk">BondIT</a> 🧱<br/>
MIT licensed — see <a href="LICENSE">LICENSE</a>

</div>
