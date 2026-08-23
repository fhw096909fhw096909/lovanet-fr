import { OPEN_QUICKNAV_EVENT } from "@/components/QuickNavCarousel";

const CATALOG_TOP_VIDEO = "/catalogue-banner.mp4";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { buildYouTubeEmbedUrl } from "@/lib/youtubeEmbed";
import NeonFooterBar from "@/components/NeonFooterBar";
import MangaNeonBar from "@/components/MangaNeonBar";
import { Navbar } from "@/components/Navbar";
import BlisterFrame from "@/components/BlisterFrame";
import YouTubeEmbed from "@/components/YouTubeEmbed";
import { TranslationToggleButton } from "@/components/TranslationToggleButton";
import { StarRating } from "@/components/StarRating";
import { AudioLanguageSwitcher } from "@/components/AudioLanguageSwitcher";
import { API_BASE } from "@/lib/apiBase";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CalendarRange,
  Check,
  Clapperboard,
  Compass,
  Heart,
  Info,
  Pause,
  PictureInPicture2,
  Play,
  PlayCircle,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { idbGet, idbSet, normalizeTitle } from "@/lib/animeCache";
import { warmVideoAvailability, getVideoStatusSync, setVideoStatus } from "@/lib/videoAvailability";
import { useFrenchTranslation } from "@/hooks/useFrenchTranslation";
import { useAuth } from "@/contexts/AuthContext";


type Media = {
  id: number;
  title: { romaji?: string; english?: string; native?: string };
  coverImage: { extraLarge?: string; large?: string; color?: string };
  bannerImage?: string;
  averageScore?: number;
  episodes?: number;
  genres?: string[];
  format?: string;
  seasonYear?: number;
  description?: string;
  trailer?: { id?: string; site?: string } | null;
  status?: string;
};

type PlayerMode = "video" | "fallback" | "hidden";

declare global {
  interface Window {
    documentPictureInPicture?: {
      requestWindow: (options?: { width?: number; height?: number }) => Promise<Window>;
      window?: Window | null;
    };
  }
}

const PRIMARY_SITE = "https://lovanet.fr";
const FAVORITES_STORAGE_KEY = "lovanet.catalog.favorites.v2";

function mediaTitle(media: Media | null | undefined) {
  if (!media) return "Catalogue Anime Lovanet";
  return media.title.english || media.title.romaji || media.title.native || `Anime ${media.id}`;
}

function mediaDescription(media: Media | null | undefined) {
  const raw = String(
    media?.description || "Catalogue anime manga avec miniatures, bandes-annonces, synopsis et cartes indexables.",
  );
  return raw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 240);
}

function mediaImage(media: Media | null | undefined) {
  return media?.bannerImage || media?.coverImage?.extraLarge || media?.coverImage?.large || `${PRIMARY_SITE}/lovanet-og.svg`;
}

function hasTrailer(media: Media | null | undefined) {
  return Boolean(media?.trailer?.id && media?.trailer?.site === "youtube");
}

function hasPlayableVideo(media: Media | null | undefined) {
  return Boolean(hasTrailer(media) || mediaTitle(media).trim());
}

// Robustly extract a trailer id from a language bucket which may contain
// either objects ({ id }) or raw id strings.
function extractTrailerId(bucket: any): string | undefined {
  if (Array.isArray(bucket) && bucket.length > 0) {
    const first = bucket[0];
    const id = typeof first === "string" ? first : first?.id;
    if (id) return id as string;
  }
  return undefined;
}

// Accurate, French-first labels for the trailer version selector.
const CATALOG_VERSION_LABELS: Record<string, string> = {
  vostfr: "🇫🇷 VOSTFR (VO + s-t FR)",
  vf: "🇫🇷 Français (VF · doublage)",
  vo: "🇯🇵 VO (Japonais)",
  ensub: "🇬🇧 English (VO + subs)",
  endub: "🇬🇧 English Dub",
};

const TRANSLATION_LANGUAGE_OPTIONS = [
  { code: "fr", label: "Français" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
  { code: "it", label: "Italiano" },
  { code: "pt", label: "Português" },
  { code: "nl", label: "Nederlands" },
  { code: "pl", label: "Polski" },
  { code: "ro", label: "Română" },
  { code: "tr", label: "Türkçe" },
  { code: "ar", label: "العربية" },
  { code: "hi", label: "हिन्दी" },
  { code: "id", label: "Bahasa Indonesia" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ru", label: "Русский" },
  { code: "uk", label: "Українська" },
  { code: "sv", label: "Svenska" },
  { code: "vi", label: "Tiếng Việt" },
];


function normalizeStatus(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  const s = String(raw).toLowerCase();
  if (s.includes("finish")) return "finished";
  if (s.includes("releasing") || s.includes("airing") || s === "current") return "releasing";
  if (s.includes("not_yet") || s.includes("not yet") || s === "upcoming" || s === "tba" || s === "unreleased") return "upcoming";
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("hiatus")) return "hiatus";
  return undefined;
}

const QUERY_SORTED = `
query ($page: Int, $perPage: Int, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    media(type: ANIME, sort: $sort, isAdult: false) {
      id
      title { romaji english native }
      coverImage { extraLarge large color }
      bannerImage
      averageScore
      episodes
      genres
      format
      seasonYear
      status
      description(asHtml: false)
      trailer { id site }
    }
  }
}`;

const QUERY_MEDIA_BY_ID = `
query ($id: Int) {
  Media(id: $id, type: ANIME, isAdult: false) {
    id
    title { romaji english native }
    coverImage { extraLarge large color }
    bannerImage
    averageScore
    episodes
    genres
    format
    seasonYear
    status
    description(asHtml: false)
    trailer { id site }
  }
}`;

import { Canvas } from "@react-three/fiber";
import { Carousel3D } from "@/components/Carousel3D";
import { OrbitControls } from "@react-three/drei";

import { ErrorBoundary } from "react-error-boundary";
export default function AnimeCatalog() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<Media[]>([]);
  const [gridItems, setGridItems] = useState<Media[]>([]);
  const [gridLoading, setGridLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [activePlayerId, setActivePlayerId] = useState<number | null>(null);
  const [detailMedia, setDetailMedia] = useState<Media | null>(null);
  const [detailTrailers, setDetailTrailers] = useState<Record<string, any[]>>({});
  const [activeTrailerLang, setActiveTrailerLang] = useState<string>("vostfr");
  const [catalogCandidateIndex, setCatalogCandidateIndex] = useState(0);
  const [playerMode, setPlayerMode] = useState<PlayerMode>("video");
    const { favorites: favoriteIds, toggleFavorite: authToggleFavorite, ratings, rateAnime } = useAuth();
  const toggleFavorite = (media: Media) => { authToggleFavorite(media.id); };
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const [pipOpen, setPipOpen] = useState(false);
  const [availabilityReady, setAvailabilityReady] = useState(false);
  const [filterGenre, setFilterGenre] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"grid" | "carousel">("grid");
  const [minScore, setMinScore] = useState<string>("0");
  const [minYear, setMinYear] = useState<string>("0");
  const [sortBy, setSortBy] = useState<"default" | "newest" | "score" | "alpha">("default");
  const [search, setSearch] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [translationLang, setTranslationLang] = useState<string>("fr");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [topCardCount, setTopCardCount] = useState(8);
  useEffect(() => {
    const counts = [4, 8, 16, 8];
    let idx = 0;
    const interval = setInterval(() => {
      idx = (idx + 1) % counts.length;
      setTopCardCount(counts[idx]);
    }, 6000);
    return () => clearInterval(interval);
  }, []);
    const [showVideoPrompt, setShowVideoPrompt] = useState(true);
  const [recommendations, setRecommendations] = useState<Media[]>([]);
  const PAGE_SIZE = 48;
  const [renderCount, setRenderCount] = useState<number>(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const playerInstanceRef = useRef<any>(null);
  const pipWindowRef = useRef<Window | null>(null);
  const suggestionPreparedRef = useRef(false);

  useEffect(() => {
    warmVideoAvailability().finally(() => setAvailabilityReady(true));
  }, []);

  

  

  const fetchData = async () => {
    try {
      const res = await fetch("https://graphql.anilist.co", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ query: QUERY_SORTED, variables: { page: 1, perPage: 30, sort: ["TRENDING_DESC"] } }),
      });
      const json = await res.json();
      const list = json?.data?.Page?.media ?? [];
      if (list.length) {
        const normalized = list.map((m: Media) => ({ ...m, status: normalizeStatus(m.status) }));
        setItems(normalized);
        try {
          localStorage.setItem("lovanet.cache.catalog.top", JSON.stringify(normalized));
        } catch {
          // ignore
        }
        idbSet("catalog.top", normalized);
      }
    } catch (e) {
      console.error("AniList fetch error", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchGrid = async () => {
    setGridLoading(true);
    try {
      const dedup = new Map<number, Media>();
      const titleIndex = new Map<string, number>();
      const tryInsert = (m: Media): boolean => {
        if (dedup.has(m.id)) return false;
        const key = normalizeTitle(m.title.english) || normalizeTitle(m.title.romaji) || normalizeTitle(m.title.native);
        if (key && titleIndex.has(key)) return false;
        dedup.set(m.id, m);
        if (key) titleIndex.set(key, m.id);
        return true;
      };
      const flush = () => setGridItems(Array.from(dedup.values()));
      const sorts: string[][] = [["TRENDING_DESC"], ["POPULARITY_DESC"], ["SCORE_DESC"], ["START_DATE_DESC"]];

      for (const sort of sorts) {
        const pages = Array.from({ length: 100 }, (_, i) => i + 1);
        for (let i = 0; i < pages.length; i += 2) {
          const batch = pages.slice(i, i + 2);
          const results = await Promise.all(
            batch.map((p) =>
              fetch("https://graphql.anilist.co", {
                method: "POST",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ query: QUERY_SORTED, variables: { page: p, perPage: 50, sort } }),
              })
                .then((r) => r.json())
                .catch(() => null),
            ),
          );
          let stop = false;
          for (const j of results) {
            const list = j?.data?.Page?.media ?? [];
            if (!list.length) stop = true;
            for (const m of list) {
              tryInsert({ ...m, status: normalizeStatus(m.status) });
            }
          }
          flush();
          if (stop) break;
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
      }

      try {
        for (let p = 1; p <= 40; p++) {
          const r = await fetch(`https://api.jikan.moe/v4/top/anime?page=${p}`).catch(() => null);
          if (!r || !r.ok) break;
          const j = await r.json().catch(() => null);
          const data = j?.data ?? [];
          if (!data.length) break;
          for (const a of data) {
            const pseudoId = 1_000_000_000 + (a.mal_id ?? 0);
            const media: Media = {
              id: pseudoId,
              title: {
                romaji: a.title,
                english: a.title_english ?? undefined,
                native: a.title_japanese ?? undefined,
              },
              coverImage: {
                extraLarge: a.images?.jpg?.large_image_url,
                large: a.images?.jpg?.large_image_url,
                color: undefined,
              },
              averageScore: a.score ? Math.round(a.score * 10) : undefined,
              episodes: a.episodes ?? undefined,
              genres: (a.genres ?? []).map((g: any) => g.name),
              format: a.type,
              seasonYear: a.aired?.prop?.from?.year ?? a.year ?? undefined,
              description: a.synopsis ?? undefined,
              status: normalizeStatus(a.status),
              trailer: a.trailer?.youtube_id ? { id: a.trailer.youtube_id, site: "youtube" } : null,
            };
            tryInsert(media);
          }
          flush();
          await new Promise((resolve) => setTimeout(resolve, 400));
        }
      } catch (e) {
        console.error("Jikan enrichment error", e);
      }

      try {
        const pageSize = 20;
        for (let offset = 0; offset < 8000; offset += pageSize) {
          const url = `https://kitsu.io/api/edge/anime?page[limit]=${pageSize}&page[offset]=${offset}&sort=-userCount`;
          const r = await fetch(url, { headers: { Accept: "application/vnd.api+json" } }).catch(() => null);
          if (!r || !r.ok) break;
          const j = await r.json().catch(() => null);
          const data = j?.data ?? [];
          if (!data.length) break;
          for (const a of data) {
            const attr = a.attributes ?? {};
            const pseudoId = 2_000_000_000 + Number(a.id ?? 0);
            const media: Media = {
              id: pseudoId,
              title: {
                romaji: attr.titles?.en_jp || attr.canonicalTitle,
                english: attr.titles?.en || attr.canonicalTitle,
                native: attr.titles?.ja_jp || undefined,
              },
              coverImage: {
                extraLarge: attr.posterImage?.large || attr.posterImage?.medium,
                large: attr.posterImage?.medium || attr.posterImage?.small,
                color: undefined,
              },
              averageScore: attr.averageRating ? Math.round(Number(attr.averageRating)) : undefined,
              episodes: attr.episodeCount ?? undefined,
              genres: [],
              format: attr.subtype,
              seasonYear: attr.startDate ? Number(String(attr.startDate).slice(0, 4)) : undefined,
              description: attr.synopsis ?? undefined,
              status: normalizeStatus(attr.status),
              trailer: attr.youtubeVideoId ? { id: attr.youtubeVideoId, site: "youtube" } : null,
            };
            tryInsert(media);
          }
          if ((offset / pageSize) % 5 === 0) flush();
          await new Promise((resolve) => setTimeout(resolve, 150));
        }
        flush();
      } catch (e) {
        console.error("Kitsu enrichment error", e);
      }

      idbSet("catalog.grid", Array.from(dedup.values()));
    } catch (e) {
      console.error("AniList grid fetch error", e);
    } finally {
      setGridLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [topIdb, gridIdb] = await Promise.all([idbGet<Media[]>("catalog.top"), idbGet<Media[]>("catalog.grid")]);
        if (topIdb?.length) {
          setItems(topIdb);
          setLoading(false);
        }
        if (gridIdb?.length) {
          setGridItems(gridIdb);
          setGridLoading(false);
        }
      } catch {
        // ignore cache hydration failures
      }
      try {
        const top = localStorage.getItem("lovanet.cache.catalog.top");
        if (top) {
          setItems(JSON.parse(top));
          setLoading(false);
        }
      } catch {
        // ignore
      }
    })();

    fetchData();
    fetchGrid();
    const id = setInterval(fetchData, 1000 * 60 * 5);
    const gridId = setInterval(fetchGrid, 1000 * 60 * 15);
    const onFocus = () => fetchData();
    const onVisibility = () => {
      if (document.visibilityState === "visible") fetchData();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      clearInterval(id);
      clearInterval(gridId);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 180);
    return () => clearTimeout(id);
  }, [search]);

  const allMedia = useMemo(() => {
    const merged = [...items, ...gridItems];
    const map = new Map<number, Media>();
    for (const media of merged) {
      if (!map.has(media.id)) map.set(media.id, media);
    }
    return Array.from(map.values());
  }, [items, gridItems]);

  useEffect(() => {
    const fetchRecommendations = async () => {
      if (Object.keys(ratings).length === 0) {
        setRecommendations([]);
        return;
      }
      try {
        const API = (import.meta.env.VITE_BACKEND_URL ?? "") + "/api";
        const res = await fetch(`${API}/ratings/recommendations`, { credentials: "include" });
        if (!res.ok) {
          setRecommendations([]);
          return;
        }
        const data = await res.json();
        const recIds = (data.recommendations || []).map((r: any) => r.id);
        const recMedia = allMedia.filter((m) => recIds.includes(m.id));
        setRecommendations(recMedia);
      } catch (e) {
        console.error("Failed to fetch recommendations", e);
        setRecommendations([]);
      }
    };
    fetchRecommendations();
  }, [ratings, allMedia]);

  useEffect(() => {
    if (!detailMedia) {
      setDetailTrailers({});
      setActiveTrailerLang("vostfr");
      return;
    }
    
    const fetchMultilingualTrailers = async () => {
      try {
        const title = mediaTitle(detailMedia);
        const res = await fetch(`${API_BASE}/prime/multilingual-trailers?q=${encodeURIComponent(title)}`);
        if (!res.ok) {
          setDetailTrailers({});
          return;
        }
        const data = await res.json();
        if (data.results && Object.keys(data.results).length > 0) {
          setDetailTrailers(data.results);
          // Auto-select first available language, prefer 'ja' if available
          if (data.results['ja'] && data.results['ja'].length > 0) {
            setActiveTrailerLang('ja');
          } else if (data.results['fr'] && data.results['fr'].length > 0) {
            setActiveTrailerLang('fr');
          } else {
            setActiveTrailerLang(Object.keys(data.results)[0]);
          }
        } else {
          setDetailTrailers({});
        }
      } catch (e) {
        console.error("Failed to fetch multilingual trailers", e);
        setDetailTrailers({});
      }
    };
    
    fetchMultilingualTrailers();
  }, [detailMedia]);


  const allGenres = useMemo(() => {
    const set = new Set<string>();
    for (const media of gridItems) (media.genres ?? []).forEach((genre) => set.add(genre));
    return Array.from(set).sort();
  }, [gridItems]);

  const featuredRail = useMemo(() => items.filter((media) => hasPlayableVideo(media)).slice(0, 8), [items]);

  const filteredSorted = useMemo(() => {
    const q = normalizeTitle(debouncedSearch);
    let list = gridItems.filter((media) => {
      if (filterGenre !== "all" && !(media.genres ?? []).includes(filterGenre)) return false;
      if (Number(minScore) > 0 && (media.averageScore ?? 0) < Number(minScore)) return false;
      if (Number(minYear) > 0 && (media.seasonYear ?? 0) < Number(minYear)) return false;
      if (filterStatus !== "all" && media.status !== filterStatus) return false;
      if (q) {
        const haystack = `${normalizeTitle(media.title.english)}|${normalizeTitle(media.title.romaji)}|${normalizeTitle(media.title.native)}`;
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    if (sortBy === "newest") {
      list = [...list].sort((a, b) => (b.seasonYear ?? 0) - (a.seasonYear ?? 0));
    } else if (sortBy === "score") {
      list = [...list].sort((a, b) => (b.averageScore ?? 0) - (a.averageScore ?? 0));
    } else if (sortBy === "alpha") {
      list = [...list].sort((a, b) => {
        const ta = (a.title.english || a.title.romaji || "").toLowerCase();
        const tb = (b.title.english || b.title.romaji || "").toLowerCase();
        return ta.localeCompare(tb);
      });
    }

    return list;
  }, [debouncedSearch, filterGenre, filterStatus, gridItems, minScore, minYear, sortBy]);

  // Historique des titres déjà suggérés/joués : la sélection ne doit jamais
  // reproposer les mêmes favoris tant que le catalogue en propose d'autres.
  const suggestedHistoryRef = useRef<Set<number>>(new Set());
  const playedQueueRef = useRef<Set<number>>(new Set());

  const videoSuggestionItems = useMemo(() => {
    const playable = filteredSorted.filter((media) => hasPlayableVideo(media));
    const seen = new Set<number>();
    const unique = playable.filter((media) => {
      if (seen.has(media.id)) return false;
      seen.add(media.id);
      return true;
    });
    const fresh = unique.filter(
      (media) => !favoriteIds.includes(media.id) && !suggestedHistoryRef.current.has(media.id),
    );
    const pool = fresh.length ? fresh : unique.filter((media) => !favoriteIds.includes(media.id));
    return (pool.length ? pool : unique).slice(0, 10);
  }, [favoriteIds, filteredSorted]);
  const promptPreviewItems = useMemo(() => {
    const source = videoSuggestionItems.length ? videoSuggestionItems : allMedia.filter((media) => hasPlayableVideo(media));
    return source.slice(0, 10);
  }, [allMedia, videoSuggestionItems]);
  const seoAnimeId = searchParams.get("anime");
  const forcedTrailerId = searchParams.get("trailer") || undefined;
  const wantsAutoplay = searchParams.get("autoplay") === "1";

  // REGLE VERROUILLEE — Deep link depuis la page portail :
  // chaque carte trailer pousse SA propre vidéo (?anime=..&trailer=..).
  // Le trailer demandé est prioritaire absolu tant que le visiteur n'a pas
  // changé de version/de titre manuellement.
  const [deepLinkTrailerId, setDeepLinkTrailerId] = useState<string | undefined>(forcedTrailerId);
  const deepLinkRef = useRef<string | undefined>(forcedTrailerId);
  useEffect(() => {
    setDeepLinkTrailerId(forcedTrailerId);
    deepLinkRef.current = forcedTrailerId;
  }, [forcedTrailerId, seoAnimeId]);
  const releaseDeepLink = () => {
    deepLinkRef.current = undefined;
    setDeepLinkTrailerId(undefined);
  };

  useEffect(() => {
    if (!seoAnimeId || !forcedTrailerId) return;
    const animeId = Number(seoAnimeId);
    if (!Number.isFinite(animeId)) return;

    const controller = new AbortController();
    fetch("https://graphql.anilist.co", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ query: QUERY_MEDIA_BY_ID, variables: { id: animeId } }),
      signal: controller.signal,
    })
      .then((response) => response.json())
      .then((json) => {
        const requested = json?.data?.Media as Media | undefined;
        if (!requested) return;
        const normalized = { ...requested, status: normalizeStatus(requested.status) };
        setItems((current) => current.some((media) => media.id === normalized.id) ? current : [normalized, ...current]);
        setActivePlayerId(normalized.id);
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        console.error("Selected anime fetch error", error);
      });

    return () => controller.abort();
  }, [forcedTrailerId, seoAnimeId]);

  const selectedSeoMedia = useMemo(() => {
    if (!seoAnimeId) return null;
    const animeId = Number(seoAnimeId);
    return allMedia.find((media) => media.id === animeId) ?? null;
  }, [allMedia, seoAnimeId]);

  const favoriteItems = useMemo(() => {
    const map = new Map(allMedia.map((media) => [media.id, media]));
    return favoriteIds.map((id) => map.get(id)).filter(Boolean) as Media[];
  }, [allMedia, favoriteIds]);

  const playerQueue = useMemo(() => {
    const seen = new Set<number>();
    return favoriteItems.filter((media) => {
      if (!hasTrailer(media) || seen.has(media.id)) return false;
      seen.add(media.id);
      return true;
    });
  }, [favoriteItems]);

  const activePlayer = useMemo(() => {
    if (activePlayerId == null) return null;
    return allMedia.find((media) => media.id === activePlayerId) ?? null;
  }, [activePlayerId, allMedia]);

  // Versions that resolve to a real video id, French-first order:
  // VOSTFR, VF, VO, English sub, English dub. The VO can fall back to the
  // title's own AniList trailer. The backend classifies each video accurately,
  // so the French option is never an English-subbed trailer.
  const CATALOG_VERSION_ORDER = ["vostfr", "vf", "vo", "ensub", "endub"];
  const availableCatalogLangs = useMemo<string[]>(() => {
    const langs: string[] = [];
    for (const code of CATALOG_VERSION_ORDER) {
      if (extractTrailerId(detailTrailers[code])) langs.push(code);
    }
    if (!langs.includes("vo") && activePlayer?.trailer?.id) langs.push("vo");
    return langs.length ? langs : ["vo"];
  }, [detailTrailers, activePlayer]);

  // Concrete trailer id for the currently selected language: a real per-language
  // trailer when available, otherwise the title's own trailer so a real video
  // always plays (YouTube's iframe search feature is deprecated).
  const extractTrailerIds = (bucket: any): string[] => {
    if (!Array.isArray(bucket)) return [];
    return bucket.map((x: any) => (typeof x === "string" ? x : x?.id)).filter(Boolean);
  };

  const catalogTrailerCandidates = useMemo<string[]>(() => {
    const ids = extractTrailerIds(detailTrailers[activeTrailerLang]);
    if (activeTrailerLang === "vo" && activePlayer?.trailer?.id && !ids.includes(activePlayer.trailer.id)) {
      ids.push(activePlayer.trailer.id);
    }
    return ids;
  }, [detailTrailers, activeTrailerLang, activePlayer]);

  const getCatalogTrailerCandidatesForLang = (lang: string): string[] => {
    const ids = extractTrailerIds(detailTrailers[lang]);
    if (lang === "vo" && activePlayer?.trailer?.id && !ids.includes(activePlayer.trailer.id)) {
      ids.push(activePlayer.trailer.id);
    }
    return ids;
  };

  const catalogActiveTrailerId = useMemo<string | undefined>(() => {
    // Deep link: the requested trailer always wins until the user picks another
    // version/candidate manually.
    if (deepLinkTrailerId) return deepLinkTrailerId;
    if (catalogTrailerCandidates.length === 0) return activePlayer?.trailer?.id;
    return catalogTrailerCandidates[Math.min(catalogCandidateIndex, catalogTrailerCandidates.length - 1)];
  }, [catalogTrailerCandidates, catalogCandidateIndex, activePlayer, deepLinkTrailerId]);

  const catalogTrailerSources = useMemo<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    for (const code of Object.keys(detailTrailers || {})) {
      const arr: any = detailTrailers[code];
      const first = Array.isArray(arr) ? arr[0] : null;
      if (first && typeof first !== "string" && first.source) out[code] = first.source;
    }
    if (!out.vo && activePlayer?.trailer?.id) out.vo = "Bande-annonce officielle";
    return out;
  }, [detailTrailers, activePlayer]);

  const handleCatalogTrailerUnavailable = () => {
    // Le trailer du deep link est indisponible : on relâche le verrou et on
    // repart sur les candidats du titre.
    if (deepLinkRef.current) {
      releaseDeepLink();
      setCatalogCandidateIndex(0);
      setPlayerMode("video");
      return;
    }
    if (catalogCandidateIndex + 1 < catalogTrailerCandidates.length) {
      setCatalogCandidateIndex(catalogCandidateIndex + 1);
      return;
    }

    const currentLangIndex = Math.max(availableCatalogLangs.indexOf(activeTrailerLang), 0);
    for (let step = 1; step < availableCatalogLangs.length; step += 1) {
      const nextLang = availableCatalogLangs[(currentLangIndex + step) % availableCatalogLangs.length];
      const nextCandidates = getCatalogTrailerCandidatesForLang(nextLang);
      if (nextCandidates.length > 0) {
        setActiveTrailerLang(nextLang);
        setCatalogCandidateIndex(0);
        setPlayerMode("video");
        return;
      }
    }

    const sequence = playerQueue.length ? playerQueue : filteredSorted;
    if (activePlayer && sequence.length > 1) {
      const currentIndex = sequence.findIndex((media) => media.id === activePlayer.id);
      const nextIndex = currentIndex === -1 || currentIndex === sequence.length - 1 ? 0 : currentIndex + 1;
      const nextMedia = sequence[nextIndex];
      if (nextMedia && nextMedia.id !== activePlayer.id) {
        setPlayerMode("video");
        activatePlayer(nextMedia, { unlockSound: soundUnlocked });
        return;
      }
    }

    if (activePlayer?.id != null) setVideoStatus(activePlayer.id, "unavailable");
    setPlayerMode("fallback");
  };

  // Reset the candidate cursor when the language or the active title changes.
  useEffect(() => {
    setCatalogCandidateIndex(0);
  }, [activeTrailerLang, activePlayerId]);

  // Keep the selected language valid for the available versions.
  useEffect(() => {
    if (!availableCatalogLangs.includes(activeTrailerLang)) {
      setActiveTrailerLang(availableCatalogLangs[0]);
    }
  }, [availableCatalogLangs, activeTrailerLang]);

  const pagedItems = useMemo(() => filteredSorted.slice(0, renderCount), [filteredSorted, renderCount]);

  const translationTexts = useMemo(() => {
    const source = [
      ...pagedItems.slice(0, 24),
      ...featuredRail.slice(0, 6),
      ...favoriteItems.slice(0, 8),
      ...promptPreviewItems.slice(0, 6),
      ...(activePlayer ? [activePlayer] : []),
      ...(detailMedia ? [detailMedia] : []),
      ...(selectedSeoMedia ? [selectedSeoMedia] : []),
    ];
    return source.flatMap((media) => [mediaTitle(media), mediaDescription(media)]);
  }, [activePlayer, detailMedia, favoriteItems, featuredRail, pagedItems, promptPreviewItems, selectedSeoMedia]);

  const {
    enabled: showTranslatedCards,
    setEnabled: setShowTranslatedCards,
    loading: translationsLoading,
    getText: getTranslatedText,
    translateNow: translateCatalogNow,
  } = useFrenchTranslation(translationTexts, {
    auto: true,
    storageKey: `lovanet.catalog.translation.auto.${translationLang}.v1`,
    targetLang: translationLang,
  });

  const translationLangLabel =
    TRANSLATION_LANGUAGE_OPTIONS.find((option) => option.code === translationLang)?.label || translationLang.toUpperCase();

  const translatedMediaTitle = (media: Media | null | undefined) => getTranslatedText(mediaTitle(media));
  const translatedMediaDescription = (media: Media | null | undefined) => getTranslatedText(mediaDescription(media));

  const syncSearchParam = (media: Media | null, options?: { force?: boolean }) => {
    // Ne jamais écraser le deep link (?anime=..&trailer=..) automatiquement :
    // sinon la carte cliquée perd sa vidéo au profit d'une suggestion.
    if (deepLinkRef.current && !options?.force) return;
    const next = new URLSearchParams(searchParams);
    if (media) next.set("anime", String(media.id));
    else next.delete("anime");
    if (options?.force) next.delete("trailer");
    setSearchParams(next, { replace: true });
  };

  const unlockSound = () => {
    setSoundUnlocked(true);
    if (!playerInstanceRef.current) return;
    try {
      playerInstanceRef.current.unMute?.();
      playerInstanceRef.current.playVideo?.();
      setIsMuted(false);
      setIsPlaying(true);
    } catch {
      // ignore player sound unlock failures
    }
  };

  const activatePlayer = async (media: Media, options?: { forceFavorite?: boolean; unlockSound?: boolean }) => {
    if (options?.forceFavorite) {
      if (!favoriteIds.includes(media.id)) {
        authToggleFavorite(media.id);
      }
    }
    if (options?.unlockSound) {
      setSoundUnlocked(true);
    }
    setActivePlayerId(media.id);
    releaseDeepLink();
    syncSearchParam(media, { force: true });
    
    // Fetch multilingual trailers for giant player
    const q = mediaTitle(media);
    try {
      const res = await fetch(`${API_BASE}/prime/multilingual-trailers?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        const trs = data.results || {};
        setDetailTrailers(trs); // we reuse detailTrailers state for the giant player's languages
        
        // Pick a French-first version for the giant player.
        const order = ["vostfr", "vf", "vo", "ensub", "endub"];
        const firstAvailable = order.find((code) => Array.isArray(trs[code]) && trs[code].length > 0);
        setActiveTrailerLang(firstAvailable || Object.keys(trs)[0] || "vo");
      }
    } catch (e) {
      console.error("Failed to fetch multilingual trailers for active player", e);
    }
  };

  // toggleFavorite is now defined at line 137 using authToggleFavorite from useAuth context
  // Removed duplicate declaration to fix compilation error

  // Sélectionne le prochain favori jamais joué durant ce cycle ; quand tous
  // ont été vus, le cycle repart proprement à zéro (pas de doublon consécutif).
  const pickNextUnplayed = (currentId: number | null): Media | null => {
    if (!playerQueue.length) return null;
    const currentIndex = playerQueue.findIndex((media) => media.id === currentId);
    const ordered = playerQueue
      .slice(currentIndex + 1)
      .concat(playerQueue.slice(0, Math.max(currentIndex, 0)));
    const candidates = ordered.length ? ordered : playerQueue;
    const next = candidates.find(
      (media) => media.id !== currentId && !playedQueueRef.current.has(media.id),
    );
    if (next) return next;
    playedQueueRef.current = new Set(currentId != null ? [currentId] : []);
    return candidates.find((media) => media.id !== currentId) ?? candidates[0] ?? null;
  };

  const goToQueueItem = (media: Media | null) => {
    if (!media) return;
    playedQueueRef.current.add(media.id);
    suggestedHistoryRef.current.add(media.id);
    activatePlayer(media, { unlockSound: true });
  };

  const handlePrevious = () => {
    unlockSound();
    if (!playerQueue.length) return;
    const currentIndex = playerQueue.findIndex((media) => media.id === activePlayerId);
    const nextIndex = currentIndex <= 0 ? playerQueue.length - 1 : currentIndex - 1;
    goToQueueItem(playerQueue[nextIndex]);
  };

  const handleNext = () => {
    unlockSound();
    if (!playerQueue.length) return;
    goToQueueItem(pickNextUnplayed(activePlayerId));
  };

  const togglePlayback = () => {
    if (!playerInstanceRef.current || !activePlayer || !hasTrailer(activePlayer)) return;
    unlockSound();
    try {
      const state = playerInstanceRef.current.getPlayerState?.();
      if (state === 1) {
        playerInstanceRef.current.pauseVideo?.();
        setIsPlaying(false);
      } else {
        playerInstanceRef.current.playVideo?.();
        setIsPlaying(true);
      }
    } catch {
      // ignore YouTube control failures
    }
  };

  const toggleMute = () => {
    if (!playerInstanceRef.current || !activePlayer || !hasTrailer(activePlayer)) return;
    if (!soundUnlocked) {
      unlockSound();
      return;
    }
    try {
      const muted = playerInstanceRef.current.isMuted?.();
      if (muted) {
        playerInstanceRef.current.unMute?.();
        setIsMuted(false);
      } else {
        playerInstanceRef.current.mute?.();
        setIsMuted(true);
      }
    } catch {
      // ignore YouTube control failures
    }
  };

  const addSuggestedSelectionToFavorites = () => {
    const ids = videoSuggestionItems.map((media) => media.id);
    // Add each ID to favorites if not already present
    ids.forEach(id => {
      suggestedHistoryRef.current.add(id);
      if (!favoriteIds.includes(id)) {
        authToggleFavorite(id);
      }
    });
    if (!activePlayer && videoSuggestionItems[0]) {
      activatePlayer(videoSuggestionItems[0]);
    }
    setShowVideoPrompt(false);
  };

  const playSuggestedSelectionNow = () => {
    if (!videoSuggestionItems[0]) return;
    addSuggestedSelectionToFavorites();
    activatePlayer(videoSuggestionItems[0], { forceFavorite: true, unlockSound: true });
    setShowVideoPrompt(false);
  };

  const openMiniPlayer = async () => {
    if (!activePlayer) return;
    const trailerUrl = hasTrailer(activePlayer)
      ? buildYouTubeEmbedUrl(activePlayer.trailer?.id || "", { autoplay: true, muted: !soundUnlocked, controls: false, playsInline: true })
      : null;

    try {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        pipWindowRef.current.close();
        pipWindowRef.current = null;
        setPipOpen(false);
        return;
      }

      if (window.documentPictureInPicture?.requestWindow) {
        const pipWindow = await window.documentPictureInPicture.requestWindow({ width: 430, height: 260 });
        pipWindowRef.current = pipWindow;
        pipWindow.document.head.innerHTML = `<style>
          body{margin:0;background:#050b16;color:#f7faff;font-family:Inter,Arial,sans-serif;display:flex;height:100vh;}
          .pip-shell{position:relative;display:flex;flex-direction:column;width:100%;height:100%;background:radial-gradient(circle at top right, rgba(244,114,182,.16), transparent 30%), radial-gradient(circle at left bottom, rgba(56,189,248,.16), transparent 32%), #050b16;}
          .pip-media{flex:1;display:flex;align-items:center;justify-content:center;background:#000;overflow:hidden;}
          iframe,img{width:100%;height:100%;border:0;object-fit:cover;}
          .pip-meta{padding:10px 12px;border-top:1px solid rgba(255,255,255,.08);background:rgba(10,14,24,.82);}
          .pip-title{font-size:13px;font-weight:700;margin:0 0 4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
          .pip-sub{font-size:11px;opacity:.72;margin:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
        </style>`;
        pipWindow.document.body.innerHTML = "";
        const shell = pipWindow.document.createElement("div");
        shell.className = "pip-shell";
        shell.innerHTML = `
          <div class="pip-media">
            ${trailerUrl ? `<iframe src="${trailerUrl}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen title="${mediaTitle(activePlayer)}"></iframe>` : `<img src="${mediaImage(activePlayer)}" alt="${mediaTitle(activePlayer)}" />`}
          </div>
          <div class="pip-meta">
            <p class="pip-title">${mediaTitle(activePlayer)}</p>
            <p class="pip-sub">${activePlayer.format || "Anime"} · ${activePlayer.seasonYear || "Catalogue Lovanet"}</p>
          </div>
        `;
        pipWindow.document.body.appendChild(shell);
        setPipOpen(true);
        pipWindow.addEventListener(
          "pagehide",
          () => {
            pipWindowRef.current = null;
            setPipOpen(false);
          },
          { once: true },
        );
        return;
      }

      if (trailerUrl) {
        window.open(trailerUrl, "_blank", "noopener,noreferrer,width=430,height=260");
        setPipOpen(true);
      }
    } catch (error) {
      console.error("PiP error", error);
    }
  };

  useEffect(() => {
    if (!allMedia.length) return;
    if (selectedSeoMedia && activePlayerId !== selectedSeoMedia.id) {
      setActivePlayerId(selectedSeoMedia.id);
      return;
    }
    if (activePlayerId == null && favoriteIds.length) {
      const nextFavorite = favoriteIds.find((id) => allMedia.some((media) => media.id === id));
      if (typeof nextFavorite === "number") {
        setActivePlayerId(nextFavorite);
      }
    }
  }, [activePlayerId, allMedia, favoriteIds, selectedSeoMedia]);

  // Deep link from the portal trailer strip: /anime-catalog?anime=..&trailer=..&autoplay=1
  useEffect(() => {
    if (!wantsAutoplay) return;
    setSoundUnlocked(true);
    setPlayerMode("video");
    const id = window.setTimeout(() => {
      document
        .querySelector('[data-testid="catalog-giant-player-shell"]')
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 250);
    return () => window.clearTimeout(id);
  }, [activePlayer?.id, forcedTrailerId, wantsAutoplay]);

  useEffect(() => {
    if (activePlayerId == null) return;
    const stillExists = allMedia.some((media) => media.id === activePlayerId);
    if (!stillExists) {
      if (seoAnimeId && forcedTrailerId && activePlayerId === Number(seoAnimeId)) return;
      const nextId = favoriteIds[0] ?? videoSuggestionItems[0]?.id ?? null;
      setActivePlayerId(nextId);
      syncSearchParam(nextId ? allMedia.find((entry) => entry.id === nextId) ?? null : null);
    }
  }, [activePlayerId, allMedia, favoriteIds, forcedTrailerId, seoAnimeId, videoSuggestionItems]);

  useEffect(() => {
    if (!activePlayer) {
      setPlayerMode("video");
      setIsPlaying(false);
      setIsMuted(true);
      return;
    }
    const cached = getVideoStatusSync(activePlayer.id);
    if (wantsAutoplay) setPlayerMode("video");
    else if (cached === "hidden") setPlayerMode("hidden");
    else if (cached === "unavailable") setPlayerMode("fallback");
    else setPlayerMode("video");
    setIsPlaying(hasTrailer(activePlayer));
    setIsMuted(!soundUnlocked);
  }, [activePlayer?.id, availabilityReady, soundUnlocked, wantsAutoplay]);

  useEffect(() => {
    if (suggestionPreparedRef.current) return;
    if (loading || gridLoading || !promptPreviewItems.length) return;
    suggestionPreparedRef.current = true;
    if (!activePlayerId && !deepLinkTrailerId && !seoAnimeId) {
      setActivePlayerId(promptPreviewItems[0].id);
      syncSearchParam(promptPreviewItems[0]);
    }
    setShowVideoPrompt(true);
  }, [activePlayerId, deepLinkTrailerId, gridLoading, loading, promptPreviewItems, seoAnimeId]);

  useEffect(() => {
    setRenderCount(PAGE_SIZE);
  }, [debouncedSearch, filterGenre, filterStatus, minScore, minYear, sortBy]);

  useEffect(() => {
    const element = sentinelRef.current;
    if (!element) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setRenderCount((count) => (count < filteredSorted.length ? Math.min(filteredSorted.length, count + PAGE_SIZE) : count));
          }
        }
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(element);
    return () => io.disconnect();
  }, [filteredSorted.length]);

  useEffect(() => {
    return () => {
      try {
        pipWindowRef.current?.close();
      } catch {
        // ignore PiP cleanup failures
      }
    };
  }, []);

  const seoTitle = selectedSeoMedia ? `${mediaTitle(selectedSeoMedia)} · Lecteur catalogue anime Lovanet` : "Catalogue Anime Lovanet";
  const seoDescription = selectedSeoMedia
    ? mediaDescription(selectedSeoMedia)
    : "Catalogue anime/manga Lovanet avec lecteur géant, lecture auto, favoris persistants et fiches vidéo indexables.";
  const seoCanonical = selectedSeoMedia ? `${PRIMARY_SITE}/anime-catalog?anime=${selectedSeoMedia.id}` : `${PRIMARY_SITE}/anime-catalog`;

  return (
    <>
      <Helmet>
        <title>{seoTitle}</title>
        <meta name="description" content={seoDescription} />
        <link rel="canonical" href={seoCanonical} />
        <meta property="og:title" content={seoTitle} />
        <meta property="og:description" content={seoDescription} />
        <meta property="og:url" content={seoCanonical} />
        <meta property="og:image" content={mediaImage(selectedSeoMedia || activePlayer)} />
        <meta name="twitter:title" content={seoTitle} />
        <meta name="twitter:description" content={seoDescription} />
        <meta name="twitter:image" content={mediaImage(selectedSeoMedia || activePlayer)} />
        {selectedSeoMedia && (
          <script type="application/ld+json">
            {JSON.stringify({
              "@context": "https://schema.org",
              "@type": "CreativeWork",
              "@id": `${seoCanonical}#anime-card`,
              name: mediaTitle(selectedSeoMedia),
              description: seoDescription,
              url: seoCanonical,
              image: mediaImage(selectedSeoMedia),
              aggregateRating: {
                "@type": "AggregateRating",
                ratingValue: ((selectedSeoMedia.averageScore ?? 80) / 20).toFixed(1),
                reviewCount: String(Math.max(24, selectedSeoMedia.episodes ?? 24)),
                bestRating: "5",
              },
              review: {
                "@type": "Review",
                name: `Avis catalogue ${mediaTitle(selectedSeoMedia)}`,
                reviewBody: seoDescription,
                reviewRating: {
                  "@type": "Rating",
                  ratingValue: ((selectedSeoMedia.averageScore ?? 80) / 20).toFixed(1),
                  bestRating: "5",
                },
                author: { "@type": "Organization", name: "Lovanet" },
              },
            })}
          </script>
        )}
      </Helmet>

      <main className="page-nav-glass min-h-screen overflow-hidden text-foreground" style={{ background: "transparent" }}>
        <Navbar />
        <div className="h-12" />

        <section className="px-4 pb-5 pt-4 md:px-8 xl:px-10" data-testid="catalog-premium-player-section">
          <div className="mx-auto max-w-[1120px] space-y-6">
            <header className="theme-panel-surface glass3d-panel glass3d-surface relative overflow-hidden rounded-[2rem] border border-[var(--theme-border-soft)] p-5 sm:p-6 lg:p-8" data-testid="catalog-premium-hero">
              <div className="pointer-events-none absolute inset-0 opacity-90" style={{ background: "radial-gradient(circle at 18% 18%, rgba(56,189,248,0.16), transparent 22%), radial-gradient(circle at 82% 16%, rgba(244,114,182,0.12), transparent 24%), linear-gradient(135deg, rgba(255,255,255,0.03), transparent 42%)" }} />
              <div className="absolute right-4 top-4 z-20 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new Event(OPEN_QUICKNAV_EVENT))}
                  className="glass3d-btn inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white shadow-[0_14px_35px_rgba(0,0,0,0.24)] transition hover:border-white/25 hover:bg-black/50"
                  aria-label="Ouvrir la navigation rapide"
                  data-testid="catalog-quicknav-open-button"
                >
                  <Compass className="h-5 w-5" />
                </button>
              </div>
              <div className="relative flex justify-center">
                <div className="relative mx-auto w-full max-w-[854px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-black" style={{ aspectRatio: "854 / 480" }} data-testid="catalog-premium-hero-spacer">
                  <video
                    src={CATALOG_TOP_VIDEO}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                    className="absolute inset-0 h-full w-full object-contain"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                </div>
              </div>
            </header>

            {showVideoPrompt && !!videoSuggestionItems.length && (
              <Card className="theme-panel-surface relative overflow-hidden rounded-[1.8rem] border border-[var(--theme-border-soft)] bg-transparent text-white" data-testid="catalog-video-selection-panel">
                <CardContent className="space-y-5 p-5 sm:p-6">
                  <div className="flex flex-wrap items-start justify-end gap-4">
                    <Button
                      type="button"
                      size="icon"
                      variant="glass"
                      className="h-11 w-11 rounded-full text-white"
                      onClick={() => setShowVideoPrompt(false)}
                      data-testid="catalog-video-selection-close-button"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 sm:gap-3" data-testid="catalog-video-selection-grid">
                    {(promptPreviewItems.length ? promptPreviewItems : pagedItems.slice(0, 16)).slice(0, topCardCount).map((media) => (
                      <button
                        key={`suggestion-${media.id}`}
                        type="button"
                        onClick={() => activatePlayer(media, { unlockSound: true, forceFavorite: true })}
                        className="rounded-[1.35rem] border border-white/12 bg-[rgba(255,255,255,0.03)] p-2 text-left transition-[transform,border-color,box-shadow] duration-200 hover:-translate-y-1 hover:border-white/28 hover:shadow-[0_18px_36px_rgba(6,12,24,0.26)]"
                        data-testid={`catalog-video-selection-item-${media.id}`}
                      >
                        <div className="relative aspect-[5/8] overflow-hidden rounded-[1.1rem] border border-white/10 bg-[rgba(255,255,255,0.04)]">
                          <img src={mediaImage(media)} alt={mediaTitle(media)} className="h-full w-full object-cover brightness-[1.04] saturate-[1.05]" loading="lazy" />
                          <div className="pointer-events-none absolute inset-0 rounded-[1.1rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.35),0_0_26px_rgba(255,255,255,0.14)]" />
                          <BlisterFrame radius={16} intensity={0.9} />
                        </div>
                        <p className="mt-3 line-clamp-2 text-sm font-semibold text-white">{showTranslatedCards ? translatedMediaTitle(media) : mediaTitle(media)}</p>
                      </button>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <Button className="btn-neon-rainbow rounded-full text-white" onClick={addSuggestedSelectionToFavorites} data-testid="catalog-video-selection-add-button">
                      <Check className="h-4 w-4" /> Ajouter la sélection aux favoris
                    </Button>
                    <Button variant="glass" className="rounded-full text-white" onClick={playSuggestedSelectionNow} data-testid="catalog-video-selection-play-button">
                      <Play className="h-4 w-4" /> Lire maintenant
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div id="catalog-reader" className="relative overflow-hidden rounded-[2rem] border border-[var(--theme-border-soft)] bg-black/90 p-4 sm:p-5 lg:p-6 scroll-mt-24 glass3d-panel glass3d-surface" data-testid="catalog-giant-player-shell">

              {loading && !items.length ? (
                <div className="relative space-y-5" data-testid="catalog-player-loading-state">
                  <Skeleton className="h-[260px] rounded-[1.75rem] bg-white/10 sm:h-[420px]" />
                  <div className="grid gap-3 sm:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <Skeleton key={`catalog-skeleton-${index}`} className="h-20 rounded-2xl bg-white/10" />
                    ))}
                  </div>
                </div>
              ) : activePlayer ? (
                <div className="relative space-y-5">
                  
                  {availableCatalogLangs.length > 1 && (
                    <div className="mb-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-4 rounded-xl border-2 border-amber-500/80 bg-amber-500/20 p-4 shadow-[0_0_20px_rgba(245,158,11,0.3)] z-20 relative">
                      <span className="text-sm sm:text-base font-black uppercase tracking-widest text-amber-400 flex items-center gap-2">
                        <Sparkles className="w-5 h-5" /> Choisir la langue / Sous-titres du Trailer :
                      </span>
                      <Select value={activeTrailerLang} onValueChange={(val) => { releaseDeepLink(); setActiveTrailerLang(val); setIsPlaying(true); }}>
                        <SelectTrigger className="w-full sm:w-[220px] h-10 bg-black/80 border-amber-500/50 text-white font-bold text-sm">
                          <SelectValue placeholder="Changer la langue..." />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 border-amber-500/50 text-white">
                          {availableCatalogLangs.map(lang => (
                            <SelectItem key={lang} value={lang} className="focus:bg-amber-500/20 focus:text-amber-400 cursor-pointer">
                              {CATALOG_VERSION_LABELS[lang] || lang.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
<div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black" data-testid="catalog-giant-player-stage">
                    <div className="aspect-[16/9] min-h-[280px] sm:min-h-[440px]">
                      
                      {playerMode !== "hidden" && catalogActiveTrailerId ? (

                        <div className="relative h-full w-full">
                          <YouTubeEmbed
                            key={`catalog-player-${activePlayer.id}-${deepLinkTrailerId || "default"}-${playerMode}-${activeTrailerLang}-${catalogCandidateIndex}`}
                            videoId={playerMode === "video" ? catalogActiveTrailerId : undefined}
                            captionLang={activeTrailerLang === "vostfr" ? "fr" : undefined}
                            title={activeTrailerLang && detailTrailers[activeTrailerLang]?.[0]?.title ? detailTrailers[activeTrailerLang][0].title : mediaTitle(activePlayer)}
                            autoplay
                            muted={!soundUnlocked}
                            hideControls
                            onPlayerReady={(player) => {
                              playerInstanceRef.current = player;
                              if (!player) return;
                              try {
                                if (soundUnlocked) {
                                  player.unMute?.();
                                  setIsMuted(false);
                                } else {
                                  player.mute?.();
                                  setIsMuted(true);
                                }
                                player.playVideo?.();
                                setIsPlaying(true);
                              } catch {
                                setIsPlaying(true);
                              }
                            }}
                            onPlayerStateChange={(state) => {
                              if (state === 1) setIsPlaying(true);
                              if (state === 2) setIsPlaying(false);
                              if (state === 0) {
                                setIsPlaying(false);
                                if (playerQueue.length > 1) {
                                  const next = pickNextUnplayed(activePlayer.id);
                                  if (next) {
                                    playedQueueRef.current.add(next.id);
                                    suggestedHistoryRef.current.add(next.id);
                                    activatePlayer(next, { unlockSound: soundUnlocked });
                                  }
                                }
                              }
                            }}
                            onUnavailable={handleCatalogTrailerUnavailable}
                            onExhausted={handleCatalogTrailerUnavailable}
                          />
                          {!soundUnlocked && (
                            <>
                              <div className="absolute bottom-4 left-4 z-10 max-w-sm rounded-2xl border border-white/10 bg-[rgba(8,12,24,0.6)] px-4 py-3 text-sm text-white/78 backdrop-blur-md" data-testid="catalog-player-sound-hint">
                                Lecture auto activée en muet. Cliquez sur Lecture, Son, une carte ou le grand écran pour activer le son.
                              </div>
                              <button
                                type="button"
                                onClick={unlockSound}
                                className="absolute inset-0 z-[1] bg-transparent"
                                style={{ background: "transparent", border: "none", boxShadow: "none" }}
                                data-no-glass
                                aria-label="Activer le son du lecteur vidéo"
                                data-testid="catalog-player-activate-sound-overlay"
                              />
                            </>
                          )}

                        </div>
                      ) : (
                        <div className="relative flex h-full w-full items-end overflow-hidden">
                          <img src={mediaImage(activePlayer)} alt={mediaTitle(activePlayer)} className="absolute inset-0 h-full w-full object-cover" data-testid="catalog-player-fallback-image" />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,10,24,0.04),rgba(5,10,24,0.84))]" />
                          <div className="relative z-10 space-y-3 p-5 sm:p-6 lg:p-8">
                            <Badge className="rounded-full border border-white/10 bg-[rgba(8,12,24,0.48)] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/82" data-testid="catalog-player-fallback-badge">
                              {playerMode === "hidden" ? "Vidéo indisponible" : "Prévisualisation catalogue"}
                            </Badge>
                            <h2 className="max-w-2xl font-display text-2xl font-black text-white sm:text-3xl" data-testid="catalog-player-fallback-title">
                              {showTranslatedCards ? translatedMediaTitle(activePlayer) : mediaTitle(activePlayer)}
                            </h2>
                            <div className="flex flex-wrap items-center gap-2" data-testid="catalog-player-fallback-translation-controls">
                              <span className="text-[11px] uppercase tracking-[0.2em] text-white/58">Traduction</span>
                              <Select value={translationLang} onValueChange={setTranslationLang}>
                                <SelectTrigger className="h-9 w-[210px] rounded-xl border-white/20 bg-black/50 text-white">
                                  <SelectValue placeholder="Choisir une langue" />
                                </SelectTrigger>
                                <SelectContent className="max-h-72 bg-black/95 text-white">
                                  {TRANSLATION_LANGUAGE_OPTIONS.map((option) => (
                                    <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <TranslationToggleButton
                                active={showTranslatedCards}
                                loading={translationsLoading}
                                targetLangLabel={translationLangLabel}
                                onTranslate={translateCatalogNow}
                                onToggle={() => setShowTranslatedCards((value) => !value)}
                                dataTestId="catalog-player-fallback-translate-toggle-button"
                              />
                            </div>
                            <p className="max-w-2xl text-sm leading-7 text-white/72" data-testid="catalog-player-fallback-description">
                              {showTranslatedCards ? translatedMediaDescription(activePlayer) : mediaDescription(activePlayer)}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="pointer-events-none absolute inset-0 rounded-[1.75rem] ring-1 ring-white/10" />
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-[1fr_.56fr]">
                    <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.03)] text-white shadow-[0_20px_40px_rgba(6,12,24,0.28)] glass3d-panel glass3d-surface" data-testid="catalog-player-meta-card">
                      <CardContent className="space-y-4 p-5 sm:p-6">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge className="rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.22em] text-white/80" data-testid="catalog-player-format-badge">
                            {activePlayer.format || "Anime"}
                          </Badge>
                          <Badge variant="outline" className="rounded-full border-[var(--theme-border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-white/80" data-testid="catalog-player-year-badge">
                            <CalendarRange className="mr-1 h-3.5 w-3.5" /> {activePlayer.seasonYear || "Catalogue"}
                          </Badge>
                          {typeof activePlayer.averageScore === "number" && (
                            <Badge variant="outline" className="rounded-full border-[var(--theme-border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-white/82" data-testid="catalog-player-score-badge">
                              <Star className="mr-1 h-3.5 w-3.5 fill-current" /> {activePlayer.averageScore}
                            </Badge>
                          )}
                          <Badge variant="outline" className="rounded-full border-[var(--theme-border-soft)] bg-[rgba(255,255,255,0.03)] px-3 py-1 text-white/82" data-testid="catalog-player-queue-badge">
                            <Clapperboard className="mr-1 h-3.5 w-3.5" /> File {Math.max(playerQueue.length, favoriteItems.length)}
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <h2 className="font-display text-2xl font-black leading-tight text-white sm:text-3xl" data-testid="catalog-player-title">
                            {showTranslatedCards ? translatedMediaTitle(activePlayer) : mediaTitle(activePlayer)}
                          </h2>
                          <div className="flex flex-wrap items-center gap-2" data-testid="catalog-player-translation-controls">
                            <span className="text-[11px] uppercase tracking-[0.2em] text-white/58">Traduction</span>
                            <Select value={translationLang} onValueChange={setTranslationLang}>
                              <SelectTrigger className="h-9 w-[210px] rounded-xl border-white/20 bg-black/50 text-white">
                                <SelectValue placeholder="Choisir une langue" />
                              </SelectTrigger>
                              <SelectContent className="max-h-72 bg-black/95 text-white">
                                {TRANSLATION_LANGUAGE_OPTIONS.map((option) => (
                                  <SelectItem key={option.code} value={option.code}>{option.label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <TranslationToggleButton
                              active={showTranslatedCards}
                              loading={translationsLoading}
                              targetLangLabel={translationLangLabel}
                              onTranslate={translateCatalogNow}
                              onToggle={() => setShowTranslatedCards((value) => !value)}
                              dataTestId="catalog-player-translate-toggle-button"
                            />
                          </div>
                          <p className="max-w-4xl text-sm leading-7 text-white/72 sm:text-base" data-testid="catalog-player-description">
                            {showTranslatedCards ? translatedMediaDescription(activePlayer) : mediaDescription(activePlayer)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-2" data-testid="catalog-player-genres-row">
                          {(activePlayer.genres || []).slice(0, 5).map((genre) => (
                            <span key={genre} className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.03)] px-3 py-2 text-xs text-white/82">
                              {genre}
                            </span>
                          ))}
                        </div>
                      </CardContent>
                    </div>

                    <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.03)] text-white shadow-[0_20px_40px_rgba(6,12,24,0.28)] glass3d-panel glass3d-surface" data-testid="catalog-player-controls-card">
                      <CardContent className="space-y-5 p-5 sm:p-6">
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                          <Button type="button" variant="glass" className="min-h-[48px] rounded-2xl text-white" onClick={handlePrevious} disabled={!playerQueue.length} data-testid="catalog-player-prev-button" aria-label="Précédent">
                            <SkipBack className="h-4 w-4" />
                          </Button>
                          <Button type="button" className="btn-neon-rainbow min-h-[48px] rounded-2xl text-white" onClick={togglePlayback} disabled={!activePlayer || !hasTrailer(activePlayer) || playerMode === "hidden"} data-testid="catalog-player-play-toggle-button">
                            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                            {isPlaying ? "Pause" : "Lecture"}
                          </Button>
                          <Button type="button" variant="glass" className="min-h-[48px] rounded-2xl text-white" onClick={handleNext} disabled={!playerQueue.length} data-testid="catalog-player-next-button">
                            <SkipForward className="h-4 w-4" /> Suivant
                          </Button>
                          <Button type="button" variant="glass" className="min-h-[48px] rounded-2xl text-white" onClick={toggleMute} disabled={!activePlayer || !hasTrailer(activePlayer) || playerMode === "hidden"} data-testid="catalog-player-mute-button">
                            {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                            {isMuted ? "Activer" : "Couper"}
                          </Button>
                          
                          {activePlayer && availableCatalogLangs.length > 1 && (
                            <div className="flex w-full">
                              <AudioLanguageSwitcher 
                                activeLang={activeTrailerLang || "ja"}
                                languages={availableCatalogLangs}
                                sources={catalogTrailerSources}
                                onLanguageChange={(lang) => {
                                  releaseDeepLink();
                                  setActiveTrailerLang(lang);
                                  setIsPlaying(true);
                                }}
                              />
                            </div>
                          )}
                          <Button type="button" variant="glass" className="min-h-[48px] rounded-2xl text-white" onClick={openMiniPlayer} disabled={!activePlayer} data-testid="catalog-player-pip-button">
                            <PictureInPicture2 className="h-4 w-4" /> {pipOpen ? "Fermer PiP" : "Ouvrir PiP"}
                          </Button>
                          <Button type="button" variant="outline" className="min-h-[48px] rounded-2xl text-white" onClick={() => setDetailMedia(activePlayer)} data-testid="catalog-player-details-button">
                            <Info className="h-4 w-4" /> Détails
                          </Button>
                        </div>
                        <div className="rounded-[1.3rem] border border-white/10 bg-[rgba(7,12,24,0.48)] p-4 text-sm text-white/72" data-testid="catalog-player-status-note">
                          {playerQueue.length
                            ? `Playlist actuelle : ${playerQueue.length} vidéo${playerQueue.length > 1 ? "s" : ""} favorites prêtes pour la lecture complète en continu.`
                            : "Ajoutez un titre en favori avec la bulle flottante des cartes pour créer votre file de lecture géante."}
                        </div>
                      </CardContent>
                    </div>
                  </div>
                </div>
              ) : deepLinkTrailerId ? (
                <div className="relative space-y-5" data-testid="catalog-deeplink-player">
                  <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-black">
                    <div className="aspect-[16/9] min-h-[280px] sm:min-h-[440px]">
                      <YouTubeEmbed
                        key={`catalog-deeplink-${deepLinkTrailerId}`}
                        videoId={deepLinkTrailerId}
                        title="Bande-annonce"
                        autoplay
                        muted={!soundUnlocked}
                        hideControls={false}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="relative flex min-h-[420px] flex-col items-center justify-center gap-5 rounded-[1.75rem] border border-dashed border-white/12 bg-[rgba(5,10,24,0.42)] px-6 py-12 text-center" data-testid="catalog-player-empty-state">
                  <div className="absolute inset-0 rounded-[1.75rem] bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.12),transparent_24%),radial-gradient(circle_at_bottom,rgba(244,114,182,0.1),transparent_26%)]" />
                  <div className="relative z-10 mx-auto max-w-2xl space-y-4">
                    <Badge className="mx-auto inline-flex rounded-full border border-white/12 bg-white/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-white/78">
                      Aucun favori actif
                    </Badge>
                    <h2 className="font-display text-3xl font-black text-white sm:text-4xl" data-testid="catalog-empty-title">
                      Sélectionnez une carte pour l’envoyer immédiatement sur le grand écran.
                    </h2>
                    <p className="mx-auto max-w-xl text-sm leading-7 text-white/70 sm:text-base" data-testid="catalog-empty-description">
                      Les bulles flottantes des cartes ajoutent vos titres en favoris et les préparent pour la lecture automatique dans ce lecteur géant lumineux.
                    </p>
                    <div className="flex flex-wrap items-center justify-center gap-3">
                      <Button className="btn-neon-rainbow rounded-full text-white" onClick={() => videoSuggestionItems[0] && activatePlayer(videoSuggestionItems[0], { forceFavorite: true, unlockSound: true })} data-testid="catalog-empty-launch-button">
                        <Sparkles className="h-4 w-4" /> Lancer la première sélection
                      </Button>
                      <Button variant="glass" className="rounded-full text-white" onClick={() => setSearch("")} data-testid="catalog-empty-reset-search-button">
                        Réinitialiser la recherche
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {!!favoriteItems.length && (
              <div className="rounded-[1.75rem] border border-white/10 bg-[rgba(255,255,255,0.03)] p-4 text-white shadow-[0_20px_40px_rgba(6,12,24,0.28)] sm:p-5" data-testid="catalog-favorites-strip">
                <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">File personnelle</p>
                    <h2 className="mt-2 font-display text-2xl font-black">Favoris prêts pour le grand lecteur</h2>
                  </div>
                  <Badge variant="outline" className="rounded-full border-[var(--theme-border-soft)] bg-[rgba(255,255,255,0.03)] px-4 py-2 text-white/78" data-testid="catalog-favorites-badge">
                    {favoriteItems.length} élément{favoriteItems.length > 1 ? "s" : ""}
                  </Badge>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-2" data-testid="catalog-favorites-scroll-row">
                  {favoriteItems.map((media) => {
                    const active = activePlayerId === media.id;
                    return (
                      <button
                        key={`favorite-${media.id}`}
                        type="button"
                        className={`flex min-h-[86px] min-w-[250px] items-center gap-3 rounded-[1.25rem] border px-3 py-3 text-left transition-[transform,border-color,box-shadow] duration-200 ${active ? "border-white/28 shadow-[0_18px_34px_rgba(6,12,24,0.28)]" : "border-white/10"}`}
                        onClick={() => activatePlayer(media, { unlockSound: true })}
                        data-testid={`catalog-favorite-chip-${media.id}`}
                        style={{
                          background: "var(--catalog-card-bg, rgba(255,255,255,0.03))",
                          color: "var(--catalog-card-fg, #ffffff)",
                          borderColor: active ? "var(--catalog-card-border, rgba(255,255,255,0.28))" : "var(--catalog-card-border, rgba(255,255,255,0.12))",
                          backgroundSize: "var(--catalog-card-size, auto)",
                          animation: "var(--catalog-card-anim, none)",
                        }}
                      >
                        <div className="relative h-16 w-12 overflow-hidden rounded-xl border border-white/12 bg-[rgba(255,255,255,0.04)]">
                          <img src={mediaImage(media)} alt={mediaTitle(media)} className="h-full w-full object-cover brightness-[1.04] saturate-[1.05]" loading="lazy" />
                          <div className="pointer-events-none absolute inset-0 rounded-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.34),0_0_18px_rgba(255,255,255,0.12)]" />
                          <BlisterFrame radius={10} intensity={0.9} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="line-clamp-1 text-sm font-semibold">{showTranslatedCards ? translatedMediaTitle(media) : mediaTitle(media)}</p>
                          <p className="mt-1 text-xs opacity-75">{media.format || "Anime"} · {media.seasonYear || "Catalogue"}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>

        <div className="px-4 pt-1 md:px-8 xl:px-10">
          <MangaNeonBar height={26} className="rounded-full overflow-hidden" />
        </div>
        <section className="px-4 py-8 md:px-8 xl:px-10" data-testid="catalog-filters-section">
          <div className="mx-auto max-w-[1120px] space-y-5">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Bibliothèque indexée</p>
                <h2 className="mt-2 font-display text-3xl font-black text-white" data-testid="catalog-grid-title">
                  Tout le catalogue · {filteredSorted.length} / {gridItems.length} titres
                </h2>
              </div>
              {gridLoading && <span className="text-xs text-white/52" data-testid="catalog-grid-loading-label">Indexation en cours…</span>}
            </div>

            <Card className="theme-panel-surface overflow-hidden rounded-[1.9rem] border border-[var(--theme-border-soft)] bg-transparent text-white" data-testid="catalog-filter-panel">
              <CardContent className="grid gap-4 p-4 sm:p-5 lg:grid-cols-[1.2fr_repeat(4,minmax(0,1fr))] lg:items-center">
              <div className="flex gap-2">
                <Button variant={viewMode === "grid" ? "default" : "outline"} onClick={() => setViewMode("grid")} className="rounded-xl">Grille</Button>
                <Button variant={viewMode === "carousel" ? "default" : "outline"} onClick={() => setViewMode("carousel")} className="rounded-xl">Carrousel 3D</Button>
              </div>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/44" />
                  <Input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Rechercher un animé, un studio, une licence..." className="theme-search-input h-12 rounded-2xl pl-10 text-white placeholder:text-white/40" aria-label="Rechercher dans le catalogue" data-testid="catalog-search-input" />
                </div>

                <Select value={filterGenre} onValueChange={setFilterGenre}>
                  <SelectTrigger className="theme-search-input h-12 rounded-2xl text-white" data-testid="catalog-genre-select">
                    <SelectValue placeholder="Genre" />
                  </SelectTrigger>
                  <SelectContent className="theme-panel-surface border-[var(--theme-border-soft)] bg-[rgba(10,14,24,0.95)] text-white">
                    <SelectItem value="all">Tous les genres</SelectItem>
                    {allGenres.map((genre) => (
                      <SelectItem key={genre} value={genre}>{genre}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="theme-search-input h-12 rounded-2xl text-white" data-testid="catalog-status-select">
                    <SelectValue placeholder="Statut" />
                  </SelectTrigger>
                  <SelectContent className="theme-panel-surface border-[var(--theme-border-soft)] bg-[rgba(10,14,24,0.95)] text-white">
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    <SelectItem value="releasing">En cours</SelectItem>
                    <SelectItem value="finished">Terminé</SelectItem>
                    <SelectItem value="upcoming">À venir</SelectItem>
                    <SelectItem value="hiatus">En pause</SelectItem>
                    <SelectItem value="cancelled">Annulé</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={minScore} onValueChange={setMinScore}>
                  <SelectTrigger className="theme-search-input h-12 rounded-2xl text-white" data-testid="catalog-score-select">
                    <SelectValue placeholder="Score" />
                  </SelectTrigger>
                  <SelectContent className="theme-panel-surface border-[var(--theme-border-soft)] bg-[rgba(10,14,24,0.95)] text-white">
                    <SelectItem value="0">Tous les scores</SelectItem>
                    <SelectItem value="60">≥ 60</SelectItem>
                    <SelectItem value="70">≥ 70</SelectItem>
                    <SelectItem value="80">≥ 80</SelectItem>
                    <SelectItem value="85">≥ 85</SelectItem>
                    <SelectItem value="90">≥ 90</SelectItem>
                  </SelectContent>
                </Select>

                <div className="grid gap-4 sm:grid-cols-2">
                  <Select value={minYear} onValueChange={setMinYear}>
                    <SelectTrigger className="theme-search-input h-12 rounded-2xl text-white" data-testid="catalog-year-select">
                      <SelectValue placeholder="Année" />
                    </SelectTrigger>
                    <SelectContent className="theme-panel-surface border-[var(--theme-border-soft)] bg-[rgba(10,14,24,0.95)] text-white">
                      <SelectItem value="0">Toutes les années</SelectItem>
                      <SelectItem value="2026">≥ 2026</SelectItem>
                      <SelectItem value="2025">≥ 2025</SelectItem>
                      <SelectItem value="2024">≥ 2024</SelectItem>
                      <SelectItem value="2023">≥ 2023</SelectItem>
                      <SelectItem value="2020">≥ 2020</SelectItem>
                      <SelectItem value="2015">≥ 2015</SelectItem>
                      <SelectItem value="2010">≥ 2010</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                    <SelectTrigger className="theme-search-input h-12 rounded-2xl text-white" data-testid="catalog-sort-select">
                      <SelectValue placeholder="Tri" />
                    </SelectTrigger>
                    <SelectContent className="theme-panel-surface border-[var(--theme-border-soft)] bg-[rgba(10,14,24,0.95)] text-white">
                      <SelectItem value="default">Tendances</SelectItem>
                      <SelectItem value="newest">Plus récents</SelectItem>
                      <SelectItem value="score">Meilleurs scores</SelectItem>
                      <SelectItem value="alpha">A → Z</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {(filterGenre !== "all" || filterStatus !== "all" || minScore !== "0" || minYear !== "0" || sortBy !== "default" || search) && (
              <div className="flex justify-end">
                <Button type="button" variant="glass" className="rounded-full text-white" onClick={() => { setFilterGenre("all"); setFilterStatus("all"); setMinScore("0"); setMinYear("0"); setSortBy("default"); setSearch(""); }} data-testid="catalog-reset-filters-button">
                  Réinitialiser les filtres
                </Button>
              </div>
            )}

            {recommendations.length > 0 && !search && filterGenre === "all" && (
              <div className="mb-8" data-testid="catalog-recommendations-section">
                <h3 className="mb-4 font-display text-2xl font-bold tracking-wider text-white">Recommandé Pour Vous</h3>
                <div className="flex overflow-x-auto gap-4 pb-4 snap-x snap-mandatory hide-scrollbar">
                  {recommendations.map((m) => {
                    const title = mediaTitle(m);
                    const image = m.coverImage.extraLarge || m.coverImage.large || mediaImage(m);
                    const isFavorite = favoriteIds.includes(m.id);
                    const isActive = activePlayerId === m.id;
                    return (
                      <article
                        key={`rec-${m.id}`}
                        className={`group relative overflow-hidden rounded-[1.2rem] border text-white transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 min-w-[200px] snap-center shrink-0 ${isActive ? "shadow-[0_14px_28px_rgba(6,12,24,0.24)]" : "shadow-[0_8px_18px_rgba(6,12,24,0.16)]"}`}
                        data-testid={`catalog-rec-card-${m.id}`}
                        style={{
                          background: "var(--catalog-card-bg, linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018)))",
                          color: "var(--catalog-card-fg, #ffffff)",
                          borderColor: isActive ? "var(--catalog-card-border, rgba(255,255,255,0.26))" : "var(--catalog-card-border, rgba(255,255,255,0.12))",
                          backgroundSize: "var(--catalog-card-size, auto)",
                          animation: "var(--catalog-card-anim, none)",
                          backdropFilter: "blur(1px)",
                          WebkitBackdropFilter: "blur(1px)",
                        }}
                      >
                        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.1),transparent_18%,transparent_82%,rgba(255,255,255,0.04))]" />
                        <div className="relative aspect-[3/4] overflow-hidden rounded-t-[1.2rem] border-b border-white/10 bg-[rgba(255,255,255,0.04)]">
                          <img
                            src={image}
                            alt={title}
                            loading="lazy"
                            className="h-full w-full object-cover object-center contrast-[1.03] saturate-[1.14] transition-transform duration-300 group-hover:scale-[1.015]"
                          />
                          <div className="pointer-events-none absolute inset-0 rounded-t-[1.2rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_0_20px_rgba(255,255,255,0.08)]" />
                          <div className="absolute left-2 top-2 right-2 flex items-start justify-between gap-2">
                            <Badge className="rounded-full border border-white/14 bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/88">
                              {m.format || "Anime"}
                            </Badge>
                            <div className="flex items-center gap-2">
                              <Button
                                type="button"
                                size="icon"
                                variant="glass"
                                className={`h-8 w-8 rounded-full text-white ${isFavorite ? "border-primary/60 text-primary" : ""}`}
                                onClick={() => {
                                  if (!isFavorite) {
                                    authToggleFavorite(m.id);
                                  }
                                  activatePlayer(m, { unlockSound: true });
                                }}
                              >
                                {isFavorite ? <Heart className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4" />}
                              </Button>
                              <Button type="button" size="icon" variant="glass" className="h-8 w-8 rounded-full text-white" onClick={() => setDetailMedia(m)}>
                                <Info className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                          <BlisterFrame radius={12} intensity={0.78} />
                        </div>
                        <CardContent className="space-y-2 p-2.5">
                          <h3 className="line-clamp-2 font-display text-[12px] font-black leading-tight">
                            {showTranslatedCards ? translatedMediaTitle(m) : title}
                          </h3>
                        </CardContent>
                      </article>
                    );
                  })}
                </div>
              </div>
            )}

            {pagedItems.length ? (
              viewMode === "carousel" ? (
              <div className="w-full h-[600px] relative mt-10 rounded-[2rem] overflow-hidden border border-white/10 bg-black/40">
                 <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.1),transparent)]" />
                 <ErrorBoundary fallback={<div className="flex h-full items-center justify-center"><p>Impossible de charger la 3D.</p><Button onClick={() => setViewMode("grid")}>Retour à la grille</Button></div>}>
                   <Canvas camera={{ position: [0, 2, 8], fov: 45 }}>
                      <ambientLight intensity={0.5} />
                      <pointLight position={[10, 10, 10]} intensity={1} />
                      <Carousel3D items={pagedItems.slice(0, 20)} onSelect={(media: any) => { setActivePlayerId(media.id); setDetailMedia(media); }} activeId={activePlayerId} />
                      <OrbitControls enableZoom={false} maxPolarAngle={Math.PI / 2} minPolarAngle={Math.PI / 2.5} />
                   </Canvas>
                 </ErrorBoundary>
                 <div className="absolute top-4 left-4 text-xs text-white/50 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm border border-white/10 pointer-events-none">Faites glisser pour tourner</div>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:gap-3 xl:gap-4" data-testid="catalog-grid">
                {pagedItems.map((media, index) => {
                  const title = mediaTitle(media);
                  const image = media.coverImage.extraLarge || media.coverImage.large || mediaImage(media);
                  const isFavorite = favoriteIds.includes(media.id);
                  const isActive = activePlayerId === media.id;
                  return (
                    <article
                      key={`catalog-card-${media.id}`}
                      className={`group relative overflow-hidden rounded-[1.2rem] border text-white transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 ${isActive ? "shadow-[0_14px_28px_rgba(6,12,24,0.24)]" : "shadow-[0_8px_18px_rgba(6,12,24,0.16)]"}`}
                      data-testid={`catalog-card-${media.id}`}
                      style={{
                        background: "var(--catalog-card-bg, linear-gradient(180deg, rgba(255,255,255,0.055), rgba(255,255,255,0.018)))",
                        color: "var(--catalog-card-fg, #ffffff)",
                        borderColor: isActive ? "var(--catalog-card-border, rgba(255,255,255,0.26))" : "var(--catalog-card-border, rgba(255,255,255,0.12))",
                        backgroundSize: "var(--catalog-card-size, auto)",
                        animation: "var(--catalog-card-anim, none)",
                        backdropFilter: "blur(1px)",
                        WebkitBackdropFilter: "blur(1px)",
                      }}
                    >
                      <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(180deg,rgba(255,255,255,0.1),transparent_18%,transparent_82%,rgba(255,255,255,0.04))]" />
                      <div className="relative aspect-[3/4] overflow-hidden rounded-t-[1.2rem] border-b border-white/10 bg-[rgba(255,255,255,0.04)]">
                        <img
                          src={image}
                          alt={title}
                          loading={index < 8 ? "eager" : "lazy"}
                          decoding="async"
                          fetchPriority={index < 4 ? "high" : "auto"}
                          className="h-full w-full object-cover object-center contrast-[1.03] saturate-[1.14] transition-transform duration-300 group-hover:scale-[1.015]"
                          onError={(event) => {
                            const target = event.currentTarget;
                            if (media.coverImage.large && target.src !== media.coverImage.large) {
                              target.src = media.coverImage.large;
                            } else if (media.coverImage.extraLarge && target.src !== media.coverImage.extraLarge) {
                              target.src = media.coverImage.extraLarge;
                            } else {
                              target.style.display = "none";
                            }
                          }}
                        />
                        <div className="pointer-events-none absolute inset-0 rounded-t-[1.2rem] shadow-[inset_0_1px_0_rgba(255,255,255,0.26),0_0_20px_rgba(255,255,255,0.08)]" />
                        <div className="absolute left-2 top-2 right-2 flex items-start justify-between gap-2">
                          <Badge className="rounded-full border border-white/14 bg-[rgba(255,255,255,0.08)] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-white/88" data-testid={`catalog-card-format-${media.id}`}>
                            {media.format || "Anime"}
                          </Badge>
                          <div className="flex items-center gap-2 opacity-100 transition-opacity duration-200 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                            <Button
                              type="button"
                              size="icon"
                              variant="glass"
                              className={`h-8 w-8 rounded-full text-white ${isFavorite ? "border-primary/60 text-primary" : ""}`}
                              onClick={() => {
                                if (!isFavorite) {
                                  authToggleFavorite(media.id);
                                }
                                activatePlayer(media, { unlockSound: true });
                              }}
                              aria-label={isFavorite ? `Relancer ${title} dans le lecteur géant` : `Ajouter ${title} aux favoris et lancer la lecture`}
                              data-testid={`catalog-card-bubble-play-${media.id}`}
                            >
                              {isFavorite ? <Heart className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4" />}
                            </Button>
                            <Button type="button" size="icon" variant="glass" className="h-11 w-11 rounded-full text-white" onClick={() => setDetailMedia(media)} aria-label={`Ouvrir la fiche détaillée de ${title}`} data-testid={`catalog-card-info-${media.id}`}>
                              <Info className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                          <span className="inline-flex min-h-[28px] items-center rounded-full border border-white/12 bg-[rgba(255,255,255,0.08)] px-2 text-[9px] text-white/84" data-testid={`catalog-card-score-${media.id}`}>
                            {typeof media.averageScore === "number" ? `${media.averageScore} / 100` : "Score en cours"}
                          </span>
                          {hasPlayableVideo(media) && (
                            <span className="inline-flex min-h-[28px] items-center rounded-full border border-white/12 bg-[rgba(255,255,255,0.08)] px-2 text-[9px] text-white/88" data-testid={`catalog-card-trailer-${media.id}`}>
                              <PlayCircle className="mr-1 h-3 w-3 text-[var(--theme-link)]" /> Vidéo
                            </span>
                          )}
                        </div>
                        <BlisterFrame radius={12} intensity={0.78} />
                      </div>

                      <CardContent className="space-y-2 p-2.5">
                        <div className="space-y-1">
                          <h3 className="line-clamp-2 font-display text-[12px] font-black leading-tight" data-testid={`catalog-card-title-${media.id}`}>
                            {showTranslatedCards ? translatedMediaTitle(media) : title}
                          </h3>
                          {showTranslatedCards && translatedMediaTitle(media) !== title && (
                            <p className="line-clamp-1 text-[8px] uppercase tracking-[0.14em] opacity-65" data-testid={`catalog-card-original-title-${media.id}`}>
                              {title}
                            </p>
                          )}
                          <p className="line-clamp-2 text-[10px] leading-4 opacity-80" data-testid={`catalog-card-description-${media.id}`}>
                            {showTranslatedCards ? translatedMediaDescription(media) : mediaDescription(media)}
                          </p>
                        </div>

                        <div className="flex flex-wrap gap-1" data-testid={`catalog-card-tags-${media.id}`}>
                          <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] px-1.5 py-1 text-[8px] opacity-90">{media.seasonYear || "Catalogue"}</span>
                          <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] px-1.5 py-1 text-[8px] opacity-90">{media.episodes ? `${media.episodes} ép.` : "À confirmer"}</span>
                          {media.status && <span className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.06)] px-1.5 py-1 text-[8px] opacity-90">{media.status}</span>}
                        </div>

                        <div className="flex flex-col gap-1">
                          <Button type="button" className="btn-neon-rainbow min-h-[28px] rounded-lg px-1.5 text-[9px] text-white" onClick={() => activatePlayer(media, { forceFavorite: true, unlockSound: true })} data-testid={`catalog-card-primary-action-${media.id}`}>
                            <Play className="h-3 w-3" /> Envoyer
                          </Button>
                          <Button type="button" variant="glass" className={`min-h-[26px] rounded-lg px-1.5 text-[9px] text-white ${isFavorite ? "border-primary/60 text-primary" : ""}`} onClick={() => toggleFavorite(media)} data-testid={`catalog-card-favorite-toggle-${media.id}`}>
                            <Heart className={`h-3 w-3 ${isFavorite ? "fill-current" : ""}`} />
                            {isFavorite ? "Retirer" : "Favori"}
                          </Button>
                        </div>
                      </CardContent>
                    </article>
                  );
                })}
              </div>
            )) : null}
            {!pagedItems.length && (
              <Card className="theme-panel-surface rounded-[1.9rem] border border-[var(--theme-border-soft)] bg-transparent text-white" data-testid="catalog-grid-empty-state">
                <CardContent className="space-y-4 p-8 text-center">
                  <p className="text-[11px] uppercase tracking-[0.3em] text-white/50">Aucun résultat</p>
                  <h3 className="font-display text-3xl font-black">Aucun animé ne correspond à ces filtres.</h3>
                  <p className="text-sm leading-7 text-white/68">Réinitialisez les filtres ou modifiez votre recherche pour réafficher le catalogue complet.</p>
                  <div className="flex justify-center">
                    <Button variant="glass" className="rounded-full text-white" onClick={() => { setFilterGenre("all"); setFilterStatus("all"); setMinScore("0"); setMinYear("0"); setSortBy("default"); setSearch(""); }} data-testid="catalog-grid-empty-reset-button">
                      Réinitialiser
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div ref={sentinelRef} className="flex h-16 items-center justify-center text-xs text-white/52" data-testid="catalog-grid-sentinel">
              {renderCount < filteredSorted.length
                ? `Chargement… (${renderCount} / ${filteredSorted.length})`
                : filteredSorted.length > 0
                  ? `Fin du catalogue · ${filteredSorted.length} titres`
                  : null}
            </div>
          </div>
        </section>

        <Dialog open={!!detailMedia} onOpenChange={(open) => !open && setDetailMedia(null)}>
          <DialogContent className="max-w-5xl border-[var(--theme-border-soft)] bg-[rgba(10,14,24,0.95)] text-white glass3d-panel glass3d-surface" data-testid="catalog-detail-dialog">
            {detailMedia && (
              <>
                <DialogHeader>
                  <DialogTitle className="font-display text-3xl font-black" data-testid="catalog-detail-title">
                    {showTranslatedCards ? translatedMediaTitle(detailMedia) : mediaTitle(detailMedia)}
                  </DialogTitle>
                  <DialogDescription className="text-white/62" data-testid="catalog-detail-description">
                    {showTranslatedCards ? translatedMediaDescription(detailMedia) : mediaDescription(detailMedia)}
                  </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 lg:grid-cols-[1.05fr_.95fr]">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-3">
                      
                  {availableCatalogLangs.length > 0 && (
                    <div className="mb-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border-2 border-amber-500/80 bg-amber-500/20 p-3 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400 flex items-center gap-2">
                        <Sparkles className="w-4 h-4" /> Choisir la version du trailer :
                      </span>
                      <Select value={activeTrailerLang} onValueChange={(val) => { releaseDeepLink(); setActiveTrailerLang(val); setIsPlaying(true); }}>
                        <SelectTrigger className="w-full sm:w-[220px] h-10 bg-black/80 border-amber-500/50 text-white font-bold text-sm">
                          <SelectValue placeholder="Changer la version..." />
                        </SelectTrigger>
                        <SelectContent className="bg-black/95 border-amber-500/50 text-white">
                          {availableCatalogLangs.map((lang) => (
                            <SelectItem key={lang} value={lang} className="focus:bg-amber-500/20 focus:text-amber-400 cursor-pointer">
                              {CATALOG_VERSION_LABELS[lang] || lang.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
<div className="relative aspect-video overflow-hidden rounded-[1.7rem] border border-white/10 bg-black" data-testid="catalog-detail-media-panel">
                        {activeTrailerLang && detailTrailers[activeTrailerLang]?.[0] ? (
                          <YouTubeEmbed
                            key={`detail-${detailTrailers[activeTrailerLang][0].id}`}
                            videoId={detailTrailers[activeTrailerLang][0].id}
                            searchQuery={`${mediaTitle(detailMedia)} trailer ${activeTrailerLang}`}
                            title={detailTrailers[activeTrailerLang][0].title}
                            autoplay={false}
                            muted={!soundUnlocked}
                            hideControls
                          />
                        ) : hasTrailer(detailMedia) ? (
                          <YouTubeEmbed
                            key={`detail-${detailMedia.id}`}
                            videoId={detailMedia.trailer?.id}
                            searchQuery={`${mediaTitle(detailMedia)} bande annonce anime`}
                            title={mediaTitle(detailMedia)}
                            autoplay={false}
                            muted={!soundUnlocked}
                            hideControls
                          />
                        ) : (
                          <img src={mediaImage(detailMedia)} alt={mediaTitle(detailMedia)} className="h-full w-full object-cover" />
                        )}
                      </div>
                      
                      {availableCatalogLangs.length > 0 && (
                        <div className="flex items-center gap-3" data-testid="catalog-detail-language-selector-container">
                          <span className="text-xs text-white/50 font-bold uppercase tracking-wider">Version du Trailer :</span>
                          <Select value={activeTrailerLang} onValueChange={setActiveTrailerLang}>
                            <SelectTrigger className="w-[140px] h-8 bg-white/5 border-white/10 text-xs" data-testid="catalog-detail-language-selector">
                              <SelectValue placeholder="Choisir..." />
                            </SelectTrigger>
                            <SelectContent data-testid="catalog-detail-language-options">
                              {availableCatalogLangs.map((lang) => (
                                <SelectItem key={lang} value={lang} data-testid={`catalog-detail-language-option-${lang}`}>
                                  {CATALOG_VERSION_LABELS[lang] || lang.toUpperCase()}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2" data-testid="catalog-detail-genres-row">
                      {(detailMedia.genres || []).map((genre) => (
                        <span key={genre} className="rounded-full border border-white/10 bg-[rgba(255,255,255,0.04)] px-3 py-2 text-xs text-white/82">
                          {genre}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-5">

                    <div className="grid gap-3 sm:grid-cols-4">
                      <Card className="theme-subpanel border-none bg-transparent text-white"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Score</p><p className="mt-2 font-display text-3xl font-black">{detailMedia.averageScore ?? "—"}</p></CardContent></Card>
                      <Card className="theme-subpanel border-none bg-transparent text-white"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Année</p><p className="mt-2 font-display text-3xl font-black">{detailMedia.seasonYear ?? "—"}</p></CardContent></Card>
                      <Card className="theme-subpanel border-none bg-transparent text-white"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Épisodes</p><p className="mt-2 font-display text-3xl font-black">{detailMedia.episodes ?? "—"}</p></CardContent></Card>
                      <Card className="theme-subpanel border-none bg-transparent text-white"><CardContent className="p-4"><p className="text-[11px] uppercase tracking-[0.24em] text-white/50">Ma Note</p><div className="mt-4"><StarRating initialRating={ratings[detailMedia.id] || 0} onRate={(r) => rateAnime(detailMedia.id, r)} /></div></CardContent></Card>
                    </div>


                    <Card className="theme-subpanel border-none bg-transparent text-white" data-testid="catalog-detail-copy-card">
                      <CardContent className="space-y-4 p-5">
                        <p className="text-[11px] uppercase tracking-[0.28em] text-white/50">Synopsis</p>
                        <p className="text-sm leading-8 text-white/76">{showTranslatedCards ? translatedMediaDescription(detailMedia) : mediaDescription(detailMedia)}</p>
                        <div className="flex flex-wrap gap-2">
                          <Button type="button" className="btn-neon-rainbow rounded-full text-white" onClick={() => { activatePlayer(detailMedia, { forceFavorite: true, unlockSound: true }); setDetailMedia(null); }} data-testid="catalog-detail-launch-button">
                            <Play className="h-4 w-4" /> Lancer sur l’écran géant
                          </Button>
                          <Button type="button" variant="glass" className="rounded-full text-white" onClick={() => toggleFavorite(detailMedia)} data-testid="catalog-detail-favorite-button">
                            <Heart className={`h-4 w-4 ${favoriteIds.includes(detailMedia.id) ? "fill-current" : ""}`} />
                            {favoriteIds.includes(detailMedia.id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>

        <NeonFooterBar />
      </main>
    </>
  );
}
