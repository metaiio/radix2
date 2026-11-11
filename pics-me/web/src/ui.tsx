import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { MediaDTO, PostDTO, UserDTO } from "../../shared/types.ts";
import { Link, goBack, useLocation } from "./state.tsx";

const PATHS: Record<string, string> = {
  home: "M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4.5 4.5",
  plus: "M12 5v14M5 12h14",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3Zm7 11 .8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14Z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7.5 8c.8-3.6 3.8-5.5 7.5-5.5s6.7 1.9 7.5 5.5",
  heart: "M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.3 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z",
  comment: "M4.5 5.5h15v11h-8l-4.5 3.5v-3.5h-2.5v-11Z",
  share: "M12 15V4m0 0L8 8m4-4 4 4M5 13v6.5h14V13",
  more: "M6 12h.01M12 12h.01M18 12h.01",
  close: "M6 6l12 12M18 6 6 18",
  back: "M15 5l-7 7 7 7",
  play: "M8 5.5v13l11-6.5-11-6.5Z",
  sound: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm12-.5a4 4 0 0 1 0 6m2.5-8.5a7.5 7.5 0 0 1 0 11",
  mute: "M4 9.5v5h3.5L12 18.5v-13L7.5 9.5H4Zm12 0 5 5m0-5-5 5",
  check: "M5 12.5l4.5 4.5L19 7.5",
  trash: "M5 7h14M9.5 7V4.5h5V7m-7.5 0 .8 12.5h8.4L17 7",
  flag: "M6 20V4.5h11l-2 4 2 4H6",
  image: "M4 5h16v14H4V5Zm0 11 4.5-4.5 3.5 3.5 3-3 5 5M9 9.5h.01",
  film: "M4 5h16v14H4V5Zm4 0v14m8-14v14M4 9.5h4m8 0h4M4 14.5h4m8 0h4",
  megaphone: "M4 10v4h3l8 4.5v-13L7 10H4Zm14.5-.5a3.5 3.5 0 0 1 0 5M7.5 14.5l1 4.5h2.5",
  puzzle: "M9 4.5h3a1.8 1.8 0 1 1 3 0h3.5V9a1.8 1.8 0 1 0 0 3.5v5h-5a1.8 1.8 0 1 0-3.5 0h-4.5v-4.5a1.8 1.8 0 1 1 0-3.5V4.5H9Z",
  logout: "M14 5H5.5v14H14M10 12h10m0 0-3.5-3.5M20 12l-3.5 3.5",
  link: "M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1",
  refresh: "M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4.5H15",
  bookmark: "M6.5 4.5h11v15.5l-5.5-4-5.5 4V4.5Z",
  bell: "M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15l1.5-2Zm4 4.5a2 2 0 0 0 4 0",
  lock: "M6.5 10.5h11v9h-11v-9Zm2.5 0V8a3 3 0 0 1 6 0v2.5",
  globe: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-8-8h16M12 4c2.5 2.6 2.5 13.4 0 16M12 4c-2.5 2.6-2.5 13.4 0 16",
  sliders: "M4 7h9m4 0h3M4 17h3m4 0h9M15 4.5v5M9 14.5v5",
  info: "M12 20a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm0-9v5m0-8h.01",
  shield: "M12 3.5l7 2.5v5.5c0 4.2-2.9 7.3-7 9-4.1-1.7-7-4.8-7-9V6l7-2.5Z",
  download: "M12 4v11m0 0-4-4m4 4 4-4M5 19.5h14",
  users: "M9 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6.5 8c.6-3.2 3.2-5 6.5-5s5.9 1.8 6.5 5M16 4.5a3.5 3.5 0 0 1 0 7m2.5 3.5c1.6.8 2.7 2.3 3 4.5",
  music: "M9 18V6l10-2v12M9 18a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm10-2a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Z",
  eye: "M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  edit: "M4.5 19.5l1-4L16 5l3 3L8.5 18.5l-4 1Z",
};

export function Icon({ name, size = 24, fill = false }: { name: keyof typeof PATHS | string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

export function Avatar({ user, size = 40 }: { user: UserDTO; size?: number }) {
  const hue = [...user.username].reduce((a, c) => a + c.charCodeAt(0) * 17, 0) % 360;
  return user.avatar ? (
    <img className="avatar" src={user.avatar} width={size} height={size} alt="" loading="lazy" />
  ) : (
    <span className="avatar avatar-fallback" style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue} 55% 42%)` }} aria-hidden="true">
      {user.displayName.charAt(0).toUpperCase()}
    </span>
  );
}

/**
 * Progressive picture: dominant colour → tiny blurred preview → the smallest
 * variant that fills the slot (the browser picks from srcset).
 */
export function Picture({ media, sizes, fit = "cover", eager = false, alt }: { media: MediaDTO; sizes: string; fit?: "cover" | "contain"; eager?: boolean; alt?: string }) {
  const [loaded, setLoaded] = useState(false);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (ref.current?.complete) setLoaded(true);
  }, []);
  const mw = Math.min(media.w, 1080);
  const srcset = `${media.urls.t} ${Math.min(media.w, 360)}w, ${media.urls.m} ${mw}w` + (media.urls.l !== media.urls.m ? `, ${media.urls.l} ${Math.min(media.w, 2160)}w` : "");
  return (
    <span className="pic" style={{ backgroundColor: media.color, backgroundImage: `url(${media.ph})` }}>
      <img
        ref={ref}
        src={media.urls.m}
        srcSet={srcset}
        sizes={sizes}
        alt={alt ?? media.alt}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        style={{ objectFit: fit, opacity: loaded ? 1 : 0 }}
        onLoad={() => setLoaded(true)}
      />
    </span>
  );
}

export function Sheet({ title, onClose, children, tall = false }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  // Following a link inside a sheet should leave the sheet behind.
  const { path } = useLocation();
  const opened = useRef(path);
  useEffect(() => {
    if (path !== opened.current) onClose();
  }, [path, onClose]);
  return createPortal(
    <div className="sheet-wrap" onClick={onClose}>
      <div className={"sheet" + (tall ? " sheet-tall" : "")} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function PageHeader({ title, back = true, right }: { title: ReactNode; back?: boolean; right?: ReactNode }) {
  return (
    <header className="page-head">
      {back ? (
        <button className="icon-btn" onClick={() => goBack()} aria-label="Back">
          <Icon name="back" />
        </button>
      ) : (
        <span className="icon-btn-spacer" />
      )}
      <h1>{title}</h1>
      <span className="page-head-right">{right}</span>
    </header>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="spinner-wrap" role="status">
      <span className="spinner" />
      {label && <span>{label}</span>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

const KIND_ICON: Record<PostDTO["kind"], string | null> = { photo: null, video: "film", ad: "megaphone", game: "puzzle" };
export const KIND_LABEL: Record<PostDTO["kind"], string> = { photo: "Photo", video: "Video", ad: "Ad", game: "Game" };

export function PostGrid({ posts }: { posts: PostDTO[] }) {
  return (
    <div className="grid">
      {posts.map((p) => {
        const icon = KIND_ICON[p.kind];
        return (
          <Link key={p.id} to={`/p/${p.id}`} className="grid-cell" aria-label={`${KIND_LABEL[p.kind]} by ${p.author.username}`}>
            {p.media[0] && <Picture media={p.media[0]} sizes="(min-width: 900px) 220px, 33vw" />}
            {icon && (
              <span className="grid-badge">
                <Icon name={icon} size={16} />
              </span>
            )}
            {p.likeCount > 0 && (
              <span className="grid-likes">
                <Icon name="heart" size={13} fill /> {compact(p.likeCount)}
              </span>
            )}
          </Link>
        );
      })}
    </div>
  );
}

export const compact = (n: number) =>
  n < 1000 ? String(n) : n < 1e6 ? (n / 1e3).toFixed(n < 1e4 ? 1 : 0).replace(/\.0$/, "") + "K" : (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";

export function ago(ts: number) {
  const s = Math.max((Date.now() - ts) / 1000, 1);
  if (s < 60) return "now";
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const clock = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
};

/** Renders caption text with #tags and @mentions as links. */
export function RichText({ text }: { text: string }) {
  const parts = text.split(/([#@][\p{L}\p{N}_.]{1,32})/gu);
  return (
    <>
      {parts.map((part, i) =>
        /^#[\p{L}\p{N}_]+$/u.test(part) ? (
          <Link key={i} to={`/tag/${encodeURIComponent(part.slice(1).toLowerCase())}`} className="tag">{part}</Link>
        ) : /^@[a-z0-9_.]{3,24}$/i.test(part) ? (
          <Link key={i} to={`/u/${part.slice(1).toLowerCase()}`} className="tag">{part}</Link>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** Infinite-scroll helper: calls `onHit` when the sentinel scrolls into view. */
export function Sentinel({ onHit }: { onHit: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onHit);
  cb.current = onHit;
  useEffect(() => {
    const io = new IntersectionObserver((e) => e[0]?.isIntersecting && cb.current(), { rootMargin: "600px" });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return <div ref={ref} style={{ height: 1 }} />;
}
