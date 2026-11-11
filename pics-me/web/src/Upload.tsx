import { useEffect, useRef, useState } from "react";
import type { MediaDTO } from "../../shared/types.ts";
import { api, ApiError } from "./api.ts";
import { navigate, refreshFeeds, useSession } from "./state.tsx";
import { inspectVideo, shrinkForUpload } from "./studio/render.ts";
import { Icon, PageHeader, Spinner } from "./ui.tsx";

interface Item {
  key: string;
  file: File;
  preview: string;
  isVideo: boolean;
  /** Set once the file is on the server; uploads start as soon as a file is picked. */
  media?: MediaDTO;
  failed?: string;
}

const MAX = 10;

export function UploadPage() {
  const { user, ready, requireAuth, toast } = useSession();
  const [items, setItems] = useState<Item[]>([]);
  const [caption, setCaption] = useState("");
  const [allowRemix, setAllowRemix] = useState(true);
  const [posting, setPosting] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const previews = useRef<string[]>([]);

  useEffect(() => {
    if (ready && !user) requireAuth();
  }, [ready, user, requireAuth]);
  useEffect(() => () => previews.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = (key: string, change: Partial<Item>) => setItems((prev) => prev.map((it) => (it.key === key ? { ...it, ...change } : it)));

  const send = async (item: Item) => {
    try {
      if (item.isVideo) {
        const info = await inspectVideo(item.file);
        patch(item.key, { media: (await api.uploadVideo(item.file, info.poster, info)).media });
      } else {
        patch(item.key, { media: (await api.uploadImage(await shrinkForUpload(item.file))).media });
      }
    } catch (err) {
      patch(item.key, { failed: err instanceof Error ? err.message : "Upload failed." });
    }
  };

  const add = (list: FileList | File[] | null) => {
    if (!list) return;
    let files = [...list].filter((f) => f.type.startsWith("image/") || f.type.startsWith("video/"));
    if (!files.length) return toast("Pick pictures or a video.");
    const video = files.find((f) => f.type.startsWith("video/"));
    // A post is either one video or up to ten pictures.
    if (video || items.some((i) => i.isVideo)) {
      if (items.length || files.length > 1) toast("A video is posted on its own.");
      files = video ? [video] : [];
      if (!video) return;
      setItems([]);
    }
    const room = video ? 1 : MAX - items.length;
    if (files.length > room) toast(`A post holds up to ${MAX} pictures.`);
    const fresh = files.slice(0, room).map((file) => {
      const preview = URL.createObjectURL(file);
      previews.current.push(preview);
      return { key: crypto.randomUUID(), file, preview, isVideo: file.type.startsWith("video/") };
    });
    setItems((prev) => (video ? fresh : [...prev, ...fresh]));
    fresh.forEach((it) => void send(it));
  };

  const pending = items.filter((i) => !i.media && !i.failed).length;
  const ok = items.filter((i) => i.media);
  const canPost = ok.length > 0 && pending === 0 && !posting;

  const suggest = async () => {
    const first = ok[0]?.media;
    if (!first) return;
    setSuggesting(true);
    try {
      const s = await api.aiCaption(first.id, caption);
      setCaption([s.caption, s.hashtags.map((t) => `#${t}`).join(" ")].filter(Boolean).join(" "));
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't suggest a caption.");
    } finally {
      setSuggesting(false);
    }
  };

  const submit = async () => {
    setPosting(true);
    try {
      const isVideo = ok[0]!.isVideo;
      const r = await api.createPost({ kind: isVideo ? "video" : "photo", caption, mediaIds: ok.map((i) => i.media!.id), allowRemix });
      refreshFeeds();
      toast("Posted");
      navigate(`/p/${r.post.id}`, { replace: true });
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't publish your post.");
      setPosting(false);
    }
  };

  if (!user) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <PageHeader title="New post" />
      <input ref={input} type="file" accept="image/*,video/mp4,video/webm" multiple hidden onChange={(e) => (add(e.target.files), (e.target.value = ""))} />

      {items.length === 0 ? (
        <button
          className={"dropzone" + (dragging ? " over" : "")}
          onClick={() => input.current?.click()}
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => (e.preventDefault(), setDragging(false), add(e.dataTransfer.files))}
        >
          <Icon name="image" size={44} />
          <strong>Choose pictures</strong>
          <span>Up to {MAX} pictures, or one video. Drop them here on desktop.</span>
        </button>
      ) : (
        <div className="stack">
          <div className="upload-strip">
            {items.map((it) => (
              <div key={it.key} className={"upload-item" + (it.failed ? " failed" : "")}>
                {it.isVideo ? <video src={it.preview} muted playsInline /> : <img src={it.preview} alt="" />}
                {!it.media && !it.failed && <span className="upload-state"><span className="spinner" /></span>}
                {it.failed && <span className="upload-state" title={it.failed}>Failed</span>}
                <button className="icon-btn solid" aria-label="Remove" onClick={() => setItems((prev) => prev.filter((x) => x.key !== it.key))}><Icon name="close" size={14} /></button>
              </div>
            ))}
            {items.length < MAX && !items[0]?.isVideo && (
              <button className="upload-add" onClick={() => input.current?.click()} aria-label="Add more pictures"><Icon name="plus" /></button>
            )}
          </div>
          {items.some((i) => i.failed) && <p className="error">{items.find((i) => i.failed)!.failed} Remove it and try again.</p>}

          <label className="field">
            <span>Caption</span>
            <textarea value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} maxLength={2200} placeholder="Write a caption, add #tags" />
          </label>
          <button className="btn btn-ghost" disabled={!ok.length || suggesting} onClick={() => void suggest()}>
            <Icon name="spark" size={18} /> {suggesting ? "Looking at your picture…" : caption ? "Polish my caption" : "Suggest a caption"}
          </button>

          <label className="toggle">
            <input type="checkbox" checked={allowRemix} onChange={(e) => setAllowRemix(e.target.checked)} />
            <span>
              <strong>Allow remixes</strong>
              <small>Others can turn this post into videos, ads and games. You're always credited.</small>
            </span>
          </label>

          <button className="btn btn-spark btn-wide" disabled={!canPost} onClick={() => void submit()}>
            {posting ? "Posting…" : pending ? `Uploading ${pending}…` : "Post"}
          </button>
        </div>
      )}
    </div>
  );
}
