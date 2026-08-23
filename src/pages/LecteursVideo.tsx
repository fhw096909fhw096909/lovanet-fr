import { PageShell } from "@/components/PageShell";
import { Helmet } from "react-helmet-async";

const LECTEURS_VIDEO_TOP_VIDEO = "/actualites-banner.mp4";

const PRIMARY_SITE = "https://lovanet.fr";

const videoJsonLd = {
  "@context": "https://schema.org",
  "@type": "VideoObject",
  name: "Lecteur vidéo Lovanet — anime, manga et culture japonaise",
  description: "Regardez des extraits anime, trailers et vidéos manga en streaming sur Lovanet.",
  thumbnailUrl: `${PRIMARY_SITE}/lovanet-icon-512.png`,
  uploadDate: "2026-01-01T00:00:00+00:00",
  contentUrl: `${PRIMARY_SITE}/lecteurs-video`,
  embedUrl: `${PRIMARY_SITE}/lecteurs-video`,
  publisher: { "@type": "Organization", name: "Lovanet", logo: { "@type": "ImageObject", url: `${PRIMARY_SITE}/lovanet-icon-512.png` } },
};

/**
 * Page Lecteur vidéo — version épurée :
 * une seule bannière vidéo en haut de page, aucune autre bannière ni image.
 */
const LecteursVideo = () => (
  <PageShell>
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(videoJsonLd)}</script>
    </Helmet>
    <section className="container mx-auto px-4 lg:px-8 py-8 lg:py-10">
      <h1 className="sr-only">Lecteur vidéo Lovanet</h1>
      <div className="mx-auto max-w-[854px] overflow-hidden rounded-[2rem] border border-white/12 bg-black shadow-[0_28px_90px_-42px_rgba(56,189,248,0.6)]">
        <video
          src={LECTEURS_VIDEO_TOP_VIDEO}
          className="w-full h-auto block"
          style={{ aspectRatio: "854 / 480" }}
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-label="Bannière vidéo Lovanet"
        />
      </div>
    </section>
  </PageShell>
);

export default LecteursVideo;
