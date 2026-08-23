import { describe, expect, it } from "vitest";
import { LOCAL_VIDEO_FALLBACKS } from "@/lib/mediaFallback";

describe("site fallback media", () => {
  it("keeps the Lovable example video assets available as Emergent fallbacks", () => {
    expect(LOCAL_VIDEO_FALLBACKS).toEqual(
      expect.arrayContaining([
        "/global-bg-web.mp4",
        "/global-bg-mobile.mp4",
        "/actualites-banner.mp4",
        "/actualites-banner-2.mp4",
        "/home-banner.mp4",
        "/custom-hero-banner.mp4",
        "/premium-border-1.mp4",
        "/premium-border-2.mp4",
      ]),
    );
  });
});
