import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
const BACKGROUND_VIDEO_PLAYLIST = [
  "/premium-border-1.mp4",
  "/premium-border-2.mp4",
  "/premium-border-3.mp4",
  "/premium-border-4.mp4",
];

const Leaf = ({ delay, x, duration }) => (
  <motion.div
    initial={{ y: -20, x, rotate: 0, opacity: 0 }}
    animate={{ 
      y: ['0vh', '100vh'], 
      x: [x, x + 50, x - 50, x + 20], 
      rotate: [0, 180, 360],
      opacity: [0, 1, 1, 0]
    }}
    transition={{ duration, repeat: Infinity, delay, ease: "linear" }}
    className="absolute top-0 w-4 h-4 rounded-full bg-gradient-to-br from-green-300 to-emerald-400 blur-[1px] shadow-[0_0_10px_rgba(52,211,153,0.8)]"
    style={{ borderBottomRightRadius: '0px' }}
  />
);

const Particle = ({ color, duration, delay, x, y }) => (
  <motion.div
    initial={{ x, y, scale: 0, opacity: 0 }}
    animate={{ 
      y: [y, y - 100], 
      x: [x, x + (Math.random() * 40 - 20)],
      scale: [0, 1.5, 0],
      opacity: [0, 1, 0]
    }}
    transition={{ duration, repeat: Infinity, delay, ease: "easeInOut" }}
    className={`absolute w-2 h-2 rounded-full blur-[1px] shadow-[0_0_15px_currentColor] ${color} mix-blend-screen`}
  />
);

const Cloud = ({ delay, y, duration, scale }) => (
  <motion.div
    initial={{ x: '-10%', opacity: 0.2 }}
    animate={{ x: '110%', opacity: [0.3, 0.6, 0.3] }}
    transition={{ duration, repeat: Infinity, delay, ease: "linear" }}
    className="absolute bg-white/40 blur-xl rounded-full mix-blend-screen"
    style={{ top: y, width: 300 * scale, height: 100 * scale }}
  />
);

const resolveGoogleDriveVideoSource = (input) => {
  if (typeof input !== "string") return input;
  const match = input.match(/drive\.google\.com\/file\/d\/([^/]+)/);
  if (match?.[1]) return `https://drive.google.com/uc?export=download&id=${match[1]}`;
  return input;
};

const OVERLAY_BACKGROUND_VIDEOS = [
  {
    id: "global-bg",
    src: "/global-bg-browser.webm",
  },
  { id: "global-bg-web", src: "/global-bg-web.mp4" },
  { id: "global-bg-mobile", src: "/global-bg-mobile.mp4" },
];

const ORDERED_OVERLAY_VIDEO_IDS = OVERLAY_BACKGROUND_VIDEOS.map((video) => video.id);

export const PremiumBorders = () => {
  const [hidden, setHidden] = useState(() => document.body.hasAttribute("data-hide-decors"));
  const [customDecors, setCustomDecors] = useState(() => {
    if (document.body.hasAttribute("data-custom-decors")) return true;
    try {
      return localStorage.getItem("lovanet:custom-decors-enabled") === "1";
    } catch {
      return false;
    }
  });
  const [overlayQueue, setOverlayQueue] = useState([]);
  const [activeOverlayVideoId, setActiveOverlayVideoId] = useState(OVERLAY_BACKGROUND_VIDEOS[0]?.id || "");
  const overlayVideoRef = useRef(null);
  const [bgIndex, setBgIndex] = useState(0);
  const bgVideoRef = useRef(null);

  useEffect(() => {
    const video = bgVideoRef.current;
    if (!video) return undefined;
    video.muted = true;
    const p = video.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    return undefined;
  }, [bgIndex]);

  const activeOverlayVideo = OVERLAY_BACKGROUND_VIDEOS.find((video) => video.id === activeOverlayVideoId) || OVERLAY_BACKGROUND_VIDEOS[0];

  useEffect(() => {
    setOverlayQueue(ORDERED_OVERLAY_VIDEO_IDS);
    setActiveOverlayVideoId(ORDERED_OVERLAY_VIDEO_IDS[0] || OVERLAY_BACKGROUND_VIDEOS[0].id);
  }, []);

  useEffect(() => {
    if (!overlayQueue.length) return undefined;
    const video = overlayVideoRef.current;
    if (!video) return undefined;

    const playCurrentVideo = () => {
      video.pause();
      video.currentTime = 0;
      video.muted = true;
      video.load();
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    };

    playCurrentVideo();
    return undefined;
  }, [activeOverlayVideoId, overlayQueue.length]);

  // React to toggle changes via body attribute mutations
  useEffect(() => {
    const obs = new MutationObserver(() => {
      setHidden(document.body.hasAttribute("data-hide-decors"));
      setCustomDecors(document.body.hasAttribute("data-custom-decors"));
    });
    obs.observe(document.body, { attributes: true, attributeFilter: ["data-hide-decors", "data-custom-decors"] });
    return () => obs.disconnect();
  }, []);

  const leaves = useMemo(() => Array.from({ length: 20 }).map((_, i) => ({
    id: `leaf-${i}`,
    x: Math.random() * 100,
    delay: Math.random() * 10,
    duration: 10 + Math.random() * 10
  })), []);

  const particles = useMemo(() => Array.from({ length: 30 }).map((_, i) => ({
    id: `part-${i}`,
    x: Math.random() * 100,
    y: Math.random() * 100 + 50,
    delay: Math.random() * 5,
    duration: 3 + Math.random() * 4,
    color: i % 2 === 0 ? 'bg-cyan-300' : 'bg-fuchsia-300'
  })), []);

  // Always render the global background video so users can choose the full-page
  // video overlay independently from custom 3D decors. When `customDecors` is
  // active we avoid rendering the duplicated decorative particles/leaves.
  return (
    <div className="fixed inset-0 pointer-events-none z-[0] overflow-hidden" data-testid="global-video-background">
      {/* Global animated background (video) */}
      <video
        ref={bgVideoRef}
        key={BACKGROUND_VIDEO_PLAYLIST[bgIndex]}
        src={BACKGROUND_VIDEO_PLAYLIST[bgIndex]}
        aria-hidden="true"
        autoPlay
        muted
        playsInline
        preload="auto"
        decoding="async"
        disablePictureInPicture
        onEnded={() => setBgIndex((i) => (i + 1) % BACKGROUND_VIDEO_PLAYLIST.length)}
        onError={() => setBgIndex((i) => (i + 1) % BACKGROUND_VIDEO_PLAYLIST.length)}
        className="absolute inset-0 z-0 h-full w-full object-cover opacity-60"
        style={{ pointerEvents: 'none' }}
        data-bg-decor
        data-bg-video
      />

      {/* All animated décors hidden when toggle is active or when custom decors are used elsewhere */}
      {!hidden && !customDecors && (<div className="absolute inset-0 z-10" data-3d-decor data-animated-bg>
      {/* Ciel & Nuages (Haut) */}
      <div className="absolute top-0 left-0 right-0 h-[40vh] bg-gradient-to-b from-blue-600/30 via-indigo-600/10 to-transparent">
        <Cloud delay={0} y="5%" duration={40} scale={1} />
        <Cloud delay={15} y="15%" duration={55} scale={1.5} />
        <Cloud delay={5} y="10%" duration={45} scale={0.8} />
      </div>

      {/* Montagne, Marmottes & Ruisseau (Bord Gauche) */}
      <div className="absolute top-0 bottom-0 left-0 w-[15vw] min-w-[200px] border-r border-emerald-500/20 bg-[linear-gradient(90deg,rgba(16,185,129,0.15)_0%,transparent_100%)]">
        {/* Silhouette de montagne */}
        <div className="absolute top-1/4 left-10 w-64 h-96 bg-emerald-500/80 rounded-[100px] rotate-45 blur-sm shadow-[0_0_50px_rgba(16,185,129,0.4)]" />
        <div className="absolute top-1/2 left-20 w-48 h-72 bg-teal-400/80 rounded-[80px] -rotate-12 blur-sm shadow-[0_0_40px_rgba(45,212,191,0.4)]" />
        {/* Ruisseau animée */}
        <motion.div 
          animate={{ backgroundPosition: ['0% 0%', '0% 100%'] }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="absolute top-0 bottom-0 left-32 w-12 blur-sm mix-blend-screen opacity-90 shadow-[0_0_30px_rgba(56,189,248,0.8)]"
          style={{ backgroundImage: 'linear-gradient(180deg, transparent, #38bdf8, transparent)', backgroundSize: '100% 200%' }}
        />
        {/* Chutes de feuilles (Vent) */}
        {leaves.map(l => <Leaf key={l.id} {...l} x={`${l.x}%`} />)}
      </div>

      {/* Ville Cyberpunk & Jardin Public (Bord Droit) */}
      <div className="absolute top-0 bottom-0 right-0 w-[15vw] min-w-[200px] border-l border-fuchsia-500/20 bg-[linear-gradient(-90deg,rgba(236,72,153,0.15)_0%,transparent_100%)]">
        {/* Gratte-ciels (blocs) */}
        <div className="absolute bottom-0 right-4 w-32 h-[60vh] bg-indigo-600/80 rounded-t-3xl blur-sm shadow-[0_0_40px_rgba(79,70,229,0.5)]" />
        <div className="absolute bottom-0 right-20 w-24 h-[40vh] bg-fuchsia-600/80 rounded-t-2xl blur-sm shadow-[0_0_30px_rgba(217,70,239,0.5)]" />
        {/* Routes lumineuses (Trafic) */}
        <motion.div 
          animate={{ y: ['100vh', '-20vh'] }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute right-12 w-2 h-32 bg-gradient-to-t from-transparent via-cyan-300 to-transparent blur-none shadow-[0_0_20px_rgba(103,232,249,1)]"
        />
        <motion.div 
          animate={{ y: ['-20vh', '100vh'] }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear", delay: 1.5 }}
          className="absolute right-24 w-2 h-32 bg-gradient-to-b from-transparent via-pink-400 to-transparent blur-none shadow-[0_0_20px_rgba(244,114,182,1)]"
        />
        {/* Jardin public (particules d'énergie) */}
        <div className="absolute bottom-20 right-0 left-0 h-64 bg-emerald-500/50 blur-xl rounded-full mix-blend-screen" />
        {particles.map(p => <Particle key={p.id} {...p} x={`${p.x}%`} y={`${p.y}%`} />)}
      </div>

      {/* Herbes & Vent (Bas) */}
      <div className="absolute bottom-0 left-0 right-0 h-[20vh] bg-gradient-to-t from-green-700/60 to-transparent flex items-end justify-around overflow-hidden px-[10vw]">
        {Array.from({ length: 80 }).map((_, i) => (
          <motion.div
            key={`grass-${i}`}
            animate={{ rotate: [-5, 10, -5] }}
            transition={{ duration: 2 + Math.random() * 2, repeat: Infinity, ease: "easeInOut", delay: Math.random() }}
            className="w-2 bg-gradient-to-t from-emerald-500 to-green-300 rounded-t-full origin-bottom shadow-[0_0_10px_rgba(74,222,128,0.8)]"
            style={{ height: `${40 + Math.random() * 80}px`, opacity: 0.8 + Math.random() * 0.2 }}
          />
        ))}
      </div>
      </div>)}
    </div>
  );
};
