import { API_BASE } from "@/lib/apiBase";

type PushPublicConfig = {
  supported: boolean;
  vapid_public_key?: string | null;
  reason?: string | null;
};

type PushTestResponse = {
  status: string;
  result?: {
    status?: string;
  };
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

const parseErrorMessage = async (response: Response) => {
  try {
    const payload = await response.json();
    if (typeof payload?.detail === "string") return payload.detail;
  } catch {
    // ignore
  }
  return `HTTP ${response.status}`;
};

const urlBase64ToUint8Array = (value: string) => {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = `${value}${padding}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    output[index] = raw.charCodeAt(index);
  }
  return output;
};

export const isWebPushSupported = () => {
  if (typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
};

export const fetchWebPushConfig = async (): Promise<PushPublicConfig> => {
  const response = await fetch(`${API_BASE}/push/public-key`);
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return response.json();
};

export const registerWebPushSubscription = async (forceResubscribe = false) => {
  if (!isWebPushSupported()) {
    throw new Error("Ce navigateur ne supporte pas les notifications push.");
  }

  const config = await fetchWebPushConfig();
  if (!config.supported || !config.vapid_public_key) {
    throw new Error("Web Push non configuré côté serveur.");
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();

  if (subscription && forceResubscribe) {
    await subscription.unsubscribe().catch(() => undefined);
    subscription = null;
  }

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.vapid_public_key),
    });
  }

  const response = await fetch(`${API_BASE}/push/subscribe`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({
      subscription: subscription.toJSON(),
      locale: navigator.language,
    }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return subscription;
};

export const unsubscribeWebPushSubscription = async () => {
  if (!isWebPushSupported()) return false;
  const registration = await navigator.serviceWorker.ready;
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return false;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe().catch(() => undefined);
  await fetch(`${API_BASE}/push/unsubscribe`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ endpoint }),
  }).catch(() => undefined);
  return true;
};

export const sendWebPushTest = async (endpoint: string) => {
  const response = await fetch(`${API_BASE}/push/test`, {
    method: "POST",
    headers: jsonHeaders,
    body: JSON.stringify({ endpoint }),
  });
  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }
  return (await response.json()) as PushTestResponse;
};