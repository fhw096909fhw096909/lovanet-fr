import { useEffect, useState, useCallback, useRef } from "react";
import { PageShell } from "@/components/PageShell";
import { Music2, Heart, MessageCircle, Share2, ArrowUp, ArrowDown, ExternalLink, VolumeX, Volume2, Sparkles, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminRemoveVideo } from "@/components/AdminRemoveVideo";
import { ManualSyncButton } from "@/components/ManualSyncButton";
import { GDriveCinematicBanner } from "@/components/GDriveCinematicBanner";
import { HubEmbedFrame } from "@/components/HubEmbedFrame";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { TrainStationReplicaWorld } from "@/components/TrainStation";

type TTItem = {
  id: string;
  title: string;
  series: string;
  source: "tiktok";
  videoUrl: string;
  thumb?: string | null;
};

const API = `${(import.meta.env.VITE_BACKEND_URL ?? "")}/api`;
const TIKTOK_HANDLE = "@anime.moments.officiel";
const TIKTOK_BANNER_VIDEO = "/actualites-banner-2.mp4";
const PRIME_GHOST_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/25 bg-transparent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:border-cyan-200/80 hover:bg-white/10";
const PRIME_GHOST_PANEL_BTN =
  "inline-flex items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-4 py-2 text-xs font-semibold text-white/90 transition-all hover:border-cyan-200/80 hover:bg-white/10";

const Tiktok = () => {
  const [list, setList] = useState<TTItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [idx, setIdx] = useState(0);
  const [muted, setMuted] = useState(true);
  const [orientation, setOrientation] = useState<"vertical" | "horizontal">("vertical");
  const [hubScene, setHubScene] = useState<"train" | "ferry">("train");
  const [hubParallaxY, setHubParallaxY] = useState(0);
  const v = list[idx];
  const safeIdx = list.length ? idx : 0;
  const hubSectionRef = useRef<HTMLElement | null>(null);

  // Load TikTok videos synced from the FastAPI/MongoDB connector.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API}/videos?platform=tiktok&channel_title=${encodeURIComponent(TIKTOK_HANDLE)}&strict=true&limit=80`);
        const json = await response.json();
        if (cancelled) return;
        const filtered = (json.videos || [])
          .filter((r: any) => {
            const channel = String(r.channel_title ?? "").trim().toLowerCase();
            const videoUrl = String(r.video_url ?? "").toLowerCase();
            const videoId = String(r.external_id ?? r.id ?? "").trim();
            const title = String(r.title ?? "").trim();
            return channel === TIKTOK_HANDLE.toLowerCase() && videoUrl.includes("/@anime.moments.officiel/video/") && /^\d{12,}$/.test(videoId) && title.length > 0 && !/followers|following|likes/i.test(title);
          })
          .map((r: any) => ({
            id: r.external_id ?? r.id,
            title: r.title ?? "TikTok",
            series: TIKTOK_HANDLE,
            source: "tiktok" as const,
            videoUrl: r.video_url,
            thumb: r.thumbnail_url ?? r.thumbnail,
          }));
        setList(filtered);
        setIdx(0);
      } catch {
        if (!cancelled) setList([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const go = useCallback(
    (dir: 1 | -1) => {
      if (!list.length) return;
      setIdx((i) => (i + dir + list.length) % list.length);
    },
    [list.length]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") go(1);
      else if (e.key === "ArrowUp") go(-1);
      else if (e.key.toLowerCase() === "m") setMuted((m) => !m);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  // Wheel + touch swipe on the player area
  const playerRef = useRef<HTMLDivElement | null>(null);
  const wheelLockRef = useRef(0);
  const touchStartRef = useRef<number | null>(null);
  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 20) return;
      const now = Date.now();
      if (now - wheelLockRef.current < 450) return;
      wheelLockRef.current = now;
      go(e.deltaY > 0 ? 1 : -1);
    };
    const onTouchStart = (e: TouchEvent) => {
      touchStartRef.current = e.touches[0]?.clientY ?? null;
    };
    const onTouchEnd = (e: TouchEvent) => {
      const start = touchStartRef.current;
      if (start == null) return;
      const end = e.changedTouches[0]?.clientY ?? start;
      const dy = start - end;
      if (Math.abs(dy) > 50) go(dy > 0 ? 1 : -1);
      touchStartRef.current = null;
    };
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [go]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const win = window as Window & { tiktokEmbedLoad?: () => void };
    let script = document.querySelector('script[data-tiktok-embed-script="true"]') as HTMLScriptElement | null;
    const triggerEmbedRefresh = () => {
      if (typeof win.tiktokEmbedLoad === "function") {
        win.tiktokEmbedLoad();
      }
    };

    if (!script) {
      script = document.createElement("script");
      script.src = "https://www.tiktok.com/embed.js";
      script.async = true;
      script.setAttribute("data-tiktok-embed-script", "true");
      script.onload = triggerEmbedRefresh;
      document.body.appendChild(script);
    } else if (typeof win.tiktokEmbedLoad === "function") {
      triggerEmbedRefresh();
    } else {
      script.addEventListener("load", triggerEmbedRefresh, { once: true });
    }

    return () => {
      script?.removeEventListener("load", triggerEmbedRefresh);
    };
  }, []);

  // Soft parallax so the pro showcase feels more cinematic while scrolling.
  useEffect(() => {
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      window.requestAnimationFrame(() => {
        ticking = false;
        const section = hubSectionRef.current;
        if (!section) return;
        const rect = section.getBoundingClientRect();
        const viewportH = window.innerHeight || 1;
        const progress = (viewportH - rect.top) / (viewportH + rect.height);
        const centered = (progress - 0.5) * 2;
        const clamped = Math.max(-1, Math.min(1, centered));
        setHubParallaxY(clamped * 18);
      });
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  const hasSyncedVideos = list.length > 0;

  return (
    <PageShell>
      <ManualSyncButton platform="tiktok" label="Sync TikTok" onDone={() => window.location.reload()} />
      <GDriveCinematicBanner
        title="Bannière TikTok — Anime Moments"
        src={TIKTOK_BANNER_VIDEO}
        className="pt-6"
        heightClassName="h-[420px] sm:h-[520px] lg:h-[620px]"
      />
      <section className="container mx-auto px-4 lg:px-8 py-12 text-center" data-testid="tiktok-page-hero">
        <div className="mt-4">
          <a
            href="https://www.tiktok.com/@anime.moments.officiel"
            target="_blank"
            rel="noreferrer"
            className={PRIME_GHOST_BTN}
            data-testid="tiktok-official-link"
          >
            Ouvrir TikTok <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </section>

      <section
        ref={hubSectionRef}
        className="container mx-auto px-4 lg:px-8 pb-8"
        data-testid="tiktok-pro-scene-section"
      >
        <div className="overflow-hidden rounded-[30px] border border-white/15 bg-[linear-gradient(145deg,rgba(10,17,35,0.96),rgba(9,16,30,0.9))] shadow-[0_35px_100px_-50px_rgba(56,189,248,0.5)]">
          <div className="relative z-10 p-6 md:p-8 lg:p-10">
            <div className="mt-1 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setHubScene("train")}
                className={cn(PRIME_GHOST_PANEL_BTN, hubScene === "train" ? "border-cyan-200/80 bg-white/12 text-white" : "")}
                data-testid="tiktok-hub-scene-train"
              >
                <Building2 className="w-3.5 h-3.5" /> Train Station
              </button>
              <button
                type="button"
                onClick={() => setHubScene("ferry")}
                className={cn(PRIME_GHOST_PANEL_BTN, hubScene === "ferry" ? "border-cyan-200/80 bg-white/12 text-white" : "")}
                data-testid="tiktok-hub-scene-ferry"
              >
                <Music2 className="w-3.5 h-3.5" /> Ferry Hub
              </button>
            </div>
          </div>

          <div
            className="relative h-[240px] sm:h-[300px] md:h-[360px] border-t border-white/10 bg-[#0a1322]"
            style={{ transform: `translateY(${hubParallaxY}px)` }}
            data-testid="tiktok-hub-3d-strip"
          >
            {hubScene === "train" ? (
              <Canvas
                dpr={[1, 1.5]}
                camera={{ position: [0, 8, 26], fov: 48 }}
                gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
                style={{ background: "#89b4ce" }}
              >
                <ambientLight intensity={1.15} color="#fff9ec" />
                <directionalLight position={[18, 28, 16]} intensity={1.35} color="#fff0ca" />
                <directionalLight position={[-12, 15, -12]} intensity={0.6} color="#cfe8ff" />

                <group position={[0, -1.2, 0]} scale={[0.72, 0.72, 0.72]}>
                  <TrainStationReplicaWorld
                    isNight={false}
                    isMobile
                    compactScene
                    includeLocalLights={false}
                    onTrainHorn={null}
                  />
                </group>

                <OrbitControls
                  enablePan={false}
                  enableZoom={false}
                  enableRotate={false}
                  autoRotate
                  autoRotateSpeed={0.62}
                  target={[0, 1.5, 6]}
                />
              </Canvas>
            ) : (
              <HubEmbedFrame
                src="/hub/ferry"
                title="Ferry Hub"
                heightClassName="h-[240px] sm:h-[300px] md:h-[360px]"
                testId="tiktok-ferry-hub-embed"
              />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-[#0a1322] to-transparent" />
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 lg:px-8 pb-6" data-testid="tiktok-feed-section">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_380px] items-start">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1.5 rounded-full border border-white/20 bg-transparent text-slate-100 text-xs font-bold flex items-center gap-1.5">
                  <Music2 className="w-3.5 h-3.5" /> TikTok
                </div>
                <div className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground" data-testid="tiktok-feed-mode">
                  {hasSyncedVideos ? `${safeIdx + 1}/${list.length}` : "Widget officiel"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setMuted((m) => !m)}
                  className="px-3 py-2 rounded-full border border-white/20 bg-transparent text-xs font-semibold text-slate-100 hover:border-cyan-200/80 hover:bg-white/10 transition-colors flex items-center gap-1.5"
                  data-testid="tiktok-mute-toggle"
                >
                  {muted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  {muted ? "Son OFF" : "Son ON"}
                </button>
                <div className="inline-flex p-1 rounded-full border border-white/20 bg-transparent">
                  <button
                    onClick={() => setOrientation("vertical")}
                    className={cn("px-3 py-1.5 text-xs rounded-full font-semibold text-white transition-colors", orientation === "vertical" ? "bg-white/12 border border-cyan-200/70" : "text-white/60")}
                    data-testid="tiktok-orientation-vertical"
                  >
                    ▯ Vertical
                  </button>
                  <button
                    onClick={() => setOrientation("horizontal")}
                    className={cn("px-3 py-1.5 text-xs rounded-full font-semibold text-white transition-colors", orientation === "horizontal" ? "bg-white/12 border border-cyan-200/70" : "text-white/60")}
                    data-testid="tiktok-orientation-horizontal"
                  >
                    ▭ Horizontal
                  </button>
                </div>
              </div>
            </div>

            {loading && (
              <div className="text-center text-sm text-muted-foreground py-10" data-testid="tiktok-loading-state">
                Chargement du feed TikTok…
              </div>
            )}

            {!loading && hasSyncedVideos && v && (
              <>
                <div className="relative flex items-center justify-center gap-4">
                  <button
                    onClick={() => go(-1)}
                    className="hidden md:flex w-12 h-12 rounded-full bg-secondary/80 border border-border hover:border-cyan-300/70 items-center justify-center transition-colors"
                    aria-label="Précédent"
                    data-testid="tiktok-nav-prev"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>

                  <div
                    ref={playerRef}
                    className={cn(
                      "tilt-card neon-edge relative rounded-3xl overflow-hidden bg-black border border-cyan-300/40 shadow-[0_40px_120px_-40px_rgba(56,189,248,0.5)]",
                      orientation === "vertical" ? "aspect-[9/16] w-full max-w-sm" : "aspect-video w-full max-w-3xl"
                    )}
                    data-testid="tiktok-video-player-shell"
                  >
                    <iframe
                      key={`tt-${v.id}-${muted}`}
                      src={`https://www.tiktok.com/player/v1/${v.id}?autoplay=1&music_info=1&description=1&rel=0&loop=1&muted=${muted ? 1 : 0}`}
                      title={v.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                      data-testid="tiktok-video-player"
                    />

                    <div className="absolute right-3 bottom-24 flex flex-col gap-3">
                      <button className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform" data-testid="tiktok-like-button">
                        <Heart className="w-5 h-5" />
                      </button>
                      <button className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform" data-testid="tiktok-comment-button">
                        <MessageCircle className="w-5 h-5" />
                      </button>
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-10 h-10 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white hover:scale-110 transition-transform"
                        data-testid="tiktok-share-link"
                      >
                        <Share2 className="w-5 h-5" />
                      </a>
                    </div>

                    <div className="absolute left-3 right-16 bottom-3 text-white">
                      <p className="text-[10px] uppercase tracking-wider text-white/70">{v.series}</p>
                      <h3 className="text-sm font-bold leading-snug line-clamp-3 mt-0.5">{v.title}</h3>
                    </div>
                    <div className="absolute top-3 left-3 z-30">
                      <AdminRemoveVideo
                        source={v.source}
                        externalId={v.id}
                        onRemoved={() => {
                          setList((arr) => arr.filter((it, i) => i !== idx));
                          setIdx((i) => Math.max(0, i - 1));
                        }}
                      />
                    </div>
                  </div>

                  <button
                    onClick={() => go(1)}
                    className="hidden md:flex w-12 h-12 rounded-full bg-secondary/80 border border-border hover:border-cyan-300/70 items-center justify-center transition-colors"
                    aria-label="Suivant"
                    data-testid="tiktok-nav-next"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>

                <div className="md:hidden mt-4 flex items-center justify-center gap-3">
                  <button
                    onClick={() => go(-1)}
                    className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center"
                    data-testid="tiktok-nav-prev-mobile"
                  >
                    <ArrowUp className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => go(1)}
                    className="w-12 h-12 rounded-full bg-secondary border border-border flex items-center justify-center"
                    data-testid="tiktok-nav-next-mobile"
                  >
                    <ArrowDown className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-center text-xs text-muted-foreground mt-4">
                  Swipe haut/bas · clavier ↑/↓ · M pour son
                </p>

                <div className="mt-6" data-testid="tiktok-video-carousel">
                  <div className="flex items-center justify-between mb-2 px-1">
                    <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground" data-testid="tiktok-library-count">
                      Bibliothèque · {list.length} vidéos
                    </h3>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-thin">
                    {list.map((it, i) => (
                      <button
                        key={`${it.source}-${it.id}-${i}`}
                        onClick={() => setIdx(i)}
                        data-testid={`tiktok-thumbnail-${i + 1}`}
                        className={cn(
                          "snap-start shrink-0 w-24 aspect-[9/16] rounded-xl overflow-hidden relative border-2 transition-all",
                          i === idx ? "border-cyan-400 scale-105" : "border-transparent opacity-70 hover:opacity-100"
                        )}
                        aria-label={`Lire ${it.title}`}
                      >
                        {it.thumb ? (
                          <img src={it.thumb} alt={it.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-cyan-500/40 to-indigo-700/40 flex items-center justify-center">
                            <Music2 className="w-6 h-6 text-white/80" />
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-1">
                          <span className="text-[9px] text-white font-semibold">#{i + 1}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="text-center mt-4">
                  <a
                    href={v.videoUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={PRIME_GHOST_BTN}
                    data-testid="tiktok-open-original-link"
                  >
                    Ouvrir l’original <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </>
            )}

            {!loading && !hasSyncedVideos && (
              <div className="rounded-[28px] border border-white/12 bg-white/[0.04] backdrop-blur-xl p-4 md:p-6 shadow-[0_20px_60px_-30px_rgba(56,189,248,0.55)]" data-testid="tiktok-official-profile-widget">
                <blockquote
                  className="tiktok-embed"
                  cite="https://www.tiktok.com/@anime.moments.officiel"
                  data-unique-id="anime.moments.officiel"
                  data-embed-from="oembed"
                  data-embed-type="creator"
                  style={{ maxWidth: "780px", minWidth: "288px", margin: "0 auto" }}
                >
                  <section>
                    <a target="_blank" href="https://www.tiktok.com/@anime.moments.officiel?refer=creator_embed" rel="noreferrer">
                      Profil officiel TikTok
                    </a>
                  </section>
                </blockquote>
              </div>
            )}
          </div>

          <aside className="space-y-4" data-testid="tiktok-side-panel">
            <div className="rounded-[28px] border border-white/12 bg-white/[0.04] backdrop-blur-xl p-5 shadow-[0_20px_60px_-35px_hsl(var(--neon-cyan)/0.5)]">
              <h3 className="font-display text-xl font-bold text-white mb-2">TikTok officiel</h3>
              <a
                href="https://www.tiktok.com/@anime.moments.officiel"
                target="_blank"
                rel="noreferrer"
                className={PRIME_GHOST_BTN}
                data-testid="tiktok-profile-cta"
              >
                Voir le profil officiel <ExternalLink className="w-4 h-4" />
              </a>
            </div>

          </aside>
        </div>
      </section>
    </PageShell>
  );
};

export default Tiktok;