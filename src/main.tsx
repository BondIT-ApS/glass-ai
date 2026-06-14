/**
 * GlassAI — main app shell.
 *
 * The Even App WebView loads this URL on launch and pushes a `launchSource` event
 * indicating whether we were opened from the phone's app menu or the on-glasses menu.
 *
 *   - glassesMenu → render the voice-conversation flow (HeadsUpView)
 *   - appMenu     → render the companion settings + history screens (CompanionApp)
 *
 * This split is required by the SDK: glasses-side UI must only be built after the
 * `glassesMenu` launch source arrives, and `createStartUpPageContainer` must run first.
 */

import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HeadsUpView } from './ui/HeadsUpView';
import { CompanionApp } from './ui/CompanionApp';
import { Splash } from './ui/Splash';
import type { LaunchSource } from './types';
import { waitForEvenAppBridge } from '@evenrealities/even_hub_sdk';
import './index.css';

function App() {
  const [source, setSource] = useState<LaunchSource | 'unknown'>('unknown');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const bridge = await waitForEvenAppBridge();
        bridge.onLaunchSource((s) => {
          if (cancelled) return;
          setSource(s as LaunchSource);
        });
        // Fallback: if no launch-source push arrives within 1.5s (e.g. running in a
        // dev browser without the WebView host), assume the companion app view.
        setTimeout(() => {
          if (!cancelled) setSource((prev) => (prev === 'unknown' ? 'appMenu' : prev));
        }, 1500);
      } catch {
        // No bridge available — likely running in a dev browser. Show companion app.
        if (!cancelled) setSource('appMenu');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (source === 'unknown') return <Splash />;
  if (source === 'glassesMenu') return <HeadsUpView />;
  return <CompanionApp />;
}

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element in index.html');
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
