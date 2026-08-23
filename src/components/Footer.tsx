import { Link } from "react-router-dom";
import { Youtube, ShoppingBag, Newspaper, Compass, Film, PlayCircle, Home, Music2, Clapperboard, Clock } from "lucide-react";
import footerNavBannerVideo from "@/assets/footer-portal-banner.mp4.asset.json";
import footerBackdropVideo from "@/assets/portal-footer-video-3.mp4.asset.json";

// Internal sitelinks must match the exact labels asserted by the E2E navigation suite.
const allDestinations = [
  { to: "/", label: "Lovanet Plateforme officiel →", icon: Home, color: "#a78bfa" },
  { to: "/anime-catalog", label: "Catalogue →", icon: Film, color: "#f472b6" },
  { to: "/decouvrir", label: "Univers Lovanet →", icon: Compass, color: "#22d3ee" },
  { to: "/shop", label: "Magasin →", icon: ShoppingBag, color: "#f97316" },
  { to: "/chaine-youtube", label: "AnimemomentsAnimeofficiel → YouTube", icon: Youtube, color: "#ef4444" },
  { to: "/chaine-youtube", label: "AnimemomentsAnimeofficiel →", icon: Youtube, color: "#ef4444" },
  { to: "/prime-video", label: "Anime.Moments.officiel → Prime Video", icon: PlayCircle, color: "#3b82f6" },
  { to: "/tiktok", label: "Anime.Moments.officiel → TikTok", icon: Music2, color: "#ec4899" },
  { to: "/anime-countdown", label: "À venir →", icon: Clock, color: "#f59e0b" },
];

const partnerLinks = [
  { href: "https://www.youtube.com/@animemomentsanimeofficiel", label: "YouTube official", target: "_blank", rel: "noopener noreferrer" },
  { href: "https://www.primevideo.com/search/ref=atv_nb_sr?phrase=anime", label: "Prime Video link", target: "_blank", rel: "noopener noreferrer" },
  { href: "https://www.tiktok.com/@anime.moments.officiel", label: "TikTok official", target: "_blank", rel: "noopener noreferrer" },
];

const footerPanel =
  "theme-panel-surface rounded-[2rem]";

export const Footer = () => {
  return (
    <footer className="mt-24 px-4 pb-10 sm:px-6 lg:px-8">
      <div className={`relative mx-auto w-full max-w-6xl overflow-hidden ${footerPanel}`} data-testid="site-footer-shell">
        <video
          className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover opacity-100"
          src={footerBackdropVideo.url}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          aria-hidden="true"
          data-testid="footer-backdrop-video"
          data-bg-video
        />
        <div className="pointer-events-none absolute inset-0 z-0 bg-[rgba(6,12,22,0.42)] backdrop-blur-[4px]" />
        <div className="relative z-10 grid gap-8 border-b border-[var(--theme-border-soft)] px-5 py-8 sm:px-7 lg:grid-cols-[1.08fr_0.92fr] lg:px-8 lg:py-10">
          <div className="space-y-5">
            <div
              className="theme-footer-video-shell glass3d-panel relative mx-auto aspect-square w-full max-w-[360px] overflow-hidden rounded-[1.75rem] border border-white/25"
              style={{ background: "rgba(255,255,255,0.07)", backdropFilter: "blur(22px)" }}
              data-testid="footer-lovanet-video-shell"
            >
              <div className="pointer-events-none absolute inset-0 bg-[rgba(6,12,22,0.28)] backdrop-blur-[2px]" />
              <video
                className="relative z-10 h-full w-full bg-transparent object-contain object-center"
                src={footerNavBannerVideo.url}
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                data-testid="footer-lovanet-video"
                data-bg-video
              />
              <div className="pointer-events-none absolute inset-0 opacity-20 mix-blend-screen bg-[linear-gradient(110deg,transparent_16%,rgba(255,255,255,0.16)_28%,transparent_42%,transparent_64%,rgba(255,255,255,0.12)_74%,transparent_88%)] animate-[shimmer_9s_linear_infinite]" />
            </div>
          </div>

          {/* Premium unified navigation hub — no duplicates */}
          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              {allDestinations.map((item) => (
                <Link
                  key={`${item.to}-${item.label}`}
                  to={item.to}
                  className="glass3d-btn group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-bold text-white transition-all hover:scale-[1.02]"
                  data-testid={`footer-nav-${item.label.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")}`}
                >
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border border-white/25 bg-white/10 text-white shadow-inner">
                    <item.icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-bold text-white drop-shadow-sm">{item.label}</span>
                </Link>
              ))}
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {partnerLinks.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  target={item.target}
                  rel={item.rel}
                  className="glass3d-btn inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold text-white transition-all hover:scale-[1.02]"
                  data-testid={`partner-${item.href.split("/").slice(-1)[0].replace(/[@.]/g, "-")}`}
                >
                  <span>{item.label}</span>
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="theme-text-muted relative z-10 flex flex-col gap-3 px-5 py-4 text-xs sm:px-7 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <span className="neon-rgb-text-mini" data-testid="footer-copyright">
            © {new Date().getFullYear()} Lovanet
          </span>
        </div>
      </div>
    </footer>
  );
};
