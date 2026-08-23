// Enregistrement unique et protege du service worker hors ligne (/sw.js).
const SW_URL = "/sw.js";

const isRefusedContext = () => {
  if (typeof window === "undefined") return true;
  if (!import.meta.env.PROD) return true;
  if (window.self !== window.top) return true;
  const host = window.location.hostname;
  if (
    host.startsWith("id-preview--") ||
    host.startsWith("preview--") ||
    host.endsWith(".preview.emergentagent.com") ||
    host.endsWith(".preview.emergentcf.cloud") ||
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev") ||
    host === "localhost"
  ) {
    return true;
  }
  return new URLSearchParams(window.location.search).get("sw") === "off";
};

const unregisterAppWorkers = async () => {
  if (!("serviceWorker" in navigator)) return;
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs
      .filter((r) => {
        const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
        return url.endsWith(SW_URL) || url.endsWith("/service-worker.js");
      })
      .map((r) => r.unregister()),
  );
};

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (isRefusedContext()) {
    void unregisterAppWorkers().catch(() => {});
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker.register(SW_URL, { scope: "/" }).catch(() => {});
  });
}
