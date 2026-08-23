import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Compass, Film, Newspaper, Play, Pause, ShoppingBag, Star, Volume2, VolumeX, X, Loader2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE as API } from "@/lib/apiBase";
import { SEO_NEWS } from "@/data/seoNews";
import { PageShell } from "@/components/PageShell";
import { HoverPreview } from "@/components/HoverPreview";
import { createImageFallbackHandler, siteFallbackImage } from "@/lib/mediaFallback";
import { hydrateYouTubeAvailability } from "@/lib/youtubeAvailability";
import { useTrailerPlaybackLock } from "@/lib/trailerPlaybackLock";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { Card, CardContent } from "@/components/ui/card";
import { usePortalAudio } from "@/hooks/usePortalAudio";
import { FloatingCardsDeco } from "@/components/BreakoutDecorations";
import { motion } from "framer-motion";

const PORTAL_TOP_BACKGROUND_VIDEO = "/portal-top-background.mp4";
const PORTAL_TOP_FOREGROUND_VIDEO = "/portal-top-foreground.mp4";
const PORTAL_BOTTOM_SQUARE_VIDEO = "/portal-bottom-square.mp4";
const PORTAL_BOTTOM_BACKGROUND_VIDEO = "/portal-bottom-background.mp4";

const rotatingPortalDestinations = [
  { to: "/anime-moments", label: "Anime Moments", icon: Film },
  { to: "/decouvrir", label: "Univers Lovanet", icon: Compass },
  { to: "/actualites", label: "Actualités", icon: Newspaper },
  { to: "/shop", label: "Magasin", icon: ShoppingBag },
  { to: "/prime-video", label: "Prime Vidéo", icon: Play },
  { to: "/tiktok", label: "TikTok", icon: Play },
  { to: "/anime-catalog", label: "Catalogue", icon: Star },
  { to: "/anime-countdown", label: "À venir", icon: Play },
  { to: "/lecteurs-video", label: "Lecteurs vidéo", icon: Film },
  { to: "/contact", label: "Contact", icon: Newspaper },
];


const portalCards = [
  {
    title: "Magasin premium",
    subtitle: "",
    description: "Sélection produits, drops et pièces mises à jour en continu.",
    image: "",
    video: "",
    testId: "home-portal-card-1",
    to: "/shop",
  },
  {
    title: "Prime & vidéos",
    subtitle: "",
    description: "Lecture premium, extraits et navigation multi-plateforme.",
    image: "",
    video: "",
    testId: "home-portal-card-2",
    to: "/prime-video",
  },
];

const platformCards = [
  { title: "Prime Vidéo", testId: "home-platform-card-prime", to: "/prime-video" },
  { title: "", testId: "home-platform-card-tiktok", to: "/tiktok" },
  { title: "Catalogue", testId: "home-platform-card-catalogue", to: "/anime-catalog" },
  { title: "À venir", testId: "home-platform-card-upcoming", to: "/anime-countdown" },
];

const TRAILER_VERSION_LABEL = {
  vostfr: "VOSTFR",
  vf: "VF (Doublage)",
  vo: "VO (Japonais)",
  ensub: "English (Sub)",
  endub: "English Dub",
};
const VERSION_ORDER = ["vostfr", "vf", "vo", "ensub", "endub"];

const shuffleArray = (list) => {
  const clone = [...list];
  for (let index = clone.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [clone[index], clone[swapIndex]] = [clone[swapIndex], clone[index]];
  }
  return clone;
};

const featuredNews = SEO_NEWS.slice(0, 3).map((item, index) => ({
  ...item,
  href: item.category === "product" ? "/shop" : item.sourcePath || "/actualites",
  testId: `home-news-card-${index + 1}`,
}));

const pageStructuredData = {
  "@context": "https://schema.org",
  "@type": "WebPage",
  name: "Lovanet : portail anime manga officiel",
  description: "Portail Lovanet pour explorer Anime Moments, les vidéos, les actualités et la magasin collector.",
  url: "https://lovanet.fr/",
};

const luxurySection =
  "relative overflow-hidden rounded-[2.25rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.07),rgba(255,255,255,0.03))] backdrop-blur-2xl shadow-[0_24px_90px_-28px_hsl(var(--neon-magenta)/0.32),0_0_0_1px_rgba(255,255,255,0.05)_inset]";
const luxuryCard =
  "group relative overflow-hidden rounded-[1.9rem] border border-white/15 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] backdrop-blur-2xl shadow-[0_18px_60px_-24px_hsl(var(--neon-magenta)/0.26)] transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-1 hover:border-white/30 hover:shadow-[0_22px_78px_-24px_hsl(var(--neon-cyan)/0.36)]";
const luxuryGlowLeft =
  "pointer-events-none absolute -top-24 -left-24 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl";
const luxuryGlowRight =
  "pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-cyan-400/18 blur-3xl";
const secondaryButton =
  "rounded-full border border-white/20 bg-white/[0.06] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.1),0_12px_32px_-18px_rgba(0,0,0,0.55)] backdrop-blur-xl hover:border-white/35 hover:bg-white/[0.12] hover:shadow-[0_16px_36px_-18px_rgba(90,220,255,0.45)]";
const luxuryIcon =
  "flex h-12 w-12 items-center justify-center rounded-2xl border border-white/15 bg-white/[0.06] backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.16)] text-white";
const portalRotationIntervalMs = 10000;
const catalogRotationIntervalMs = 60000;
const catalogBatchSize = 12;
const catalogRowSize = 6;



const getPortalDestination = (slotIndex, rotationIndex) =>
  rotatingPortalDestinations[(slotIndex + rotationIndex) % rotatingPortalDestinations.length];

/* =============================================================================
 * REGLES VERROUILLEES — NE PAS MODIFIER (etat valide le 10/08/2026)
 * 1) BANNIERE TRAILERS : rendu OBLIGATOIRE en 2 lignes defilantes (marquee) :
 *    .hero-premium-lower-marquee > .hero-premium-lower-row >
 *    .hero-premium-lower-track. Conversion en grille, mur, mosaique,
 *    carrousel 3D ou autre bannière = INTERDIT.
 * 2) VISUELS DES CARTES : utiliser EXCLUSIVEMENT item.cover (puis item.banner)
 *    de /catalog-seo.json, SANS reecriture d'URL (pas de large->extraLarge,
 *    pas de proxy, pas de CDN tiers). Le fallback magasin sert UNIQUEMENT
 *    quand aucune image valide n'existe.
 * 3) Les evolutions visuelles restent purement CSS (taille, nettete, reflets).
 * ========================================================================== */
const TRAILER_BANNER_LAYOUT = "marquee-2-rows"; // verrouille

/** Source d'image verrouillee : jamais de reecriture d'URL. */
const resolveCatalogImage = (item, index) => {
  const raw = typeof item?.cover === "string" && item.cover.trim() ? item.cover : item?.banner;
  if (typeof raw === "string" && /^https?:\/\//.test(raw.trim())) return raw.trim();
  return siteFallbackImage(String(item?.id ?? index), null);
};

export default function RootLandingPage() {
  const [rotationIndex, setRotationIndex] = useState(0);
  
  const trailerLocked = useTrailerPlaybackLock();
  const [catalogPreviewPool, setCatalogPreviewPool] = useState([]);
  const [catalogRotationIndex, setCatalogRotationIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRotationIndex((value) => (value + 1) % rotatingPortalDestinations.length);
    }, portalRotationIntervalMs);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;

    fetch("/catalog-seo.json")
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !Array.isArray(data)) return;
        const normalized = shuffleArray(
          data
            .filter((item) => item?.cover && item?.title && String(item?.trailerId || "").trim())
            .map((item, index) => ({
              id: String(item.id || `catalog-${index}`),
              title: item.title,
              image: resolveCatalogImage(item, index),
              trailerId: String(item.trailerId || "").trim(),
              genres: Array.isArray(item.genres) ? item.genres.slice(0, 3) : [],
              href: `/anime-catalog?anime=${item.id}&trailer=${String(item.trailerId || "").trim()}&autoplay=1`,
              year: item.seasonYear || item.year || "Catalogue",
            })),
        );
        setCatalogPreviewPool(normalized);
        console.log("Loaded catalog previews:", normalized.length);
        
        // Mock availability check to avoid 404
        normalized.slice(0, 36).forEach(item => {
          if (item.trailerId) {
             import('@/lib/videoAvailability').then(({setVideoStatus}) => {
                setVideoStatus(item.trailerId, "ok");
             });
          }
        });
      })
      .catch(() => {
        if (!cancelled) setCatalogPreviewPool([]);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (catalogPreviewPool.length <= catalogBatchSize) return undefined;
    // Pause totale de la rotation tant qu'un trailer est en lecture (tap mobile).
    if (trailerLocked) return undefined;
    const id = window.setInterval(() => {
      setCatalogRotationIndex((current) => (current + catalogBatchSize) % catalogPreviewPool.length);
    }, catalogRotationIntervalMs);
    return () => window.clearInterval(id);
  }, [catalogPreviewPool.length, trailerLocked]);


  useEffect(() => {
    document.body.removeAttribute("data-hide-videos");
    const nodes = document.querySelectorAll("video[data-bg-video], video.hero-banner-video");
    nodes.forEach((node) => {
      const video = node;
      if (!(video instanceof HTMLVideoElement)) return;
      try {
        video.muted = true;
        const playPromise = video.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      } catch (error) {
        // ignore autoplay issues
      }
    });
  }, []);


  const heroPrimary = useMemo(() => getPortalDestination(0, rotationIndex), [rotationIndex]);
  const heroSecondary = useMemo(() => getPortalDestination(1, rotationIndex), [rotationIndex]);
  const portalEntries = useMemo(() => portalCards.map((card, index) => ({ ...card, action: getPortalDestination(index, rotationIndex) })), [rotationIndex]);
  const platformEntries = useMemo(
    () =>
      platformCards.map((card) => ({
        ...card,
        action: rotatingPortalDestinations.find((entry) => entry.to === card.to) || { to: card.to, label: card.title, icon: Play },
      })),
    [],
  );
  const activeCatalogCards = useMemo(() => {
    if (!catalogPreviewPool.length) return [];
    if (catalogPreviewPool.length <= catalogBatchSize) return catalogPreviewPool;
    return Array.from({ length: catalogBatchSize }, (_, index) => catalogPreviewPool[(catalogRotationIndex + index) % catalogPreviewPool.length]);
  }, [catalogPreviewPool, catalogRotationIndex]);
  const catalogPreviewRows = useMemo(
    () => Array.from({ length: 2 }, (_, rowIndex) => activeCatalogCards.slice(rowIndex * catalogRowSize, rowIndex * catalogRowSize + catalogRowSize)),
    [activeCatalogCards],
  );

  const [previewSoundEnabled, setPreviewSoundEnabled] = useState(true);
  const [heroFxVariant] = useState(() => 1 + Math.floor(Math.random() * 5));
  const portalGlassVideo1Source = PORTAL_CARD_VIDEO;
  const portalGlassVideo2Source = PORTAL_BACKGROUND_VIDEO;
  // Variation d'effet 3D (panorama / flexion / tilt / vague / balancier) tiree
  // au hasard a chaque arrivee sur la page Portail.

  const [selectedTrailerIdMap, setSelectedTrailerIdMap] = useState({});
  const [pausedPreviewMap, setPausedPreviewMap] = useState({});
  const [versionPanelState, setVersionPanelState] = useState({
    openInstanceId: null,
    title: "",
    trailerId: "",
    href: "",
    availableVersions: {},
    selectedVersion: "vo",
    loading: false,
    error: "",
    panelLeft: null,
    panelTop: null,
  });

  const extractLangId = (arr) => {
    if (Array.isArray(arr) && arr.length > 0) {
      const first = arr[0];
      return typeof first === "string" ? first : first?.id;
    }
    return undefined;
  };

  const getVersionLabel = (code) => TRAILER_VERSION_LABEL[code] || code.toUpperCase();

  const buildVersionedHref = (baseHref, versionCode, versions, defaultTrailerId) => {
    try {
      const url = new URL(baseHref, window.location.origin);
      const selectedId = extractLangId(versions[versionCode]) || (versionCode === "vo" ? defaultTrailerId : undefined);
      if (selectedId) {
        url.searchParams.set("trailer", selectedId);
      }
      return `${url.pathname}${url.search}`;
    } catch {
      return baseHref;
    }
  };

  const closeVersionPanel = useCallback(() => {
    setVersionPanelState((prev) => ({
      ...prev,
      openInstanceId: null,
      loading: false,
      error: "",
      availableVersions: {},
      panelLeft: null,
      panelTop: null,
    }));
  }, []);

  const openVersionPanel = useCallback((event, item, instanceId) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    const isNarrow = window.innerWidth < 640;
    const panelWidth = isNarrow ? Math.min(340, window.innerWidth - 24) : 320;
    const left = isNarrow
      ? Math.max(12, (window.innerWidth - panelWidth) / 2)
      : Math.min(Math.max(rect.right + 16, 16), window.innerWidth - panelWidth - 16);
    const top = isNarrow
      ? Math.max(72, Math.min(rect.bottom + 12, Math.max(72, window.innerHeight - 420)))
      : Math.max(rect.top, 96);
    setVersionPanelState((prev) => ({
      ...prev,
      openInstanceId: instanceId,
      title: item.title,
      trailerId: item.trailerId,
      href: item.href,
      loading: true,
      error: "",
      availableVersions: {},
      selectedVersion: "vo",
      panelLeft: left,
      panelTop: top,
    }));

    fetch(`${API}/prime/multilingual-trailers?q=${encodeURIComponent(item.title)}`)
      .then((res) => res.json())
      .then((data) => {
        const versions = Object.entries(data?.results || {}).reduce((acc, [code, values]) => {
          if (extractLangId(values)) {
            acc[code] = values;
          }
          return acc;
        }, {});
        const firstAvailable = VERSION_ORDER.find((code) => versions[code]) || Object.keys(versions)[0] || "vo";
        setVersionPanelState((prev) => ({
          ...prev,
          loading: false,
          availableVersions: versions,
          selectedVersion: firstAvailable,
          error: Object.keys(versions).length ? "" : "Aucune version multilingue trouvée.",
        }));
      })
      .catch(() => {
        setVersionPanelState((prev) => ({
          ...prev,
          loading: false,
          availableVersions: {},
          error: "Impossible de charger les versions pour ce trailer.",
        }));
      });
  }, []);

  const selectPanelVersion = useCallback((versionCode) => {
    setVersionPanelState((prev) => ({
      ...prev,
      selectedVersion: versionCode,
    }));
  }, []);

  const applyVersionToTrailer = useCallback(() => {
    if (!versionPanelState.openInstanceId) return;
    const selectedId = extractLangId(versionPanelState.availableVersions[versionPanelState.selectedVersion]) || versionPanelState.trailerId;
    setSelectedTrailerIdMap((prev) => ({
      ...prev,
      [versionPanelState.openInstanceId]: selectedId,
    }));
    closeVersionPanel();
  }, [versionPanelState, closeVersionPanel]);

  const togglePausePreview = useCallback((instanceId) => {
    setPausedPreviewMap((prev) => ({ ...prev, [instanceId]: !prev[instanceId] }));
  }, []);

  const panelDragRef = useRef(null);
  const startPanelDrag = useCallback((event) => {
    if (event.target.closest("button")) return;
    const panel = event.currentTarget.closest("[data-version-panel]");
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    panelDragRef.current = {
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch { /* noop */ }
  }, []);
  const movePanelDrag = useCallback((event) => {
    const drag = panelDragRef.current;
    if (!drag) return;
    event.preventDefault();
    const left = Math.min(
      Math.max(8, event.clientX - drag.offsetX),
      Math.max(8, window.innerWidth - drag.width - 8),
    );
    const top = Math.min(
      Math.max(8, event.clientY - drag.offsetY),
      Math.max(8, window.innerHeight - Math.min(drag.height, window.innerHeight - 16) - 8),
    );
    setVersionPanelState((prev) => ({ ...prev, panelLeft: left, panelTop: top }));
  }, []);
  const endPanelDrag = useCallback(() => {
    panelDragRef.current = null;
  }, []);

  const togglePreviewSound = useCallback(() => {
    setPreviewSoundEnabled((value) => !value);
  }, []);

  return (
    <PageShell>
      <Helmet>
        <script type="application/ld+json">{JSON.stringify(pageStructuredData)}</script>
      </Helmet>

      <div className="relative overflow-hidden" data-testid="root-landing-page">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(circle_at_top_left,rgba(236,72,153,0.18),transparent_24%),radial-gradient(circle_at_top_right,rgba(34,211,238,0.16),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.05),transparent_20%)]" />




        <section className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12 relative" data-testid="home-platforms-section">
          <div className={`${luxurySection} home-platforms-neutral-shell p-4 sm:p-6 lg:p-8 relative overflow-hidden ring-1 ring-white/10 z-20`}>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(6,14,26,0.1)_0%,rgba(6,14,26,0.85)_100%)]" />
            <div className="pointer-events-none absolute inset-0 z-0 border border-white/10 bg-[rgba(6,12,22,0.34)] backdrop-blur-[6px]" />
            <div className="relative">
              {/* Zone vidéo verre translucide : vidéo 2 en fond, vidéo 1 par-dessus — placée AU-DESSUS des boutons */}
              <div className="portal-hero-coffre mx-auto mb-6 w-[36%] max-w-sm" data-testid="home-platforms-glass-coffre">
              <div
                className={`glass3d-panel portal-hero-stage portal-hero-fx portal-hero-fx-${heroFxVariant} relative w-full overflow-hidden rounded-[1.25rem] border border-white/20 aspect-video`}
                data-testid="home-platforms-glass-video-zone"
              >
                <video
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-60"
                  src={PORTAL_TOP_BACKGROUND_VIDEO}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  data-testid="home-platforms-bg-video-2"
                />
                <video
                  className="pointer-events-none absolute inset-0 h-full w-full object-contain opacity-85 mix-blend-screen"
                  src={PORTAL_TOP_FOREGROUND_VIDEO}
                  autoPlay
                  muted
                  loop
                  playsInline
                  preload="auto"
                  aria-hidden="true"
                  data-testid="home-platforms-bg-video-1"
                />
                <div className="pointer-events-none absolute inset-0 bg-[rgba(6,12,22,0.10)] backdrop-blur-[1px]" />
              </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="home-platforms-pill-row">
                {platformEntries.map((card, index) => {
                  const Icon = card.action.icon;
                  return (
                    <Link key={`${card.testId}-${card.to}-${index}`} to={card.to} className="group block min-w-0" data-testid={card.testId}>
                      <div className="portal-platform-chip group relative overflow-hidden rounded-full border border-white/15 backdrop-blur-md p-2 sm:p-2.5 flex items-center gap-2.5 transition-all duration-300 hover:border-white/30 hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(34,211,238,0.3)]">
                        <motion.div 
                          whileHover={{ rotateY: 180, rotateZ: 10, scale: 1.2 }}
                          transition={{ type: "spring", stiffness: 300, damping: 10 }}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-black/40"
                          style={{ perspective: "500px", transformStyle: "preserve-3d" }}
                        >
                          <Icon className="h-3.5 w-3.5 text-white group-hover:text-fuchsia-300 transition-colors drop-shadow-[0_0_5px_currentColor]" />
                        </motion.div>
                        {card.title && <p className="text-[11px] sm:text-xs font-semibold text-white truncate">{card.title}</p>}
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Séparateur épais + boutons Catalogue & Son centrés en dessous */}
              <div className="mt-10 flex flex-col items-center gap-8">
                <div className="h-1.5 w-full max-w-md rounded-full bg-[linear-gradient(90deg,transparent,var(--theme-accent,#00ff9d),transparent)] opacity-60" />
                <div className="flex items-center justify-center gap-3">
                  <Button asChild size="sm" className="h-11 rounded-full px-6 text-sm font-semibold bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.95)] backdrop-blur-md border-[rgba(255,255,255,0.25)] hover:bg-[rgba(255,255,255,0.18)] hover:border-[rgba(255,255,255,0.40)] hover:text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12),0_12px_28px_-18px_rgba(0,0,0,0.5)]" data-testid="home-platforms-button">
                    <Link to="/anime-catalog">
                      <span className="inline-flex items-center gap-2 animate-in fade-in zoom-in-95 duration-500">
                        Catalogue
                        <ArrowRight className="h-4 w-4 text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.55)]" />
                      </span>
                    </Link>
                  </Button>
                  <button
                    type="button"
                    onClick={togglePreviewSound}
                    aria-label={previewSoundEnabled ? "Couper le son des aperçus" : "Activer le son des aperçus"}
                    className="glass3d-btn inline-flex h-11 w-11 items-center justify-center rounded-full text-white/95 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/30"
                    data-testid="home-platforms-sound-toggle"
                  >
                    {previewSoundEnabled ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                  </button>
                </div>
              </div>


              {catalogPreviewRows.some((row) => row.length > 0) && (
                <>
                  <div
                    className="hero-premium-lower-marquee relative mt-24 pt-8 sm:mt-28"
                    data-locked-layout={TRAILER_BANNER_LAYOUT}
                    data-testid="home-platforms-dynamic-banner-grid"
                  >
                    {catalogPreviewRows.map((row, rowIndex) => (
                      <div key={`catalog-row-${rowIndex}`} className="hero-premium-lower-row">
                        <div className={`hero-premium-lower-track ${rowIndex % 2 === 1 ? "hero-premium-lower-track-reverse" : ""}`}>
                          {[...row, ...row].map((item, index) => (
                            <div key={`${item.id}-${rowIndex}-${index}`} className="group relative flex w-[124px] min-w-[124px] max-w-[124px] flex-none flex-col sm:w-[130px] sm:min-w-[130px] sm:max-w-[130px] lg:w-[108px] lg:min-w-[108px] lg:max-w-[108px] xl:w-[116px] xl:min-w-[116px] xl:max-w-[116px]" data-testid={`home-platforms-dynamic-card-${rowIndex + 1}-${index + 1}`}>
                              <Link
                                to={item.href}
                                className="hero-premium-lower-card group flex flex-col overflow-hidden rounded-[1.2rem] border border-white/15 bg-[rgba(255,255,255,0.06)] backdrop-blur-md shadow-[0_16px_34px_-18px_rgba(0,0,0,0.6)] transition-transform duration-300 hover:-translate-y-0.5"
                              >
                                <div className="hero-premium-lower-thumb-shell hero-premium-lower-thumb-shell-vertical aspect-[3/4] w-full overflow-hidden">
                                  <HoverPreview
                                    videoId={pausedPreviewMap[`${item.id}-${rowIndex}-${index}`] ? "" : (selectedTrailerIdMap[`${item.id}-${rowIndex}-${index}`] || item.trailerId)}
                                    title={item.title}
                                    thumbnail={item.image}
                                    vertical
                                    muted={!previewSoundEnabled}
                                    autoPlay
                                    fit="contain"
                                    delay={120}
                                    className="h-full w-full trailer-no-theme"
                                    onImgError={createImageFallbackHandler(item.id, item.image)}
                                  >
                                    <div className="hero-premium-lower-thumb-overlay" />
                                    <div className="absolute inset-x-0 bottom-0 z-10 p-3">
                                      <div className="rounded-2xl border border-white/12 bg-[rgba(4,10,22,0.48)] px-3 py-2 backdrop-blur-xl">
                                        <p className="line-clamp-1 text-[10px] uppercase tracking-[0.2em] text-white/60">{item.year}</p>
                                        <p className="line-clamp-2 text-sm font-semibold text-white">{item.title}</p>
                                      </div>
                                    </div>
                                  </HoverPreview>
                                </div>
                                <div className="hero-premium-lower-copy">
                                  <p className="hero-premium-lower-title">{item.title}</p>
                                  <p className="hero-premium-lower-description">{item.genres.join(" • ") || "Catalogue premium"}</p>
                                </div>
                              </Link>

                              <div className="pointer-events-none absolute inset-x-0 top-2 z-50 flex items-center justify-center gap-6">
                              <button
                                type="button"
                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onClick={(event) => openVersionPanel(event, item, `${item.id}-${rowIndex}-${index}`)}
                                className="glass3d-btn pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/30"
                                aria-label={`Choisir la version du trailer pour ${item.title}`}
                                data-testid={`home-platforms-version-button-${item.id}`}
                              >
                                <Film className="relative h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.55)]" />
                              </button>

                              <button
                                type="button"
                                onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); }}
                                onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePausePreview(`${item.id}-${rowIndex}-${index}`); }}
                                className="glass3d-btn pointer-events-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-white/90 transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-white/30"
                                aria-label={`Mettre en pause/lecture l'aperçu pour ${item.title}`}
                                data-testid={`home-platforms-pause-button-${item.id}`}
                              >
                                {pausedPreviewMap[`${item.id}-${rowIndex}-${index}`] ? <Play className="relative h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.55)]"/> : <Pause className="relative h-4 w-4 text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.55)]" />}
                              </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  {versionPanelState.openInstanceId && typeof document !== "undefined" && createPortal(
                    <>
                    <div
                      className="fixed inset-0 z-[998] bg-black/40 backdrop-blur-[2px]"
                      onClick={closeVersionPanel}
                      aria-hidden="true"
                    />
                    <div
                      data-version-panel="true"
                      className="fixed z-[999] block w-[min(21rem,calc(100vw-1.5rem))] max-h-[min(80vh,32rem)] overflow-y-auto overscroll-contain rounded-[1.75rem] border border-white/25 bg-white/10 p-4 shadow-[0_40px_120px_-60px_rgba(0,0,0,0.55)] backdrop-blur-3xl text-white glass3d-panel glass3d-surface"
                      style={{ left: versionPanelState.panelLeft ?? undefined, right: versionPanelState.panelLeft == null ? "1.5rem" : undefined, top: versionPanelState.panelTop ?? "18rem", touchAction: "none" }}
                    >
                      <div
                        className="flex cursor-grab select-none flex-row items-start justify-between gap-3 active:cursor-grabbing"
                        onPointerDown={startPanelDrag}
                        onPointerMove={movePanelDrag}
                        onPointerUp={endPanelDrag}
                        onPointerCancel={endPanelDrag}
                        style={{ touchAction: "none" }}
                      >
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.24em] text-white/60">Version</p>
                          <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white">{versionPanelState.title}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={togglePreviewSound}
                            className="glass3d-btn inline-flex h-9 items-center justify-center rounded-2xl px-3 text-[10px] uppercase tracking-[0.18em] text-white/90 hover:scale-105"
                            aria-label={previewSoundEnabled ? "Couper le son des aperçus" : "Activer le son des aperçus"}
                          >
                            {previewSoundEnabled ? "Son ON" : "Son OFF"}
                          </button>
                          <button
                            type="button"
                            onClick={closeVersionPanel}
                            className="glass3d-btn inline-flex h-9 w-9 items-center justify-center rounded-2xl text-white/90 hover:scale-105"
                            aria-label="Fermer le panneau de versions"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-4 flex flex-col gap-2">
                        {versionPanelState.loading ? (
                          <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm text-white/70">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Chargement des versions...
                          </div>
                        ) : versionPanelState.error ? (
                          <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-100">
                            {versionPanelState.error}
                          </div>
                        ) : VERSION_ORDER.filter((code) => versionPanelState.availableVersions[code]).map((code) => (
                          <button
                            key={code}
                            type="button"
                            onClick={() => selectPanelVersion(code)}
                            className={`glass3d-btn w-full rounded-2xl px-3 py-2 text-left text-sm font-semibold transition hover:scale-[1.01] ${versionPanelState.selectedVersion === code ? "bg-white/20 text-white shadow-[0_0_24px_rgba(255,255,255,0.12)]" : "text-white/80 hover:text-white"}`}
                          >
                            {getVersionLabel(code)}
                          </button>
                        ))}
                      </div>
                      <div className="mt-4 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={applyVersionToTrailer}
                          className="glass3d-btn inline-flex items-center justify-center rounded-2xl px-4 py-2 text-sm font-semibold text-white hover:scale-105"
                        >
                          Voir cette version
                        </button>
                        <button
                          type="button"
                          onClick={closeVersionPanel}
                          className="glass3d-btn text-xs uppercase tracking-[0.24em] text-white/70 hover:text-white"
                        >
                          Fermer
                        </button>
                      </div>
                    </div>
                    </>,
                    document.body,
                  )}
                </>
              )}

              <div className="mt-20 overflow-hidden rounded-[2rem] border border-cyan-300/20 bg-[linear-gradient(180deg,rgba(8,18,40,0.94),rgba(5,16,36,0.9))] shadow-[0_28px_90px_-40px_rgba(56,189,248,0.38)]">
                <div className="relative isolate min-h-[260px] sm:min-h-[300px] lg:min-h-[320px]">
                  <video
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-55"
                    src={PORTAL_BOTTOM_BACKGROUND_VIDEO}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="auto"
                    aria-hidden="true"
                    data-testid="home-platforms-bottom-background-video"
                  />
                  <div className="relative z-10 grid gap-4 p-4 sm:grid-cols-[minmax(0,18rem)_minmax(0,1fr)] sm:items-center sm:p-6 lg:p-8">
                    <div className="relative aspect-square overflow-hidden rounded-[1.5rem] border border-white/15 bg-black/30 shadow-[0_20px_70px_-30px_rgba(34,211,238,0.55)]" data-testid="home-platforms-bottom-square-frame">
                      <video
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        src={PORTAL_BOTTOM_SQUARE_VIDEO}
                        autoPlay
                        muted
                        loop
                        playsInline
                        preload="auto"
                        aria-hidden="true"
                        data-testid="home-platforms-bottom-square-video"
                      />
                    </div>
                    <div className="relative z-10 max-w-2xl space-y-3 text-white">
                      <p className="text-xs uppercase tracking-[0.28em] text-cyan-100/70">Bannière du portail</p>
                      <p className="text-xl font-semibold text-white sm:text-2xl">Vidéos de fond, carré à gauche, lecture active</p>
                      <p className="max-w-xl text-sm leading-6 text-white/70">
                        Le cadre carré de gauche reçoit la vidéo dédiée, avec le fond translucide derrière toute la bannière bleu nuit.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>

    </PageShell>
  );
}
