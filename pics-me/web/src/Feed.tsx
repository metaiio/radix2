import { memo, useCallback, useEffect, useRef, useState } from "react";
import type { CommentDTO, MediaDTO, Page, PostDTO } from "../../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { GamePlayer, GAME_NAMES } from "./games.tsx";
import { Link, navigate, refreshFeeds, useSession } from "./state.tsx";
import { ago, Avatar, compact, Empty, Icon, Picture, RichText, Sheet, Spinner } from "./ui.tsx";

const SIZES = "(min-width: 900px) 500px, 100vw";

/** Shared across cards so un-muting once applies to the whole session. */
let soundOn = false;

// ---------------------------------------------------------------------------

export function Feed({ load, active, feedKey, emptyState }: {
  load: (cursor: string | null) => Promise<Page<PostDTO>>;
  /** False while another page covers the feed — pauses video and key handling. */
  active: boolean;
  feedKey: string;
  emptyState: React.ReactNode;
}) {
  const [items, setItems] = useState<PostDTO[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [current, setCurrent] = useState(0);
  const scroller = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const fetchPage = useCallback(async (cursor: string | null, reset: boolean) => {
    if (busy.current) return;
    busy.current = true;
    try {
      const page = await load(cursor);
      setItems((prev) => {
        if (reset) return page.items;
        const seen = new Set(prev.map((p) => p.id));
        return [...prev, ...page.items.filter((p) => !seen.has(p.id))];
      });
      setNext(page.next);
      setStatus("ready");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't load the feed.");
      setStatus((s) => (s === "loading" ? "error" : s));
    } finally {
      busy.current = false;
    }
  }, [load]);

  useEffect(() => {
    setItems([]);
    setCurrent(0);
    setStatus("loading");
    scroller.current?.scrollTo({ top: 0 });
    void fetchPage(null, true);
  }, [feedKey, fetchPage]);

  // Which card is on screen?
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setCurrent(Number((e.target as HTMLElement).dataset.index));
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll("[data-index]").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [items.length]);

  useEffect(() => {
    if (status === "ready" && next && current >= items.length - 4) void fetchPage(next, false);
  }, [current, items.length, next, status, fetchPage]);

  const step = useCallback((dir: 1 | -1) => {
    const root = scroller.current;
    root?.scrollBy({ top: dir * root.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, [role=dialog]")) return;
      if (e.key === "ArrowDown" || e.key === "j") (e.preventDefault(), step(1));
      if (e.key === "ArrowUp" || e.key === "k") (e.preventDefault(), step(-1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, step]);

  const patch = useCallback((id: string, change: Partial<PostDTO>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...change } : p)));
  }, []);
  const remove = useCallback((id: string) => setItems((prev) => prev.filter((p) => p.id !== id)), []);

  return (
    <div className="feed" ref={scroller}>
      {status === "loading" && <div className="feed-msg"><Spinner /></div>}
      {status === "error" && (
        <div className="feed-msg">
          <Empty title={error}>
            <button className="btn" onClick={() => (setStatus("loading"), void fetchPage(null, true))}>Try again</button>
          </Empty>
        </div>
      )}
      {status === "ready" && items.length === 0 && <div className="feed-msg">{emptyState}</div>}
      {items.map((post, i) => (
        <div className="feed-slot" key={post.id} data-index={i}>
          <PostCard post={post} near={Math.abs(i - current) <= 1} playing={active && i === current} onPatch={patch} onRemoved={remove} />
        </div>
      ))}
      {items.length > 1 && (
        <div className="feed-arrows">
          <button className="icon-btn solid" onClick={() => step(-1)} disabled={current === 0} aria-label="Previous post"><span className="rot90"><Icon name="back" /></span></button>
          <button className="icon-btn solid" onClick={() => step(1)} disabled={current >= items.length - 1} aria-label="Next post"><span className="rot270"><Icon name="back" /></span></button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Tall pictures fill the card; everything else is shown whole over a blurred backdrop. */
const fitFor = (m: MediaDTO) => (m.h / m.w >= 1.45 ? "cover" : "contain");

function Slide({ media, eager }: { media: MediaDTO; eager: boolean }) {
  return (
    <div className="slide">
      <span className="slide-backdrop" style={{ backgroundColor: media.color, backgroundImage: `url(${media.ph})` }} />
      <Picture media={media} sizes={SIZES} fit={fitFor(media)} eager={eager} />
    </div>
  );
}

function VideoSlide({ media, playing }: { media: MediaDTO; playing: boolean }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [muted, setMuted] = useState(!soundOn);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing && !paused) {
      v.muted = !soundOn;
      setMuted(!soundOn);
      v.play().catch(() => {
        // Autoplay with sound was blocked — fall back to muted.
        v.muted = true;
        setMuted(true);
        v.play().catch(() => {});
      });
    } else {
      v.pause();
      if (!playing) {
        v.currentTime = 0;
        setPaused(false);
      }
    }
  }, [playing, paused]);

  const v = media.video!;
  return (
    <div className="slide" onClick={() => setPaused((p) => !p)}>
      <span className="slide-backdrop" style={{ backgroundColor: media.color, backgroundImage: `url(${media.ph})` }} />
      <video ref={ref} poster={media.urls.m} loop playsInline muted preload={playing ? "auto" : "none"} style={{ objectFit: fitFor(media) }}>
        {v.mp4 && <source src={v.mp4} type="video/mp4" />}
        <source src={v.src} type={v.type} />
      </video>
      {paused && <span className="big-play"><Icon name="play" size={44} fill /></span>}
      <button
        className="icon-btn solid sound-btn"
        aria-label={muted ? "Turn sound on" : "Mute"}
        onClick={(e) => {
          e.stopPropagation();
          soundOn = muted;
          setMuted(!muted);
          if (ref.current) ref.current.muted = !muted;
        }}
      >
        <Icon name={muted ? "mute" : "sound"} size={20} />
      </button>
    </div>
  );
}

function Carousel({ media, eager }: { media: MediaDTO[]; eager: boolean }) {
  const [index, setIndex] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const go = (i: number) => ref.current?.scrollTo({ left: i * ref.current.clientWidth, behavior: "smooth" });
  return (
    <>
      <div
        className="carousel"
        ref={ref}
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / el.clientWidth));
        }}
      >
        {media.map((m, i) => <Slide key={m.id + i} media={m} eager={eager && i === 0} />)}
      </div>
      <div className="dots" aria-hidden="true">
        {media.map((m, i) => <span key={m.id + i} className={i === index ? "on" : ""} />)}
      </div>
      {index > 0 && <button className="icon-btn solid car-prev" onClick={() => go(index - 1)} aria-label="Previous picture"><Icon name="back" size={18} /></button>}
      {index < media.length - 1 && <button className="icon-btn solid car-next" onClick={() => go(index + 1)} aria-label="Next picture"><span className="rot180"><Icon name="back" size={18} /></span></button>}
    </>
  );
}

export const PostCard = memo(function PostCard({ post, near, playing, onPatch, onRemoved }: {
  post: PostDTO;
  /** Only cards next to the viewport mount their media. */
  near: boolean;
  playing: boolean;
  onPatch: (id: string, change: Partial<PostDTO>) => void;
  onRemoved: (id: string) => void;
}) {
  const { user, requireAuth, toast } = useSession();
  const [sheet, setSheet] = useState<null | "comments" | "menu" | "game">(null);
  const [burst, setBurst] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const first = post.media[0];

  const setLike = async (on: boolean) => {
    if (!requireAuth() || on === post.liked) return;
    onPatch(post.id, { liked: on, likeCount: post.likeCount + (on ? 1 : -1) });
    try {
      const r = await api.like(post.id, on);
      onPatch(post.id, r);
    } catch (err) {
      onPatch(post.id, { liked: post.liked, likeCount: post.likeCount });
      toast(err instanceof ApiError ? err.message : "Couldn't save your like.");
    }
  };

  const share = async () => {
    const url = `${location.origin}/p/${post.id}`;
    try {
      if (navigator.share) await navigator.share({ title: `${post.author.displayName} on pics.me`, text: post.caption.slice(0, 120), url });
      else {
        await navigator.clipboard.writeText(url);
        toast("Link copied");
      }
    } catch { /* share sheet dismissed */ }
  };

  const long = post.caption.length > 110;

  return (
    <article className="card" style={{ backgroundColor: first?.color }} aria-label={`Post by ${post.author.username}`}>
      <div
        className="card-media"
        onDoubleClick={() => {
          setBurst(Date.now());
          void setLike(true);
        }}
      >
        {near && first && (post.kind === "video" && first.video ? (
          <VideoSlide media={first} playing={playing} />
        ) : post.media.length > 1 ? (
          <Carousel media={post.media} eager={playing} />
        ) : (
          <Slide media={first} eager={playing} />
        ))}
        {burst > 0 && <span className="burst" key={burst}><Icon name="heart" size={110} fill /></span>}
      </div>

      {post.kind === "game" && post.meta.game && (
        <button className="play-pill" onClick={() => setSheet("game")}>
          <Icon name="play" size={20} fill /> Play {GAME_NAMES[post.meta.game.type]}
        </button>
      )}

      <div className="card-info">
        {post.kind !== "photo" && (
          <span className={`badge badge-${post.kind}`}>
            <Icon name={post.kind === "video" ? "film" : post.kind === "ad" ? "megaphone" : "puzzle"} size={13} />
            {post.kind === "video" ? "Video" : post.kind === "ad" ? "Ad" : "Game"}
            {post.remixOf && <> · remix of <Link to={`/p/${post.remixOf.id}`}>@{post.remixOf.author}</Link></>}
          </span>
        )}
        <Link to={`/u/${post.author.username}`} className="card-author">
          <Avatar user={post.author} size={36} />
          <span>
            <strong>{post.author.displayName}</strong>
            <small>@{post.author.username} · {ago(post.createdAt)}</small>
          </span>
        </Link>
        {post.caption && (
          <p className={"caption" + (expanded || !long ? "" : " clamp")} onClick={() => long && setExpanded((e) => !e)}>
            <RichText text={post.caption} />
          </p>
        )}
        {post.kind === "ad" && post.meta.ad?.link && (
          <a className="btn btn-light btn-small" href={post.meta.ad.link} target="_blank" rel="noopener noreferrer nofollow">
            {post.meta.ad.cta || "Learn more"} <Icon name="link" size={15} />
          </a>
        )}
      </div>

      <div className="rail">
        <button className={"rail-btn" + (post.liked ? " liked" : "")} onClick={() => void setLike(!post.liked)} aria-pressed={post.liked} aria-label={post.liked ? "Unlike" : "Like"}>
          <Icon name="heart" size={30} fill={post.liked} />
          <span>{compact(post.likeCount)}</span>
        </button>
        <button className="rail-btn" onClick={() => setSheet("comments")} aria-label="Comments">
          <Icon name="comment" size={30} />
          <span>{compact(post.commentCount)}</span>
        </button>
        {post.allowRemix && (
          <button className="rail-btn rail-remix" onClick={() => requireAuth() && navigate(`/studio/${post.id}`)} aria-label="Remix with AI">
            <Icon name="spark" size={30} />
            <span>{post.remixCount ? compact(post.remixCount) : "Remix"}</span>
          </button>
        )}
        <button className="rail-btn" onClick={() => void share()} aria-label="Share">
          <Icon name="share" size={28} />
          <span>Share</span>
        </button>
        <button className="rail-btn" onClick={() => setSheet("menu")} aria-label="More options">
          <Icon name="more" size={28} />
        </button>
      </div>

      {sheet === "comments" && (
        <Comments post={post} onClose={() => setSheet(null)} onCount={(n) => onPatch(post.id, { commentCount: n })} />
      )}
      {sheet === "game" && <GamePlayer post={post} onClose={() => setSheet(null)} />}
      {sheet === "menu" && (
        <Sheet title="Post options" onClose={() => setSheet(null)}>
          <div className="menu">
            <button onClick={() => (setSheet(null), void share())}><Icon name="share" size={20} /> Share link</button>
            <button onClick={() => (setSheet(null), navigate(`/p/${post.id}`))}><Icon name="image" size={20} /> Open post</button>
            {user?.username === post.author.username ? (
              <button
                className="danger"
                onClick={async () => {
                  if (!confirm("Delete this post? This can't be undone.")) return;
                  try {
                    await api.deletePost(post.id);
                    setSheet(null);
                    onRemoved(post.id);
                    if (location.pathname.startsWith("/p/")) refreshFeeds();
                    toast("Post deleted");
                  } catch (err) {
                    toast(err instanceof ApiError ? err.message : "Couldn't delete the post.");
                  }
                }}
              >
                <Icon name="trash" size={20} /> Delete post
              </button>
            ) : (
              <button
                onClick={async () => {
                  if (!requireAuth()) return;
                  const reason = prompt("What's wrong with this post?");
                  if (!reason?.trim()) return;
                  try {
                    await api.report(post.id, reason);
                    toast("Thanks — we'll take a look.");
                  } catch (err) {
                    toast(err instanceof ApiError ? err.message : "Couldn't send the report.");
                  }
                  setSheet(null);
                }}
              >
                <Icon name="flag" size={20} /> Report
              </button>
            )}
          </div>
        </Sheet>
      )}
    </article>
  );
});

// ---------------------------------------------------------------------------

function Comments({ post, onClose, onCount }: { post: PostDTO; onClose: () => void; onCount: (n: number) => void }) {
  const { user, requireAuth, toast } = useSession();
  const [items, setItems] = useState<CommentDTO[] | null>(null);
  const [next, setNext] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.comments(post.id).then((p) => (setItems(p.items), setNext(p.next))).catch(() => setItems([]));
  }, [post.id]);

  const send = async () => {
    if (!text.trim() || sending || !requireAuth()) return;
    setSending(true);
    try {
      const r = await api.comment(post.id, text);
      setItems((prev) => [r.comment, ...(prev ?? [])]);
      onCount(r.commentCount);
      setText("");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't post your comment.");
    } finally {
      setSending(false);
    }
  };

  return (
    <Sheet title={`Comments${post.commentCount ? ` · ${post.commentCount}` : ""}`} onClose={onClose} tall>
      <div className="comments">
        {items === null && <Spinner />}
        {items?.length === 0 && <Empty title="No comments yet"><p>Say something nice.</p></Empty>}
        {items?.map((c) => (
          <div className="comment" key={c.id}>
            <Link to={`/u/${c.author.username}`}><Avatar user={c.author} size={34} /></Link>
            <div>
              <small><Link to={`/u/${c.author.username}`}>@{c.author.username}</Link> · {ago(c.createdAt)}</small>
              <p><RichText text={c.body} /></p>
            </div>
            {(user?.username === c.author.username || user?.username === post.author.username) && (
              <button
                className="icon-btn"
                aria-label="Delete comment"
                onClick={async () => {
                  try {
                    await api.deleteComment(c.id);
                    setItems((prev) => prev!.filter((x) => x.id !== c.id));
                    onCount(Math.max(post.commentCount - 1, 0));
                  } catch (err) {
                    toast(err instanceof ApiError ? err.message : "Couldn't delete the comment.");
                  }
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            )}
          </div>
        ))}
        {next && (
          <button className="btn btn-ghost btn-small" onClick={() => api.comments(post.id, next).then((p) => (setItems((prev) => [...(prev ?? []), ...p.items]), setNext(p.next)))}>
            Show more
          </button>
        )}
      </div>
      <form
        className="comment-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={user ? "Add a comment" : "Sign in to comment"} maxLength={500} aria-label="Add a comment" onFocus={() => !user && requireAuth()} />
        <button className="btn" disabled={!text.trim() || sending}>Post</button>
      </form>
    </Sheet>
  );
}
