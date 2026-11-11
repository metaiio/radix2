import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { execFile, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import sharp, { type Metadata } from "sharp";
import type { DB } from "./db.ts";
import type { MediaDTO } from "../shared/types.ts";
import { newUid } from "./auth.ts";

const exec = promisify(execFile);

export interface MediaRow {
  id: number;
  uid: string;
  user_id: number;
  kind: "image" | "video";
  width: number;
  height: number;
  duration: number;
  color: string;
  placeholder: string;
  bytes: number;
  video_ext: string | null;
  has_mp4: number;
  has_large: number;
  alt: string;
}

export class MediaError extends Error {}

const has = (bin: string) => spawnSync(bin, ["-version"], { stdio: "ignore" }).status === 0;
export const FFMPEG = has("ffmpeg");
export const FFPROBE = has("ffprobe");

// Variant widths. Everything is re-encoded to WebP: metadata (EXIF/GPS) is
// stripped and a phone screen never downloads more than it can show.
const THUMB = 360;
const MEDIUM = 1080;
const LARGE = 2160;

sharp.cache({ memory: 64 });

export class MediaStore {
  readonly root: string;
  private db: DB;

  constructor(db: DB, dataDir: string) {
    this.db = db;
    this.root = path.join(dataDir, "media");
    fs.mkdirSync(this.root, { recursive: true });
  }

  dir(uid: string) {
    return path.join(this.root, uid);
  }

  /** Decodes, normalises and stores an image as WebP variants. */
  private async writeImageVariants(uid: string, input: Buffer) {
    let meta: Metadata;
    const open = () => sharp(input, { limitInputPixels: 80_000_000, animated: false }).rotate();
    try {
      meta = await sharp(input, { limitInputPixels: 80_000_000 }).metadata();
    } catch {
      throw new MediaError("That file isn't an image we can read.");
    }
    if (!meta.width || !meta.height) throw new MediaError("That file isn't an image we can read.");
    const rotated = (meta.orientation ?? 1) >= 5;
    const width = rotated ? meta.height : meta.width;
    const height = rotated ? meta.width : meta.height;
    if (width < 16 || height < 16) throw new MediaError("That image is too small.");

    const dir = this.dir(uid);
    await fsp.mkdir(dir, { recursive: true });
    const resize = (w: number) => open().resize({ width: Math.min(w, width), withoutEnlargement: true });
    const hasLarge = width > MEDIUM * 1.25;
    try {
      const jobs: Promise<unknown>[] = [
        resize(THUMB).webp({ quality: 68, effort: 4 }).toFile(path.join(dir, "t.webp")),
        resize(MEDIUM).webp({ quality: 78, effort: 4 }).toFile(path.join(dir, "m.webp")),
      ];
      if (hasLarge) jobs.push(resize(LARGE).webp({ quality: 82, effort: 4 }).toFile(path.join(dir, "l.webp")));
      const [ph, stats] = await Promise.all([
        open().resize(20, 20, { fit: "inside" }).blur(1.2).webp({ quality: 40 }).toBuffer(),
        open().resize(64, 64, { fit: "inside" }).removeAlpha().stats(),
        ...jobs,
      ]);
      const d = stats.dominant;
      const color = "#" + [d.r, d.g, d.b].map((v) => v.toString(16).padStart(2, "0")).join("");
      return { width, height, color, placeholder: `data:image/webp;base64,${ph.toString("base64")}`, hasLarge };
    } catch (err) {
      await fsp.rm(dir, { recursive: true, force: true });
      if (err instanceof MediaError) throw err;
      throw new MediaError("That file isn't an image we can read.");
    }
  }

  async addImage(userId: number, input: Buffer): Promise<MediaRow> {
    const uid = newUid(9);
    const v = await this.writeImageVariants(uid, input);
    const bytes = await this.dirSize(uid);
    this.db.run(
      `INSERT INTO media (uid, user_id, kind, width, height, color, placeholder, bytes, has_large, created_at)
       VALUES (?, ?, 'image', ?, ?, ?, ?, ?, ?, ?)`,
      uid, userId, v.width, v.height, v.color, v.placeholder, bytes, v.hasLarge ? 1 : 0, Date.now(),
    );
    return this.byUid(uid)!;
  }

  /**
   * Stores a video with its poster frame. `hint` comes from the client and is
   * only trusted when ffprobe isn't available to measure the file.
   */
  async addVideo(
    userId: number,
    video: Buffer,
    poster: Buffer,
    hint: { width: number; height: number; duration: number },
  ): Promise<MediaRow> {
    const ext = sniffVideo(video);
    if (!ext) throw new MediaError("Videos must be WebM or MP4.");
    const uid = newUid(9);
    const pv = await this.writeImageVariants(uid, poster);
    const dir = this.dir(uid);
    const file = path.join(dir, `v.${ext}`);
    try {
      await fsp.writeFile(file, video);
      let { width, height, duration } = hint;
      if (FFPROBE) {
        const probed = await probe(file);
        if (!probed) throw new MediaError("That video couldn't be read.");
        width = probed.width;
        height = probed.height;
        if (probed.duration > 0) duration = probed.duration;
      }
      if (!(width > 0 && height > 0)) ({ width, height } = pv);
      duration = Math.min(Math.max(Number(duration) || 0, 0), 600);
      const bytes = await this.dirSize(uid);
      this.db.run(
        `INSERT INTO media (uid, user_id, kind, width, height, duration, color, placeholder, bytes, video_ext, has_mp4, has_large, created_at)
         VALUES (?, ?, 'video', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        uid, userId, Math.round(width), Math.round(height), duration, pv.color, pv.placeholder, bytes,
        ext, ext === "mp4" ? 1 : 0, pv.hasLarge ? 1 : 0, Date.now(),
      );
    } catch (err) {
      await fsp.rm(dir, { recursive: true, force: true });
      throw err;
    }
    // Browsers record WebM; iOS wants H.264. Transcode in the background.
    if (ext !== "mp4" && FFMPEG) void this.transcode(uid, file);
    return this.byUid(uid)!;
  }

  private async transcode(uid: string, src: string) {
    const out = path.join(this.dir(uid), "v.mp4");
    const tmp = out + ".part";
    try {
      await exec("ffmpeg", [
        "-y", "-loglevel", "error", "-i", src,
        "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
        "-vf", "scale=trunc(iw/2)*2:trunc(ih/2)*2", "-c:a", "aac", "-movflags", "+faststart", "-f", "mp4", tmp,
      ], { timeout: 180_000 });
      await fsp.rename(tmp, out);
      this.db.run("UPDATE media SET has_mp4 = 1 WHERE uid = ?", uid);
    } catch {
      await fsp.rm(tmp, { force: true });
    }
  }

  private async dirSize(uid: string) {
    let total = 0;
    for (const f of await fsp.readdir(this.dir(uid))) total += (await fsp.stat(path.join(this.dir(uid), f))).size;
    return total;
  }

  byUid(uid: string) {
    return this.db.get<MediaRow>("SELECT * FROM media WHERE uid = ?", uid);
  }

  /** Reads the 1080px variant, e.g. to hand to the vision model. */
  readMedium(uid: string) {
    return fsp.readFile(path.join(this.dir(uid), "m.webp"));
  }

  /** Removes uploads that were never posted (abandoned drafts) once they're older than `maxAgeMs`. */
  async sweepAbandoned(maxAgeMs: number) {
    const stale = this.db.all<{ id: number }>(
      `SELECT m.id FROM media m WHERE m.created_at < ?
         AND NOT EXISTS (SELECT 1 FROM post_media pm WHERE pm.media_id = m.id)
         AND NOT EXISTS (SELECT 1 FROM users u WHERE u.avatar_media_id = m.id) LIMIT 500`,
      Date.now() - maxAgeMs,
    );
    await this.removeIfOrphaned(stale.map((r) => r.id));
    return stale.length;
  }

  /** Deletes media rows + files that no post references any more. */
  async removeIfOrphaned(ids: number[]) {
    for (const id of ids) {
      const used = this.db.get("SELECT 1 FROM post_media WHERE media_id = ? LIMIT 1", id);
      const avatar = this.db.get("SELECT 1 FROM users WHERE avatar_media_id = ? LIMIT 1", id);
      if (used || avatar) continue;
      const row = this.db.get<MediaRow>("SELECT * FROM media WHERE id = ?", id);
      if (!row) continue;
      this.db.run("DELETE FROM media WHERE id = ?", id);
      await fsp.rm(this.dir(row.uid), { recursive: true, force: true });
    }
  }
}

function sniffVideo(buf: Buffer): "webm" | "mp4" | null {
  if (buf.length < 12) return null;
  if (buf.readUInt32BE(0) === 0x1a45dfa3) return "webm";
  if (buf.toString("latin1", 4, 8) === "ftyp") return "mp4";
  return null;
}

async function probe(file: string) {
  try {
    const { stdout } = await exec("ffprobe", [
      "-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration",
      "-of", "json", file,
    ], { timeout: 20_000 });
    const j = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
    const s = j.streams?.[0];
    if (!s?.width || !s.height) return null;
    const duration = Number(j.format?.duration);
    return { width: s.width, height: s.height, duration: Number.isFinite(duration) ? duration : 0 };
  } catch {
    return null;
  }
}

export function mediaDTO(m: MediaRow): MediaDTO {
  const base = `/media/${m.uid}`;
  const dto: MediaDTO = {
    id: m.uid,
    kind: m.kind,
    w: m.width,
    h: m.height,
    color: m.color,
    ph: m.placeholder,
    alt: m.alt,
    urls: { t: `${base}/t.webp`, m: `${base}/m.webp`, l: `${base}/${m.has_large ? "l" : "m"}.webp` },
  };
  if (m.kind === "video" && m.video_ext) {
    dto.video = {
      src: `${base}/v.${m.video_ext}`,
      type: m.video_ext === "mp4" ? "video/mp4" : "video/webm",
      duration: m.duration,
      ...(m.has_mp4 && m.video_ext !== "mp4" ? { mp4: `${base}/v.mp4` } : {}),
    };
  }
  return dto;
}
