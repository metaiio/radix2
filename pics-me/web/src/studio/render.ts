// Canvas renderers for the Studio. Everything here runs on the device: the
// server (and the AI) only ever plan the edit, they never see or ship pixels.

import type { AdCopy, CameraMove, Storyboard } from "../../../shared/types.ts";
import { scheduleMusic, type Soundtrack } from "./music.ts";

export const FONT = `system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That picture couldn't be loaded."));
    img.src = url;
  });
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const clamp01 = (t: number) => Math.min(Math.max(t, 0), 1);

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

// ---- video -------------------------------------------------------------------

interface Prepared {
  img: HTMLImageElement;
  /** Pre-blurred backdrop (a tiny copy scaled back up), drawn behind pictures that don't fill the frame. */
  backdrop: HTMLCanvasElement | null;
}

function prepare(img: HTMLImageElement, W: number, H: number): Prepared {
  const frame = W / H;
  const ratio = img.naturalWidth / img.naturalHeight;
  // Close enough in shape → crop to fill. Otherwise show the whole picture over a blur.
  if (Math.abs(Math.log(ratio / frame)) < 0.3) return { img, backdrop: null };
  const small = document.createElement("canvas");
  small.width = Math.max(Math.round(W / 24), 8);
  small.height = Math.max(Math.round(H / 24), 8);
  const sctx = small.getContext("2d")!;
  const s = Math.max(small.width / img.naturalWidth, small.height / img.naturalHeight);
  sctx.drawImage(img, (small.width - img.naturalWidth * s) / 2, (small.height - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);
  const backdrop = document.createElement("canvas");
  backdrop.width = W;
  backdrop.height = H;
  const bctx = backdrop.getContext("2d")!;
  bctx.imageSmoothingQuality = "high";
  bctx.drawImage(small, 0, 0, W, H);
  bctx.fillStyle = "rgba(0,0,0,0.35)";
  bctx.fillRect(0, 0, W, H);
  return { img, backdrop };
}

/** Draws one frame of a camera move. `t` runs 0 → 1 across the shot. */
function drawShot(ctx: CanvasRenderingContext2D, p: Prepared, W: number, H: number, move: CameraMove, t: number) {
  const e = ease(clamp01(t));
  const { img } = p;
  const iw = img.naturalWidth, ih = img.naturalHeight;
  let base: number;
  if (p.backdrop) {
    ctx.drawImage(p.backdrop, 0, 0);
    base = Math.min(W / iw, H / ih);
  } else {
    base = Math.max(W / iw, H / ih);
  }
  const ZOOM = 0.16, PAN = 0.07;
  let scale = 1 + ZOOM, dx = 0, dy = 0;
  if (move === "zoom-in") scale = 1 + ZOOM * e;
  else if (move === "zoom-out") scale = 1 + ZOOM * (1 - e);
  else if (move === "pan-left") dx = PAN * (1 - 2 * e);
  else if (move === "pan-right") dx = PAN * (2 * e - 1);
  else if (move === "pan-up") dy = PAN * (1 - 2 * e);
  else if (move === "pan-down") dy = PAN * (2 * e - 1);
  // Pans run at full zoom, which leaves ZOOM/2 of spare picture on each side to travel through.
  if (!p.backdrop) {
    dx *= W * 0.9;
    dy *= H * 0.9;
  } else {
    dx *= W * 0.5;
    dy *= H * 0.5;
  }
  const w = iw * base * scale, h = ih * base * scale;
  ctx.drawImage(img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
}

function drawCaption(ctx: CanvasRenderingContext2D, text: string, W: number, H: number, alpha: number) {
  if (!text || alpha <= 0) return;
  const size = Math.round(W * 0.072);
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.font = `800 ${size}px ${FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  const lines = wrap(ctx, text, W * 0.84).slice(0, 3);
  const lh = size * 1.18;
  const y0 = H * 0.8 - (lines.length - 1) * lh + (1 - alpha) * 14;
  const grad = ctx.createLinearGradient(0, y0 - size * 2.4, 0, H);
  grad.addColorStop(0, "rgba(0,0,0,0)");
  grad.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, y0 - size * 2.4, W, H - y0 + size * 2.4);
  ctx.shadowColor = "rgba(0,0,0,0.55)";
  ctx.shadowBlur = size * 0.35;
  ctx.shadowOffsetY = 2;
  ctx.fillStyle = "#fff";
  lines.forEach((l, i) => ctx.fillText(l, W / 2, y0 + i * lh));
  ctx.restore();
}

export interface VideoResult {
  blob: Blob;
  poster: Blob;
  width: number;
  height: number;
  duration: number;
}

export const VIDEO_FORMATS = {
  vertical: { label: "9:16", width: 720, height: 1280 },
  square: { label: "1:1", width: 720, height: 720 },
} as const;
export type VideoFormat = keyof typeof VIDEO_FORMATS;

export function videoSupported() {
  return typeof MediaRecorder !== "undefined" && typeof HTMLCanvasElement.prototype.captureStream === "function" && pickMime(false) !== "";
}

function pickMime(audio: boolean) {
  if (typeof MediaRecorder === "undefined") return "";
  const options = audio
    ? ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["video/mp4;codecs=avc1.42E01E", "video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"];
  return options.find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
}

const XFADE = 0.4;

/**
 * Plays the storyboard on a canvas in real time and records it. Rendering
 * takes as long as the video runs; keep the tab in the foreground.
 */
export async function renderVideo(
  images: HTMLImageElement[],
  board: Storyboard,
  opts: {
    format: VideoFormat;
    canvas?: HTMLCanvasElement;
    onProgress?: (p: number) => void;
    signal?: AbortSignal;
    /** A running AudioContext (created inside the user's tap) and the soundtrack to synthesise into the recording. */
    music?: { ctx: AudioContext; style: Exclude<Soundtrack, "none"> };
  },
): Promise<VideoResult> {
  const { width: W, height: H } = VIDEO_FORMATS[opts.format];
  const canvas = opts.canvas ?? document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingQuality = "high";

  const shots = board.shots.filter((s) => images[s.mediaIndex]);
  if (!shots.length) throw new Error("The storyboard has no shots to render.");
  const prepared = new Map<number, Prepared>();
  for (const s of shots) if (!prepared.has(s.mediaIndex)) prepared.set(s.mediaIndex, prepare(images[s.mediaIndex]!, W, H));
  const starts: number[] = [];
  let total = 0;
  for (const s of shots) {
    starts.push(total);
    total += s.seconds;
  }

  const frame = (time: number) => {
    let i = shots.length - 1;
    while (i > 0 && time < starts[i]!) i--;
    const shot = shots[i]!;
    const local = time - starts[i]!;
    ctx.globalAlpha = 1;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, W, H);
    // The outgoing shot keeps moving underneath while the new one fades in.
    if (i > 0 && local < XFADE) {
      const prev = shots[i - 1]!;
      drawShot(ctx, prepared.get(prev.mediaIndex)!, W, H, prev.move, (prev.seconds + local) / (prev.seconds + XFADE));
      ctx.globalAlpha = clamp01(local / XFADE);
    }
    drawShot(ctx, prepared.get(shot.mediaIndex)!, W, H, shot.move, local / (shot.seconds + XFADE));
    ctx.globalAlpha = 1;
    const fade = Math.min(clamp01((local - 0.15) / 0.35), clamp01((shot.seconds - local) / 0.3));
    drawCaption(ctx, shot.text, W, H, fade);
  };

  frame(Math.min(shots[0]!.seconds * 0.6, total / 2));
  const poster = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't capture a poster frame."))), "image/jpeg", 0.86));
  frame(0);

  const mimeType = pickMime(!!opts.music);
  let stream = canvas.captureStream(30);
  if (opts.music) {
    const { ctx: actx, style } = opts.music;
    await actx.resume().catch(() => {});
    const dest = actx.createMediaStreamDestination();
    scheduleMusic(actx, dest, style, total);
    stream = new MediaStream([...stream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
  }
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 3_500_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  return new Promise<VideoResult>((resolve, reject) => {
    let raf = 0;
    const stop = () => {
      cancelAnimationFrame(raf);
      stream.getTracks().forEach((t) => t.stop());
    };
    recorder.onerror = () => {
      stop();
      reject(new Error("Recording failed on this device."));
    };
    recorder.onstop = () => {
      stop();
      if (opts.signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
      resolve({ blob: new Blob(chunks, { type: mimeType.split(";")[0] }), poster, width: W, height: H, duration: total });
    };
    opts.signal?.addEventListener("abort", () => recorder.state !== "inactive" && recorder.stop());

    recorder.start(250);
    const t0 = performance.now();
    const tick = () => {
      const time = (performance.now() - t0) / 1000;
      if (time >= total) {
        frame(total - 0.001);
        opts.onProgress?.(1);
        // Give the encoder a beat to take the last frame.
        setTimeout(() => recorder.state !== "inactive" && recorder.stop(), 120);
        return;
      }
      frame(time);
      opts.onProgress?.(time / total);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
  });
}

// ---- ads ---------------------------------------------------------------------

export const AD_FORMATS = {
  portrait: { label: "4:5 feed", width: 1080, height: 1350 },
  square: { label: "1:1 square", width: 1080, height: 1080 },
  story: { label: "9:16 story", width: 1080, height: 1920 },
} as const;
export type AdFormat = keyof typeof AD_FORMATS;

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => (v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Composes the ad onto `canvas`: picture, scrim, brand, headline, subhead, button. */
export function drawAd(canvas: HTMLCanvasElement, img: HTMLImageElement, copy: AdCopy, brand: string, format: AdFormat) {
  const { width: W, height: H } = AD_FORMATS[format];
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d", { alpha: false })!;
  ctx.imageSmoothingQuality = "high";
  const s = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  ctx.drawImage(img, (W - img.naturalWidth * s) / 2, (H - img.naturalHeight * s) / 2, img.naturalWidth * s, img.naturalHeight * s);

  const pad = 84;
  const maxW = W - pad * 2;
  ctx.textBaseline = "alphabetic";
  const centered = copy.layout === "center";
  ctx.textAlign = centered ? "center" : "left";
  const x = centered ? W / 2 : pad;

  // Fit the headline: shrink until it sets in three lines or fewer.
  let hSize = 118;
  let hLines: string[] = [];
  for (; hSize >= 56; hSize -= 6) {
    ctx.font = `800 ${hSize}px ${FONT}`;
    hLines = wrap(ctx, copy.headline, maxW);
    if (hLines.length <= 3 && hLines.every((l) => ctx.measureText(l).width <= maxW)) break;
  }
  const hLH = hSize * 1.06;
  const subSize = 40;
  ctx.font = `500 ${subSize}px ${FONT}`;
  const subLines = copy.subhead ? wrap(ctx, copy.subhead, maxW).slice(0, 3) : [];
  const subLH = subSize * 1.32;
  const brandSize = 30;
  const brandH = brand ? brandSize + 30 : 0;
  const ctaH = copy.cta ? 104 : 0;
  const ctaGap = copy.cta ? 44 : 0;
  const block = brandH + hLines.length * hLH + (subLines.length ? 22 + subLines.length * subLH : 0) + ctaGap + ctaH;

  let top: number;
  const scrim = ctx.createLinearGradient(0, 0, 0, H);
  if (copy.layout === "top") {
    top = pad + 20;
    scrim.addColorStop(0, "rgba(0,0,0,0.72)");
    scrim.addColorStop(Math.min((top + block + 160) / H, 1), "rgba(0,0,0,0)");
    scrim.addColorStop(1, "rgba(0,0,0,0)");
  } else if (centered) {
    top = (H - block) / 2;
    scrim.addColorStop(0, "rgba(0,0,0,0.5)");
    scrim.addColorStop(1, "rgba(0,0,0,0.5)");
  } else {
    top = H - pad - block;
    scrim.addColorStop(0, "rgba(0,0,0,0)");
    scrim.addColorStop(Math.max((top - 200) / H, 0), "rgba(0,0,0,0)");
    scrim.addColorStop(1, "rgba(0,0,0,0.8)");
  }
  ctx.fillStyle = scrim;
  ctx.fillRect(0, 0, W, H);

  let y = top;
  ctx.fillStyle = "#fff";
  ctx.shadowColor = "rgba(0,0,0,0.35)";
  ctx.shadowBlur = 18;
  if (brand) {
    ctx.font = `700 ${brandSize}px ${FONT}`;
    ctx.letterSpacing = "5px";
    ctx.globalAlpha = 0.92;
    ctx.fillText(brand.toUpperCase(), x, y + brandSize);
    ctx.globalAlpha = 1;
    ctx.letterSpacing = "0px";
    y += brandH;
  }
  ctx.font = `800 ${hSize}px ${FONT}`;
  ctx.letterSpacing = "-2px";
  for (const line of hLines) {
    y += hLH;
    ctx.fillText(line, x, y - hSize * 0.12);
  }
  ctx.letterSpacing = "0px";
  if (subLines.length) {
    y += 22;
    ctx.font = `500 ${subSize}px ${FONT}`;
    ctx.globalAlpha = 0.94;
    for (const line of subLines) {
      y += subLH;
      ctx.fillText(line, x, y - subSize * 0.28);
    }
    ctx.globalAlpha = 1;
  }
  if (copy.cta) {
    y += ctaGap;
    ctx.font = `700 40px ${FONT}`;
    const tw = ctx.measureText(copy.cta).width;
    const bw = tw + 104;
    const bx = centered ? (W - bw) / 2 : pad;
    ctx.shadowBlur = 24;
    ctx.fillStyle = copy.accent;
    roundRect(ctx, bx, y, bw, ctaH, ctaH / 2);
    ctx.fill();
    ctx.shadowColor = "transparent";
    ctx.fillStyle = luminance(copy.accent) > 0.4 ? "#111" : "#fff";
    ctx.textAlign = "center";
    ctx.fillText(copy.cta, bx + bw / 2, y + ctaH / 2 + 14);
  }
  ctx.shadowColor = "transparent";
}

export const canvasBlob = (canvas: HTMLCanvasElement, quality = 0.9) =>
  new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't export the image."))), "image/jpeg", quality));

// ---- uploads -----------------------------------------------------------------

const MAX_EDGE = 2560;

/**
 * Shrinks a photo before upload when it's bigger than anything we serve, so
 * a 12 MB camera original goes up as well under a megabyte. Falls back to the
 * original file if the browser can't decode it.
 */
export async function shrinkForUpload(file: File): Promise<Blob> {
  if (file.type === "image/gif" || file.size < 600_000) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    if (scale === 1 && file.size < 3_000_000) return (bmp.close(), file);
    const c = document.createElement("canvas");
    c.width = Math.round(bmp.width * scale);
    c.height = Math.round(bmp.height * scale);
    const ctx = c.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    bmp.close();
    const out = await canvasBlob(c, 0.9);
    return out.size < file.size ? out : file;
  } catch {
    return file;
  }
}

/** Grabs a poster frame and the dimensions of a video file the user picked. */
export function inspectVideo(file: File): Promise<{ poster: Blob; width: number; height: number; duration: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That video couldn't be read on this device."));
    };
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onerror = fail;
    v.onloadeddata = () => {
      v.currentTime = Math.min(0.5, (v.duration || 1) / 3);
    };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext("2d")!.drawImage(v, 0, 0);
      canvasBlob(c, 0.85).then((poster) => {
        URL.revokeObjectURL(url);
        resolve({ poster, width: v.videoWidth, height: v.videoHeight, duration: Number.isFinite(v.duration) ? v.duration : 0 });
      }, fail);
    };
    v.src = url;
  });
}
