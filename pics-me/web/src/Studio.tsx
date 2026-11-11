import { useEffect, useMemo, useRef, useState } from "react";
import type { AdCopy, AdLayout, GameType, MediaDTO, PostDTO, Storyboard } from "../../shared/types.ts";
import { CAMERA_MOVES } from "../../shared/types.ts";
import { api, ApiError, type NewPost } from "./api.ts";
import { Game, GAME_HELP, GAME_NAMES } from "./games.tsx";
import { navigate, refreshFeeds, useSession } from "./state.tsx";
import { AD_FORMATS, canvasBlob, drawAd, loadImage, renderVideo, shrinkForUpload, VIDEO_FORMATS, videoSupported, type AdFormat, type VideoFormat, type VideoResult } from "./studio/render.ts";
import { SOUNDTRACKS, type Soundtrack } from "./studio/music.ts";
import { Empty, Icon, PageHeader, Picture, Spinner } from "./ui.tsx";

interface Source {
  media: MediaDTO[];
  remixOf?: string;
  credit?: string;
}

type Tool = "video" | "ad" | "game";
const TOOLS: { id: Tool; icon: string; name: string; blurb: string }[] = [
  { id: "video", icon: "film", name: "Video", blurb: "Camera moves, cuts and on-screen lines" },
  { id: "ad", icon: "megaphone", name: "Ad", blurb: "Headline, copy and a button, laid out for you" },
  { id: "game", icon: "puzzle", name: "Game", blurb: "A playable puzzle with a leaderboard" },
];

const msg = (err: unknown, fallback: string) => (err instanceof ApiError || (err instanceof Error && err.name !== "TypeError") ? err.message : fallback);
const withTags = (caption: string, tags: string[]) => [caption, tags.map((t) => `#${t}`).join(" ")].filter(Boolean).join(" ");

export function StudioPage({ postId }: { postId?: string }) {
  const { user, ready, requireAuth } = useSession();
  const [source, setSource] = useState<Source | null>(null);
  const [error, setError] = useState("");
  const [tool, setTool] = useState<Tool>("video");

  useEffect(() => {
    if (ready && !user) requireAuth();
  }, [ready, user, requireAuth]);

  useEffect(() => {
    setSource(null);
    setError("");
    if (!postId || !user) return;
    api.post(postId).then(({ post }) => {
      if (!post.allowRemix && post.author.username !== user.username) return setError("The creator has turned off remixes for this post.");
      setSource({ media: post.media, remixOf: post.id, credit: post.author.username === user.username ? undefined : post.author.username });
    }).catch((err) => setError(msg(err, "Couldn't load that post.")));
  }, [postId, user]);

  if (!user) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <PageHeader title={<><span className="spark-text">Studio</span></>} />
      {error ? (
        <Empty title={error}><button className="btn" onClick={() => navigate("/studio")}>Pick another picture</button></Empty>
      ) : !source ? (
        postId ? <Spinner /> : <SourcePicker username={user.username} onPick={setSource} />
      ) : (
        <>
          <div className="studio-source">
            {source.media.slice(0, 6).map((m) => <span key={m.id} className="thumb"><Picture media={m} sizes="64px" /></span>)}
            <span className="muted grow">
              {source.media.length} picture{source.media.length === 1 ? "" : "s"}
              {source.credit && <> · remixing @{source.credit}</>}
            </span>
            <button className="btn btn-ghost btn-small" onClick={() => (postId ? navigate("/studio") : setSource(null))}>Change</button>
          </div>
          <div className="tool-tabs" role="tablist">
            {TOOLS.map((t) => (
              <button key={t.id} role="tab" aria-selected={tool === t.id} className={tool === t.id ? "on" : ""} onClick={() => setTool(t.id)}>
                <Icon name={t.icon} size={22} />
                <strong>{t.name}</strong>
                <small>{t.blurb}</small>
              </button>
            ))}
          </div>
          {tool === "video" && <VideoTool key={source.media[0]!.id} source={source} />}
          {tool === "ad" && <AdTool key={source.media[0]!.id} source={source} />}
          {tool === "game" && <GameTool key={source.media[0]!.id} source={source} />}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

function SourcePicker({ username, onPick }: { username: string; onPick: (s: Source) => void }) {
  const { toast } = useSession();
  const [posts, setPosts] = useState<PostDTO[] | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.userPosts(username).then((p) => setPosts(p.items.filter((x) => x.kind === "photo"))).catch(() => setPosts([]));
  }, [username]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const media: MediaDTO[] = [];
      for (const f of [...files].slice(0, 8)) media.push((await api.uploadImage(await shrinkForUpload(f))).media);
      onPick({ media });
    } catch (err) {
      toast(msg(err, "Upload failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <p className="lede">Pick a picture and turn it into a video, an ad or a game.</p>
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => void upload(e.target.files)} />
      <button className="btn btn-spark" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? "Uploading…" : <><Icon name="plus" size={20} /> Upload pictures</>}
      </button>
      {posts === null ? <Spinner /> : posts.length > 0 && (
        <>
          <h3 className="section-title">Or start from one of your posts</h3>
          <div className="grid">
            {posts.map((p) => (
              <button key={p.id} className="grid-cell" onClick={() => navigate(`/studio/${p.id}`)} aria-label="Use this post">
                <Picture media={p.media[0]!} sizes="(min-width: 900px) 220px, 33vw" />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AiNote({ source }: { source: "claude" | "local" }) {
  return (
    <p className="ai-note">
      <Icon name="spark" size={15} />
      {source === "claude" ? "Written by Claude from your picture. Edit anything." : "Starter draft from templates. Edit anything."}
    </p>
  );
}

function PublishBar({ caption, setCaption, busy, onPublish, label }: { caption: string; setCaption: (s: string) => void; busy: boolean; onPublish: () => void; label: string }) {
  return (
    <div className="publish">
      <label className="field">
        <span>Caption</span>
        <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={2} maxLength={2200} placeholder="Say something about it" />
      </label>
      <button className="btn btn-spark btn-wide" disabled={busy} onClick={onPublish}>{busy ? "Publishing…" : label}</button>
    </div>
  );
}

async function publish(post: NewPost, toast: (m: string) => void) {
  const r = await api.createPost(post);
  refreshFeeds();
  toast("Posted");
  navigate(`/p/${r.post.id}`);
}

// ---- video -----------------------------------------------------------------

function VideoTool({ source }: { source: Source }) {
  const { toast } = useSession();
  const [vibe, setVibe] = useState("");
  const [format, setFormat] = useState<VideoFormat>("vertical");
  const [music, setMusic] = useState<Soundtrack>("calm");
  const audio = useRef<AudioContext | null>(null);
  const [board, setBoard] = useState<Storyboard | null>(null);
  const [phase, setPhase] = useState<"idle" | "planning" | "rendering" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<(VideoResult & { url: string }) | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLCanvasElement>(null);
  const abort = useRef<AbortController | null>(null);
  const images = useRef<HTMLImageElement[] | null>(null);
  const media = useMemo(() => source.media.slice(0, 8), [source]);

  useEffect(() => () => {
    abort.current?.abort();
    void audio.current?.close().catch(() => {});
  }, []);
  useEffect(() => () => {
    if (result) URL.revokeObjectURL(result.url);
  }, [result]);

  // Must be called straight from a tap: browsers only let audio start from a user gesture.
  const armAudio = () => {
    void audio.current?.close().catch(() => {});
    audio.current = music === "none" || typeof AudioContext === "undefined" ? null : new AudioContext();
  };

  const render = async (b: Storyboard) => {
    abort.current?.abort();
    const ctl = (abort.current = new AbortController());
    setPhase("rendering");
    setProgress(0);
    setResult(null);
    try {
      images.current ??= await Promise.all(media.map((m) => loadImage(m.urls.l)));
      const out = await renderVideo(images.current, b, {
        format, canvas: canvas.current!, onProgress: setProgress, signal: ctl.signal,
        music: audio.current && music !== "none" ? { ctx: audio.current, style: music } : undefined,
      });
      setResult({ ...out, url: URL.createObjectURL(out.blob) });
      setPhase("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      toast(msg(err, "Rendering failed."));
      setPhase(board ? "done" : "idle");
    }
  };

  const create = async () => {
    setPhase("planning");
    try {
      const b = await api.aiStoryboard(media.map((m) => m.id), vibe);
      setBoard(b);
      setCaption(withTags(b.caption, b.hashtags));
      await render(b);
    } catch (err) {
      toast(msg(err, "Couldn't plan the video."));
      setPhase("idle");
    }
  };

  const editShot = (i: number, change: Partial<Storyboard["shots"][number]>) =>
    setBoard((b) => b && { ...b, shots: b.shots.map((s, j) => (j === i ? { ...s, ...change } : s)) });

  if (!videoSupported()) return <Empty title="This browser can't record video"><p>Try a current version of Chrome, Edge, Firefox or Safari.</p></Empty>;

  const { width, height } = VIDEO_FORMATS[format];
  const working = phase === "planning" || phase === "rendering";

  return (
    <div className="tool">
      <div className="tool-stage">
        <div className="preview" style={{ aspectRatio: `${width} / ${height}` }}>
          {phase === "idle" && <Picture media={media[0]!} sizes="360px" />}
          <canvas ref={canvas} width={width} height={height} hidden={phase !== "rendering"} />
          {phase === "done" && result && <video src={result.url} controls loop autoPlay muted playsInline />}
          {phase === "planning" && <div className="preview-msg"><Spinner label="Planning the edit…" /></div>}
        </div>
        {phase === "rendering" && (
          <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span style={{ width: `${progress * 100}%` }} />
            <small>Recording {Math.round(progress * 100)}% — keep this tab open</small>
          </div>
        )}
      </div>

      <div className="tool-controls">
        <label className="field">
          <span>Vibe</span>
          <input value={vibe} onChange={(e) => setVibe(e.target.value)} maxLength={120} placeholder="slow sunday, launch hype, travel diary…" disabled={working} />
        </label>
        <div className="field">
          <span>Shape</span>
          <div className="chips">
            {(Object.keys(VIDEO_FORMATS) as VideoFormat[]).map((f) => (
              <button key={f} className={"chip" + (format === f ? " on" : "")} disabled={working} onClick={() => (setFormat(f), setResult(null), board && setPhase("idle"))}>{VIDEO_FORMATS[f].label}</button>
            ))}
          </div>
        </div>
        <div className="field">
          <span>Soundtrack</span>
          <div className="chips">
            {(Object.keys(SOUNDTRACKS) as Soundtrack[]).map((m) => (
              <button key={m} className={"chip" + (music === m ? " on" : "")} aria-pressed={music === m} disabled={working} onClick={() => setMusic(m)}>
                {m !== "none" && <Icon name="music" size={15} />} {SOUNDTRACKS[m]}
              </button>
            ))}
          </div>
          <small>Generated on your device, so it's free to use anywhere.</small>
        </div>
        <button className="btn btn-spark btn-wide" disabled={working} onClick={() => (armAudio(), void create())}>
          <Icon name="spark" size={20} /> {board ? "Start over with a new plan" : "Create video"}
        </button>

        {board && (
          <>
            <AiNote source={board.source} />
            <h3 className="section-title">Shots</h3>
            <ol className="shots">
              {board.shots.map((s, i) => (
                <li key={i}>
                  <span className="thumb"><Picture media={media[s.mediaIndex] ?? media[0]!} sizes="48px" /></span>
                  <input value={s.text} onChange={(e) => editShot(i, { text: e.target.value })} maxLength={80} placeholder="No text" aria-label={`Text for shot ${i + 1}`} disabled={working} />
                  <select value={s.move} onChange={(e) => editShot(i, { move: e.target.value as Storyboard["shots"][number]["move"] })} aria-label={`Camera move for shot ${i + 1}`} disabled={working}>
                    {CAMERA_MOVES.map((m) => <option key={m} value={m}>{m.replace("-", " ")}</option>)}
                  </select>
                </li>
              ))}
            </ol>
            <button className="btn btn-ghost btn-wide" disabled={working} onClick={() => (armAudio(), void render(board))}><Icon name="refresh" size={18} /> Render again with these edits</button>
          </>
        )}

        {phase === "done" && result && (
          <PublishBar
            caption={caption}
            setCaption={setCaption}
            busy={busy}
            label="Post video"
            onPublish={async () => {
              setBusy(true);
              try {
                const up = await api.uploadVideo(result.blob, result.poster, result);
                await publish({ kind: "video", caption, mediaIds: [up.media.id], remixOf: source.remixOf, meta: { ai: board?.source } }, toast);
              } catch (err) {
                toast(msg(err, "Couldn't post the video."));
                setBusy(false);
              }
            }}
          />
        )}
      </div>
    </div>
  );
}

// ---- ad --------------------------------------------------------------------

const TONES = ["Confident", "Playful", "Premium", "Bold", "Calm"];
const LAYOUTS: AdLayout[] = ["top", "center", "bottom"];

function AdTool({ source }: { source: Source }) {
  const { toast } = useSession();
  const [pick, setPick] = useState(0);
  const [brand, setBrand] = useState("");
  const [product, setProduct] = useState("");
  const [tone, setTone] = useState(TONES[0]!);
  const [link, setLink] = useState("");
  const [format, setFormat] = useState<AdFormat>("portrait");
  const [copy, setCopy] = useState<AdCopy | null>(null);
  const [writing, setWriting] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const media = source.media[pick] ?? source.media[0]!;

  useEffect(() => {
    let live = true;
    setImg(null);
    loadImage(media.urls.l).then((i) => live && setImg(i)).catch(() => toast("That picture couldn't be loaded."));
    return () => {
      live = false;
    };
  }, [media.urls.l, toast]);

  useEffect(() => {
    if (img && canvas.current) {
      drawAd(canvas.current, img, copy ?? { headline: "", subhead: "", cta: "", layout: "bottom", accent: "#ffffff", caption: "", hashtags: [], source: "local" }, copy ? brand : "", format);
    }
  }, [img, copy, brand, format]);

  const write = async () => {
    setWriting(true);
    try {
      const c = await api.aiAd({ mediaId: media.id, brand, product, tone });
      setCopy(c);
      setCaption(withTags(c.caption, c.hashtags));
    } catch (err) {
      toast(msg(err, "Couldn't write the ad."));
    } finally {
      setWriting(false);
    }
  };

  const edit = (change: Partial<AdCopy>) => setCopy((c) => c && { ...c, ...change });
  const linkOk = !link || /^https?:\/\/\S+\.\S+/i.test(link);
  const { width, height } = AD_FORMATS[format];

  return (
    <div className="tool">
      <div className="tool-stage">
        <div className="preview" style={{ aspectRatio: `${width} / ${height}` }}>
          <canvas ref={canvas} width={width} height={height} aria-label="Ad preview" />
          {(!img || writing) && <div className="preview-msg"><Spinner label={writing ? "Writing your ad…" : undefined} /></div>}
        </div>
        {source.media.length > 1 && (
          <div className="thumb-row">
            {source.media.map((m, i) => (
              <button key={m.id} className={"thumb" + (i === pick ? " on" : "")} onClick={() => (setPick(i), setCopy(null))} aria-label={`Use picture ${i + 1}`}><Picture media={m} sizes="56px" /></button>
            ))}
          </div>
        )}
      </div>

      <div className="tool-controls">
        <div className="row">
          <label className="field"><span>Brand</span><input value={brand} onChange={(e) => setBrand(e.target.value)} maxLength={60} placeholder="Northwind" /></label>
          <label className="field"><span>Promoting</span><input value={product} onChange={(e) => setProduct(e.target.value)} maxLength={120} placeholder="trail shoes, summer menu…" /></label>
        </div>
        <div className="field">
          <span>Tone</span>
          <div className="chips">{TONES.map((t) => <button key={t} className={"chip" + (tone === t ? " on" : "")} onClick={() => setTone(t)}>{t}</button>)}</div>
        </div>
        <div className="field">
          <span>Format</span>
          <div className="chips">{(Object.keys(AD_FORMATS) as AdFormat[]).map((f) => <button key={f} className={"chip" + (format === f ? " on" : "")} onClick={() => setFormat(f)}>{AD_FORMATS[f].label}</button>)}</div>
        </div>
        <button className="btn btn-spark btn-wide" disabled={writing || !img} onClick={() => void write()}>
          <Icon name="spark" size={20} /> {copy ? "Write another version" : "Write my ad"}
        </button>

        {copy && (
          <>
            <AiNote source={copy.source} />
            <label className="field"><span>Headline</span><input value={copy.headline} onChange={(e) => edit({ headline: e.target.value })} maxLength={60} /></label>
            <label className="field"><span>Supporting line</span><input value={copy.subhead} onChange={(e) => edit({ subhead: e.target.value })} maxLength={120} /></label>
            <div className="row">
              <label className="field"><span>Button</span><input value={copy.cta} onChange={(e) => edit({ cta: e.target.value })} maxLength={24} /></label>
              <label className="field field-color"><span>Button colour</span><input type="color" value={copy.accent} onChange={(e) => edit({ accent: e.target.value })} /></label>
            </div>
            <div className="field">
              <span>Text position</span>
              <div className="chips">{LAYOUTS.map((l) => <button key={l} className={"chip" + (copy.layout === l ? " on" : "")} onClick={() => edit({ layout: l })}>{l.charAt(0).toUpperCase() + l.slice(1)}</button>)}</div>
            </div>
            <label className="field">
              <span>Button link (optional)</span>
              <input value={link} onChange={(e) => setLink(e.target.value.trim())} maxLength={300} placeholder="https://" inputMode="url" aria-invalid={!linkOk} />
              {!linkOk && <small className="error">Links start with http:// or https://</small>}
            </label>
            <PublishBar
              caption={caption}
              setCaption={setCaption}
              busy={busy}
              label="Post ad"
              onPublish={async () => {
                if (!linkOk) return toast("Fix the button link first.");
                setBusy(true);
                try {
                  const up = await api.uploadImage(await canvasBlob(canvas.current!));
                  await publish({
                    kind: "ad", caption, mediaIds: [up.media.id], remixOf: source.remixOf,
                    meta: { ad: { brand, headline: copy.headline, cta: copy.cta, ...(link ? { link } : {}) }, ai: copy.source },
                  }, toast);
                } catch (err) {
                  toast(msg(err, "Couldn't post the ad."));
                  setBusy(false);
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

// ---- game ------------------------------------------------------------------

function GameTool({ source }: { source: Source }) {
  const { toast } = useSession();
  const [pick, setPick] = useState(0);
  const [type, setType] = useState<GameType>("slide");
  const [size, setSize] = useState(3);
  const [seed, setSeed] = useState(() => 1 + Math.floor(Math.random() * 1e9));
  const [caption, setCaption] = useState("Can you beat my time? #puzzle");
  const [busy, setBusy] = useState(false);
  // Games are played on a still picture, so video sources don't qualify.
  const pics = source.media.filter((m) => m.kind === "image");
  const media = pics[pick] ?? pics[0];
  const realSize = type === "memory" ? 4 : type === "spot" ? size + 2 : size;

  if (!media) return <Empty title="Games need a still picture"><p>Pick a photo post to build a game from.</p></Empty>;

  return (
    <div className="tool">
      <div className="tool-stage">
        <Game media={media} type={type} size={realSize} seed={seed} />
        {pics.length > 1 && (
          <div className="thumb-row">
            {pics.map((m, i) => (
              <button key={m.id} className={"thumb" + (i === pick ? " on" : "")} onClick={() => setPick(i)} aria-label={`Use picture ${i + 1}`}><Picture media={m} sizes="56px" /></button>
            ))}
          </div>
        )}
      </div>
      <div className="tool-controls">
        <div className="field">
          <span>Game</span>
          <div className="choice-list">
            {(Object.keys(GAME_NAMES) as GameType[]).map((g) => (
              <button key={g} className={"choice" + (type === g ? " on" : "")} onClick={() => setType(g)} aria-pressed={type === g}>
                <strong>{GAME_NAMES[g]}</strong>
                <small>{GAME_HELP[g]}</small>
              </button>
            ))}
          </div>
        </div>
        {type !== "memory" && (
          <div className="field">
            <span>Difficulty</span>
            <div className="chips">
              {[3, 4, 5].map((n) => (
                <button key={n} className={"chip" + (size === n ? " on" : "")} aria-pressed={size === n} onClick={() => setSize(n)}>
                  {type === "spot" ? `${n + 2} changes` : `${n} × ${n}`}
                </button>
              ))}
              {type === "spot" && <button className="chip" onClick={() => setSeed(1 + Math.floor(Math.random() * 1e9))}><Icon name="refresh" size={15} /> New changes</button>}
            </div>
          </div>
        )}
        <PublishBar
          caption={caption}
          setCaption={setCaption}
          busy={busy}
          label="Post game"
          onPublish={async () => {
            setBusy(true);
            try {
              await publish({ kind: "game", caption, mediaIds: [media.id], remixOf: source.remixOf, meta: { game: { type, size: realSize, ...(type === "spot" ? { seed } : {}) } } }, toast);
            } catch (err) {
              toast(msg(err, "Couldn't post the game."));
              setBusy(false);
            }
          }}
        />
      </div>
    </div>
  );
}
