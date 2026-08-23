import type { SyntheticEvent } from "react";

export const LOCAL_VIDEO_FALLBACKS = [
  "/global-bg-web.mp4",
  "/global-bg-mobile.mp4",
  "/actualites-banner.mp4",
  "/actualites-banner-2.mp4",
  "/home-banner.mp4",
  "/custom-hero-banner.mp4",
  "/manga-universe-banner.mp4",
  "/leaderboard-banner.mp4",
  "/catalogue-banner.mp4",
  "/premium-border-1.mp4",
  "/premium-border-2.mp4",
  "/premium-border-3.mp4",
  "/premium-border-4.mp4",
  "/custom_video_lovanet.mp4",
  "/root-capture-video-latest.mp4",
  "/banner-seq-2.mp4",
  "/banner-seq-3.mp4",
  "/capture-deck-user-video.mp4",
];

const LOCAL_IMAGE_FALLBACKS = Array.from(
  { length: 12 },
  (_, index) => `/products/am-${String(index + 1).padStart(3, "0")}.svg`,
);

function hashString(value: string) {
  let hash = 2166136261 >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return hash >>> 0;
}

export function siteFallbackImage(seed: string, preferred?: string | null) {
  const normalizedPreferred = String(preferred || "").trim();
  if (normalizedPreferred && !/^https?:\/\//i.test(normalizedPreferred) && normalizedPreferred.startsWith("/")) {
    return normalizedPreferred;
  }
  const index = hashString(seed || normalizedPreferred || "lovanet-image") % LOCAL_IMAGE_FALLBACKS.length;
  return LOCAL_IMAGE_FALLBACKS[index];
}

export function siteFallbackVideo(seed: string) {
  const index = hashString(seed || "lovanet-video") % LOCAL_VIDEO_FALLBACKS.length;
  return LOCAL_VIDEO_FALLBACKS[index];
}

export function createImageFallbackHandler(seed: string, finalFallback?: string | null) {
  return (event: SyntheticEvent<HTMLImageElement>) => {
    const img = event.currentTarget;
    const current = img.getAttribute("src") || "";
    const next = siteFallbackImage(seed, finalFallback);
    if (current !== next) {
      img.src = next;
      return;
    }
    img.onerror = null;
  };
}

export function isLikelyUnavailableThumbnail(url?: string | null) {
  const value = String(url || "").toLowerCase();
  if (!value) return true;
  return value.includes("default.jpg") || value.includes("mqdefault") || value.includes("maxresdefault") || value.includes("hqdefault");
}
