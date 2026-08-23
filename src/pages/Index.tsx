import { useEffect, useState } from "react";
import { Play, ShoppingBag, Youtube, Music2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { PageShell } from "@/components/PageShell";
import MiniCatalogOrb from "@/components/MiniCatalogOrb";
import AnimeMomentsPresentation from "@/components/AnimeMomentsPresentation";
import { buildYouTubeEmbedUrl } from "@/lib/youtubeEmbed";
import crystalCity from "@/assets/crystal-city.jpg.asset.json";


import NeonFooterBar from "@/components/NeonFooterBar";
import MangaNeonBar from "@/components/MangaNeonBar";
import TabletTrailerPlayer from "@/components/TabletTrailerPlayer";

import { Button } from "@/components/ui/button";
import { MiniPreviewPlayer } from "@/components/MiniPreviewPlayer";
import { IMPORTED_VIDEOS } from "@/data/importedVideos";

const ANIME_MOMENTS_TOP_VIDEO = "/home-banner.mp4";

const SHOP_REEL_MP4 =
  "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4";

/** Fisher–Yates shuffle (non-mutating) so trailers play in a non-repeating order. */
const shuffle = <T,>(arr: T[]): T[] => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Live video/poster preview shown inside the two anime home cards. */
const AnimePreview = ({
  trailerIds,
  posters,
  accent,
}: {
  trailerIds: string[];
  posters: string[];
  accent: "magenta" | "cyan";
}) => {
  const [idx, setIdx] = useState(0);
  const [queue, setQueue] = useState<string[]>(() => shuffle(trailerIds));
  const [tIdx, setTIdx] = useState(0);
  useEffect(() => {
    setQueue(shuffle(trailerIds));
    setTIdx(0);
  }, [trailerIds.join("|")]);
  useEffect(() => {
    if (trailerIds.length > 0 || posters.length === 0) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % posters.length), 1800);
    return () => clearInterval(id);
  }, [trailerIds.length, posters.length]);
  useEffect(() => {
    if (queue.length < 2) return;
    const id = setInterval(() => {
      setTIdx((i) => {
        const next = i + 1;
        if (next >= queue.length) {
          let reshuffled = shuffle(queue);
          if (reshuffled[0] === queue[queue.length - 1] && reshuffled.length > 1) {
            [reshuffled[0], reshuffled[1]] = [reshuffled[1], reshuffled[0]];
          }
          setQueue(reshuffled);
          return 0;
        }
        return next;
      });
    }, 14000);
    return () => clearInterval(id);
  }, [queue]);
  const trailerId = queue[tIdx];
  const glow =
    accent === "magenta"
      ? "shadow-[0_0_30px_-5px_hsl(var(--neon-magenta)/0.7)]"
      : "shadow-[0_0_30px_-5px_hsl(var(--neon-cyan)/0.7)]";
  return (
    <div
      className={`relative aspect-video w-full overflow-hidden rounded-xl ring-1 ring-white/10 bg-black ${glow} pointer-events-none`}
      aria-hidden
    >
      {trailerId ? (
        <iframe
          key={trailerId}
          className="absolute inset-0 w-full h-full pointer-events-none"
          src={buildYouTubeEmbedUrl(trailerId, { autoplay: true, muted: true, controls: false, loop: true, playlist: trailerId, playsInline: true })}
          title="Aperçu animé"
          loading="lazy"
          tabIndex={-1}
          allow="autoplay; encrypted-media; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : posters.length > 0 ? (
        <img
          src={posters[idx]}
          alt=""
          className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
        />
      ) : (
        <div className="absolute inset-0 animate-pulse bg-white/5" />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
      <span className="absolute top-2 left-2 text-[9px] uppercase tracking-widest px-1.5 py-0.5 rounded-full bg-black/60 text-white/90 backdrop-blur">
        Live preview
      </span>
    </div>
  );
};

const tags = ["Lovanet", "Manga animé", "YouTube", "TikTok", "Shop", "3D", "Live", "Selection"];
const reactions = [
  { emoji: "🔥", label: "Hot" },
  { emoji: "😂", label: "Fun" },
  { emoji: "😍", label: "Love" },
  { emoji: "⚡", label: "Hype" },
  { emoji: "👀", label: "Watch" },
];

const Index = () => {
  const [ytIds, setYtIds] = useState<string[]>([]);
  const [animeTrailers, setAnimeTrailers] = useState<{ countdown: string[]; catalog: string[] }>({
    countdown: [],
    catalog: [],
  });
  const [animePosters, setAnimePosters] = useState<{ countdown: string[]; catalog: string[] }>({
    countdown: [],
    catalog: [],
  });

  useEffect(() => {
    let cancelled = false;
    try {
      const cached = localStorage.getItem("lovanet.cache.ytIds");
      if (cached) setYtIds(JSON.parse(cached));
    } catch {
      // ignore cache read failure
    }
    (async () => {
      const data = IMPORTED_VIDEOS.filter((v) => v.source === "youtube" && !v.title.toLowerCase().includes("ruri")).sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime()).slice(0, 24);
      if (cancelled || !data) return;
      const ids = data.map((r: any) => r.external_id).filter(Boolean);
      setYtIds(ids);
      try { localStorage.setItem("lovanet.cache.ytIds", JSON.stringify(ids)); } catch {
        // ignore cache write failure
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    try {
      const t = localStorage.getItem("lovanet.cache.animeTrailers");
      const p = localStorage.getItem("lovanet.cache.animePosters");
      if (t) setAnimeTrailers(JSON.parse(t));
      if (p) setAnimePosters(JSON.parse(p));
    } catch {
      // ignore cache read failure
    }
    (async () => {
      try {
        const q = `query {
          trending: Page(page: 1, perPage: 50) {
            media(type: ANIME, sort: TRENDING_DESC, isAdult: false) {
              coverImage { large }
              trailer { id site }
            }
          }
          upcoming: Page(page: 1, perPage: 50) {
            media(type: ANIME, status: RELEASING, sort: POPULARITY_DESC, isAdult: false) {
              coverImage { large }
              trailer { id site }
            }
          }
        }`;
        const res = await fetch("https://graphql.anilist.co", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ query: q }),
        });
        const j = await res.json();
        if (cancelled) return;
        const trending = j?.data?.trending?.media ?? [];
        const upcoming = j?.data?.upcoming?.media ?? [];
        const pickTrailers = (arr: any[]) =>
          Array.from(
            new Set(
              arr
                .filter((m) => m?.trailer?.site === "youtube" && m?.trailer?.id)
                .map((m) => m.trailer.id as string),
            ),
          ).slice(0, 30);
        const nextTrailers = {
          catalog: pickTrailers(trending),
          countdown: pickTrailers(upcoming),
        };
        const nextPosters = {
          catalog: trending.map((m: any) => m?.coverImage?.large).filter(Boolean).slice(0, 30),
          countdown: upcoming.map((m: any) => m?.coverImage?.large).filter(Boolean).slice(0, 30),
        };
        setAnimeTrailers(nextTrailers);
        setAnimePosters(nextPosters);
        try {
          localStorage.setItem("lovanet.cache.animeTrailers", JSON.stringify(nextTrailers));
          localStorage.setItem("lovanet.cache.animePosters", JSON.stringify(nextPosters));
        } catch {
          // ignore cache write failure
        }
      } catch (e) {
        console.error("AniList trailer fetch", e);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const ytForYoutube = ytIds.slice(0, 6);
  const ytForPrime = ytIds.slice(6, 12).length ? ytIds.slice(6, 12) : ytIds.slice(0, 6);

  const platforms = [
    { to: "/chaine-youtube", title: "YouTube", desc: "Vidéos anime et shorts officiels", icon: Youtube,
      preview: { kind: "youtube" as const, sources: ytForYoutube } },
    { to: "/prime-video", title: "Prime Vidéo", desc: "Lecture multi-plateforme premium", icon: Play,
      preview: { kind: "youtube" as const, sources: ytForPrime } },
    { to: "/tiktok", title: "TikTok", desc: "Posts courts et réactions rapides", icon: Music2,
      preview: { kind: "tiktok" as const, sources: [], loadTiktokFromDB: true } },
    { to: "/shop", title: "Shop", desc: "Drops manga liés aux contenus", icon: ShoppingBag,
      preview: { kind: "mp4" as const, sources: [SHOP_REEL_MP4] } },
  ];

  return (
    <PageShell>
      <section className="relative overflow-hidden">
        <h1 className="sr-only">
          Lovanet — Portail anime, manga, gaming et pop culture japonaise
        </h1>
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: "linear-gradient(135deg, hsl(220 30% 8% / 0.55) 0%, hsl(220 25% 12% / 0.65) 50%, hsl(220 30% 8% / 0.55) 100%)",
            backdropFilter: "blur(20px) saturate(1.1)",
            WebkitBackdropFilter: "blur(20px) saturate(1.1)",
          }}
        />
        <div className="absolute inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute bottom-0 left-1/3 w-80 h-80 rounded-full blur-3xl opacity-[0.05] animate-blob animation-delay-4000"
            style={{ background: "radial-gradient(circle, hsl(var(--neon-cyan)), transparent 70%)" }} />
        </div>
        <div className="absolute inset-0 -z-10 pointer-events-none">
          {[...Array(6)].map((_, i) => (
            <span
              key={i}
              className="sparkle absolute w-1 h-1 rounded-full bg-white/40"
              style={{
                left: `${10 + i * 15}%`,
                bottom: "10%",
                animationDelay: `${i * 0.9}s`,
              }}
            />
          ))}
        </div>

        <div className="relative w-full pt-6 lg:pt-8">
          <div className="container mx-auto px-4 lg:px-8 mb-4">
            <div
              className="mx-auto max-w-[854px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black"
              style={{ aspectRatio: "854 / 480" }}
            >
              <video
                src={ANIME_MOMENTS_TOP_VIDEO}
                className="h-full w-full object-cover"
                autoPlay
                muted
                loop
                playsInline
                preload="metadata"
                aria-label="Bannière vidéo Anime Moments"
              />
            </div>
          </div>
          <TabletTrailerPlayer />
          <div className="container mx-auto px-4 lg:px-8 mt-3">
            <MangaNeonBar height={26} className="rounded-full overflow-hidden" />
          </div>
        </div>
      </section>

    </PageShell>
  );
};

export default Index;
