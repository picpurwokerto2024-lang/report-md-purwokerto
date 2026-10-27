import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';

// Auto-reload once when an updated Service Worker takes control over an older cached bundle
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  const hadController = Boolean(navigator.serviceWorker.controller);
  let isReloading = false;

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !isReloading) {
      isReloading = true;
      window.location.reload();
    }
  });
}

// Register service worker for PWA offline caching & immediate background update checks
registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    // Check for latest bundle immediately on startup and when returning to foreground
    registration.update().catch(() => {});
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        registration.update().catch(() => {});
      }
    });
  },
});

createRoot(document.getElementById('root')!).render(<App />);
