import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { initTilt3D } from "./lib/tilt3d";
import { initNavSkin } from "./lib/navSkins";
import { initInteractivity } from "./lib/interactivity";
import { registerServiceWorker } from "./lib/registerServiceWorker";

initNavSkin();
initTilt3D();
initInteractivity();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>,
);

// Ensure old service workers and caches are unregistered to avoid stale preview assets.
const LOVANET_RELOAD_FLAG = "lovanet_sw_unregistered";
const LOVANET_RELOAD_VERSION = "5"; // bump to force a new cleanup cycle and full PWA reinstall

const forceLovanetReload = () => {
  if (typeof window === "undefined") return;

  const doReload = () => {
    const url = new URL(window.location.href);
    // Remove previous cache-buster so the URL stays clean, then force a hard reload
    url.searchParams.delete("lovanet_reload");
    url.searchParams.set("_v", Date.now().toString());
    window.location.replace(url.toString());
  };

  const clearStorages = () => {
    try {
      localStorage.removeItem(LOVANET_RELOAD_FLAG);
      sessionStorage.removeItem(LOVANET_RELOAD_FLAG);
    } catch {
      // ignore
    }
  };

  if (!("serviceWorker" in navigator)) {
    clearStorages();
    doReload();
    return;
  }

  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => Promise.all(regs.map((r) => r.unregister())))
    .then(() => caches.keys())
    .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    .then(() => {
      clearStorages();
      doReload();
    })
    .catch(() => {
      clearStorages();
      doReload();
    });
};

if (typeof window !== "undefined") {
  (window as any).forceLovanetReload = forceLovanetReload;

  const swHost = window.location.hostname;
  const swIsPreview =
    window.self !== window.top ||
    swHost.startsWith("id-preview--") ||
    swHost.startsWith("preview--") ||
    swHost.endsWith(".preview.emergentagent.com") ||
    swHost.endsWith(".preview.emergentcf.cloud") ||
    swHost.endsWith("lovableproject.com") ||
    swHost.endsWith("lovableproject-dev.com") ||
    swHost === "localhost";

  if ("serviceWorker" in navigator && swIsPreview) {
    try {
      const alreadyCleaned =
        localStorage.getItem(LOVANET_RELOAD_FLAG) === LOVANET_RELOAD_VERSION ||
        sessionStorage.getItem(LOVANET_RELOAD_FLAG) === LOVANET_RELOAD_VERSION;

      if (!alreadyCleaned) {
        navigator.serviceWorker
          .getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .then(() => caches.keys())
          .then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
          .then(() => {
            localStorage.setItem(LOVANET_RELOAD_FLAG, LOVANET_RELOAD_VERSION);
            sessionStorage.setItem(LOVANET_RELOAD_FLAG, LOVANET_RELOAD_VERSION);
          })
          .catch(() => {
            // ignore errors
          });
      }
    } catch (e) {
      // ignore
    }

  }

  // Enregistrement du service worker hors ligne (requis pour l'installation PWA).
  registerServiceWorker();
}

