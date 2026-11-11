import fs from "node:fs";
import path from "node:path";
import { PassThrough } from "node:stream";
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from "fastify";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import { z } from "zod";
import {
  DEFAULT_SETTINGS, LENSES,
  type CommentDTO, type Lens, type NotificationDTO, type PostDTO, type PostMeta, type ProfileDTO, type ReportDTO, type ScoreDTO, type Settings, type UserDTO,
} from "../shared/types.ts";
import { AI, type AiImage } from "./ai.ts";
import { createSession, destroySession, hashPassword, newUid, readToken, sessionCookie, sessionUser, verifyPassword } from "./auth.ts";
import type { Config } from "./config.ts";
import { DB } from "./db.ts";
import { MediaError, MediaStore, mediaDTO, type MediaRow } from "./media.ts";
import { ZipWriter } from "./zip.ts";

class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
const bad = (msg: string) => new HttpError(400, msg);
const notFound = (what = "Not found") => new HttpError(404, what);

interface PostRow {
  id: number;
  uid: string;
  user_id: number;
  kind: PostDTO["kind"];
  caption: string;
  remix_of: number | null;
  allow_remix: number;
  visibility: PostDTO["visibility"];
  meta: string;
  like_count: number;
  comment_count: number;
  remix_count: number;
  created_at: number;
}

interface UserRow {
  id: number;
  username: string;
  display_name: string;
  avatar_uid: string | null;
}

const USER_SELECT = `SELECT u.id, u.username, u.display_name, m.uid AS avatar_uid
  FROM users u LEFT JOIN media m ON m.id = u.avatar_media_id`;

const userDTO = (u: UserRow): UserDTO => ({
  username: u.username,
  displayName: u.display_name,
  avatar: u.avatar_uid ? `/media/${u.avatar_uid}/t.webp` : null,
});

// Who may see a post (alias `p`). Each fragment takes the viewer id for every `?`
// (0 when signed out) — see `nb()` and `vis()` below.
const NOBLOCK = `NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ? AND b.blocked_id = p.user_id) OR (b.blocker_id = p.user_id AND b.blocked_id = ?))`;
const VISIBLE = `(p.visibility = 'public' OR p.user_id = ? OR EXISTS (SELECT 1 FROM circle c WHERE c.owner_id = p.user_id AND c.member_id = ?)) AND ${NOBLOCK}`;
const PUBLIC = `p.visibility = 'public' AND ${NOBLOCK}`;
const nb = (v: number | null) => [v ?? 0, v ?? 0];
const vis = (v: number | null) => [v ?? 0, v ?? 0, v ?? 0, v ?? 0];

const TAG_RE = /#([\p{L}\p{N}_]{1,32})/gu;
const PAGE = 12;
const FRESH_VOICE_MAX = 25;
const WINDOW = 5000;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const like = (s: string) => s.replace(/[\\%_]/g, (c) => "\\" + c);
const qs = (n: number) => Array(n).fill("?").join(",");

const Signup = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_.]{3,24}$/, "Usernames are 3–24 letters, numbers, dots or underscores."),
  email: z.string().trim().toLowerCase().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address.").max(254),
  password: z.string().min(8, "Use at least 8 characters for your password.").max(200),
});
const Login = z.object({ login: z.string().trim().min(1).max(254), password: z.string().min(1).max(200) });
const SettingsPatch = z.object({
  quietCounts: z.boolean(),
  breakEvery: z.number().int().min(0).max(200),
  autoplay: z.boolean(),
  lens: z.enum(Object.keys(LENSES) as [Lens, ...Lens[]]),
}).partial();
const ProfilePatch = z.object({
  displayName: z.string().trim().min(1).max(40).optional(),
  bio: z.string().trim().max(200).optional(),
  avatarMediaId: z.string().max(40).nullable().optional(),
  settings: SettingsPatch.optional(),
});
const NewPost = z.object({
  kind: z.enum(["photo", "video", "ad", "game"]),
  caption: z.string().trim().max(2200).default(""),
  mediaIds: z.array(z.string().max(40)).min(1).max(10),
  remixOf: z.string().max(40).optional(),
  allowRemix: z.boolean().default(true),
  visibility: z.enum(["public", "circle"]).default("public"),
  meta: z
    .object({
      game: z.object({
        type: z.enum(["slide", "swap", "memory", "spot"]),
        size: z.number().int().min(3).max(7),
        seed: z.number().int().min(0).max(2 ** 31).optional(),
      }).optional(),
      ad: z
        .object({
          brand: z.string().trim().max(60),
          headline: z.string().trim().max(80),
          cta: z.string().trim().max(30),
          link: z.string().trim().max(300).regex(/^https?:\/\//i).optional(),
        })
        .optional(),
      ai: z.enum(["claude", "local"]).optional(),
    })
    .default({}),
});
const NewComment = z.object({ body: z.string().trim().min(1, "Write something first.").max(500) });
const NewScore = z.object({ ms: z.number().int().min(300).max(3_600_000), moves: z.number().int().min(1).max(100_000) });
const Report = z.object({ reason: z.string().trim().min(1).max(300) });
const AiCaption = z.object({ mediaId: z.string().max(40), hint: z.string().trim().max(300).default("") });
const AiAd = z.object({
  mediaId: z.string().max(40),
  brand: z.string().trim().max(60).default(""),
  product: z.string().trim().max(120).default(""),
  tone: z.string().trim().max(60).default(""),
});
const AiStoryboard = z.object({ mediaIds: z.array(z.string().max(40)).min(1).max(8), vibe: z.string().trim().max(120).default("") });

export interface App {
  server: FastifyInstance;
  db: DB;
  media: MediaStore;
  ai: AI;
}

export async function buildApp(cfg: Config, dbFile = path.join(cfg.dataDir, "pics.db")): Promise<App> {
  const db = new DB(dbFile);
  const media = new MediaStore(db, cfg.dataDir);
  const ai = new AI(cfg);
  const server = Fastify({ logger: cfg.production, trustProxy: cfg.trustProxy, bodyLimit: 256 * 1024 });

  await server.register(multipart, { limits: { fileSize: cfg.maxVideoBytes, files: 2, fields: 6 } });

  // ---- cross-cutting -------------------------------------------------------

  const parse = <S extends z.ZodType>(schema: S, body: unknown): z.infer<S> => {
    const r = schema.safeParse(body ?? {});
    if (!r.success) throw bad(r.error.issues[0]?.message ?? "Invalid request.");
    return r.data;
  };

  const viewer = (req: FastifyRequest) => sessionUser(db, readToken(req.headers));
  const requireUser = (req: FastifyRequest) => {
    const id = viewer(req);
    if (!id) throw new HttpError(401, "Sign in to do that.");
    return id;
  };
  const isAdmin = (id: number | null) => {
    if (!id || !cfg.admins.length) return false;
    const u = db.get<{ username: string }>("SELECT username FROM users WHERE id = ?", id);
    return !!u && cfg.admins.includes(u.username.toLowerCase());
  };

  const buckets = new Map<string, { n: number; reset: number }>();
  const limit = (req: FastifyRequest, group: string, perMinute: number) => {
    const key = `${group}:${req.ip}`;
    const now = Date.now();
    let b = buckets.get(key);
    if (!b || b.reset < now) buckets.set(key, (b = { n: 0, reset: now + 60_000 }));
    if (++b.n > perMinute * cfg.rateScale) throw new HttpError(429, "You're going a little fast — try again in a minute.");
  };
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.reset < now) buckets.delete(k);
    db.run("DELETE FROM sessions WHERE expires_at < ?", now);
  }, 60_000);
  sweep.unref();
  // Hourly: drop uploads that never made it into a post, and activity older than 90 days.
  const janitor = setInterval(() => {
    void media.sweepAbandoned(864e5).catch(() => {});
    db.run("DELETE FROM notifications WHERE created_at < ?", Date.now() - 90 * 864e5);
  }, 3600_000);
  janitor.unref();

  server.addHook("onClose", async () => {
    clearInterval(sweep);
    clearInterval(janitor);
    db.close();
  });

  server.addHook("onRequest", async (req, reply) => {
    reply.header("X-Content-Type-Options", "nosniff");
    reply.header("Referrer-Policy", "strict-origin-when-cross-origin");
    // Cookies are SameSite=Lax; additionally refuse cross-origin writes outright.
    if (req.method !== "GET" && req.method !== "HEAD" && req.headers.origin) {
      let host = "";
      try {
        host = new URL(req.headers.origin).host;
      } catch { /* malformed origin → rejected below */ }
      if (host !== req.headers.host) throw new HttpError(403, "Cross-origin request blocked.");
    }
  });

  server.setErrorHandler((err: unknown, req, reply) => {
    const e = err as { status?: number; statusCode?: number; code?: string; message?: string };
    if (err instanceof HttpError) return reply.status(err.status).send({ error: err.message });
    if (err instanceof MediaError) return reply.status(400).send({ error: err.message });
    if (e.code === "FST_REQ_FILE_TOO_LARGE") return reply.status(413).send({ error: "That file is too large." });
    if (e.statusCode && e.statusCode < 500) return reply.status(e.statusCode).send({ error: e.message ?? "Bad request." });
    req.log.error(err);
    if (!cfg.production) console.error(err);
    return reply.status(500).send({ error: "Something went wrong on our side." });
  });

  // ---- hydration -----------------------------------------------------------

  const usersById = (ids: number[]) => {
    const map = new Map<number, UserRow>();
    if (ids.length) for (const u of db.all<UserRow>(`${USER_SELECT} WHERE u.id IN (${qs(ids.length)})`, ...ids)) map.set(u.id, u);
    return map;
  };

  function hydrate(rows: PostRow[], viewerId: number | null): PostDTO[] {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const authors = usersById([...new Set(rows.map((r) => r.user_id))]);
    const mediaByPost = new Map<number, MediaRow[]>();
    for (const m of db.all<MediaRow & { post_id: number }>(
      `SELECT pm.post_id, m.* FROM post_media pm JOIN media m ON m.id = pm.media_id
       WHERE pm.post_id IN (${qs(ids.length)}) ORDER BY pm.post_id, pm.position`, ...ids,
    )) {
      const list = mediaByPost.get(m.post_id) ?? [];
      list.push(m);
      mediaByPost.set(m.post_id, list);
    }
    const mine = (table: "likes" | "saves") => {
      const set = new Set<number>();
      if (viewerId) {
        for (const l of db.all<{ post_id: number }>(
          `SELECT post_id FROM ${table} WHERE user_id = ? AND post_id IN (${qs(ids.length)})`, viewerId, ...ids,
        )) set.add(l.post_id);
      }
      return set;
    };
    const liked = mine("likes"), saved = mine("saves");
    const sourceIds = [...new Set(rows.map((r) => r.remix_of).filter((v): v is number => v != null))];
    const sources = new Map<number, { id: string; author: string }>();
    if (sourceIds.length) {
      // Credit only sources the viewer could open themselves.
      for (const s of db.all<{ id: number; uid: string; username: string }>(
        `SELECT p.id, p.uid, u.username FROM posts p JOIN users u ON u.id = p.user_id WHERE p.id IN (${qs(sourceIds.length)}) AND ${VISIBLE}`,
        ...sourceIds, ...vis(viewerId),
      )) sources.set(s.id, { id: s.uid, author: s.username });
    }
    return rows.map((r) => ({
      id: r.uid,
      kind: r.kind,
      caption: r.caption,
      createdAt: r.created_at,
      author: userDTO(authors.get(r.user_id)!),
      media: (mediaByPost.get(r.id) ?? []).map(mediaDTO),
      likeCount: r.like_count,
      commentCount: r.comment_count,
      remixCount: r.remix_count,
      liked: liked.has(r.id),
      saved: saved.has(r.id),
      visibility: r.visibility,
      allowRemix: r.allow_remix === 1,
      remixOf: r.remix_of != null ? (sources.get(r.remix_of) ?? null) : null,
      meta: JSON.parse(r.meta) as PostMeta,
    }));
  }

  /** Loads a post the viewer is allowed to see; anything else looks like it doesn't exist. */
  const postFor = (uid: string, viewerId: number | null) => {
    const row = db.get<PostRow>(`SELECT p.* FROM posts p WHERE p.uid = ? AND ${VISIBLE}`, uid, ...vis(viewerId));
    if (!row) throw notFound("That post doesn't exist any more.");
    return row;
  };
  const postRow = (id: number) => db.get<PostRow>("SELECT * FROM posts WHERE id = ?", id)!;

  /** Loads a user; someone who has blocked the viewer is indistinguishable from a missing account. */
  const userFor = (username: string, viewerId: number | null) => {
    const row = db.get<UserRow>(`${USER_SELECT} WHERE u.username = ?`, username);
    if (!row || (viewerId && db.get("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?", row.id, viewerId))) {
      throw notFound("No one here by that name.");
    }
    return row;
  };

  /** Keyset pagination on post id (newest first). `scope` already contains its own visibility rule. */
  function pageById(scope: string, params: (string | number)[], cursor: string | undefined, viewerId: number | null, size = PAGE) {
    const before = Number(cursor) || Number.MAX_SAFE_INTEGER;
    const rows = db.all<PostRow>(`SELECT p.* FROM posts p WHERE ${scope} AND p.id < ? ORDER BY p.id DESC LIMIT ?`, ...params, before, size + 1);
    const more = rows.length > size;
    const items = rows.slice(0, size);
    return { rows: items, items: hydrate(items, viewerId), next: more ? String(items[items.length - 1]!.id) : null };
  }

  const settingsOf = (raw: string): Settings => {
    try {
      return { ...DEFAULT_SETTINGS, ...(SettingsPatch.safeParse(JSON.parse(raw)).data ?? {}) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  };

  function meDTO(id: number) {
    const u = db.get<UserRow & { bio: string; email: string; settings: string }>(
      `SELECT u.id, u.username, u.display_name, u.bio, u.email, u.settings, m.uid AS avatar_uid
       FROM users u LEFT JOIN media m ON m.id = u.avatar_media_id WHERE u.id = ?`, id,
    );
    if (!u) return null;
    const unread = db.get<{ n: number }>("SELECT count(*) AS n FROM notifications WHERE user_id = ? AND read = 0", id)!.n;
    return { ...userDTO(u), bio: u.bio, email: u.email, settings: settingsOf(u.settings), unread, isAdmin: isAdmin(id) };
  }

  /** Records activity for someone's inbox. Never for your own actions, never across a block. */
  function notify(userId: number, actorId: number, kind: NotificationDTO["kind"], postId: number | null) {
    if (userId === actorId) return;
    if (db.get("SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_id = ?) OR (blocker_id = ? AND blocked_id = ?)", userId, actorId, actorId, userId)) return;
    db.run("INSERT INTO notifications (user_id, actor_id, kind, post_id, created_at) VALUES (?, ?, ?, ?, ?)", userId, actorId, kind, postId, Date.now());
  }

  async function removePost(post: PostRow) {
    const mediaIds = db.all<{ media_id: number }>("SELECT media_id FROM post_media WHERE post_id = ?", post.id).map((r) => r.media_id);
    db.tx(() => {
      db.run("DELETE FROM posts WHERE id = ?", post.id);
      if (post.remix_of) db.run("UPDATE posts SET remix_count = max(remix_count - 1, 0) WHERE id = ?", post.remix_of);
    });
    const own = mediaIds.filter((mid) => db.get<{ user_id: number }>("SELECT user_id FROM media WHERE id = ?", mid)?.user_id === post.user_id);
    await media.removeIfOrphaned(own);
  }

  // ---- auth ----------------------------------------------------------------

  const startSession = (reply: FastifyReply, userId: number) => {
    const token = createSession(db, userId);
    reply.header("Set-Cookie", sessionCookie(token, cfg.cookieSecure));
    // The token is also returned for native clients, which send it as a Bearer header.
    return { user: meDTO(userId), token };
  };

  server.post("/api/auth/signup", async (req, reply) => {
    limit(req, "auth", 10);
    const body = parse(Signup, req.body);
    if (db.get("SELECT 1 FROM users WHERE username = ?", body.username)) throw new HttpError(409, "That username is taken.");
    if (db.get("SELECT 1 FROM users WHERE email = ?", body.email)) throw new HttpError(409, "There's already an account with that email.");
    const hash = await hashPassword(body.password);
    const res = db.run(
      "INSERT INTO users (username, email, pass_hash, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
      body.username, body.email, hash, body.username, Date.now(),
    );
    return startSession(reply, Number(res.lastInsertRowid));
  });

  server.post("/api/auth/login", async (req, reply) => {
    limit(req, "auth", 10);
    const body = parse(Login, req.body);
    const u = db.get<{ id: number; pass_hash: string }>(
      "SELECT id, pass_hash FROM users WHERE username = ? OR email = ?", body.login, body.login,
    );
    if (!u || !(await verifyPassword(body.password, u.pass_hash))) throw new HttpError(401, "Wrong username or password.");
    return startSession(reply, u.id);
  });

  server.post("/api/auth/logout", async (req, reply) => {
    destroySession(db, readToken(req.headers));
    reply.header("Set-Cookie", sessionCookie(null, cfg.cookieSecure));
    return { ok: true };
  });

  server.get("/api/me", async (req) => {
    const id = viewer(req);
    return { user: id ? meDTO(id) : null, ai: ai.provider };
  });

  server.patch("/api/me", async (req) => {
    const id = requireUser(req);
    const body = parse(ProfilePatch, req.body);
    if (body.displayName !== undefined) db.run("UPDATE users SET display_name = ? WHERE id = ?", body.displayName, id);
    if (body.bio !== undefined) db.run("UPDATE users SET bio = ? WHERE id = ?", body.bio, id);
    if (body.settings) {
      const cur = settingsOf(db.get<{ settings: string }>("SELECT settings FROM users WHERE id = ?", id)!.settings);
      db.run("UPDATE users SET settings = ? WHERE id = ?", JSON.stringify({ ...cur, ...body.settings }), id);
    }
    if (body.avatarMediaId !== undefined) {
      const prev = db.get<{ avatar_media_id: number | null }>("SELECT avatar_media_id FROM users WHERE id = ?", id);
      let next: number | null = null;
      if (body.avatarMediaId) {
        const m = media.byUid(body.avatarMediaId);
        if (!m || m.user_id !== id || m.kind !== "image") throw bad("Pick one of your own pictures.");
        next = m.id;
      }
      db.run("UPDATE users SET avatar_media_id = ? WHERE id = ?", next, id);
      if (prev?.avatar_media_id && prev.avatar_media_id !== next) await media.removeIfOrphaned([prev.avatar_media_id]);
    }
    return { user: meDTO(id) };
  });

  server.delete("/api/me", async (req, reply) => {
    const id = requireUser(req);
    limit(req, "auth", 10);
    const { password } = parse(z.object({ password: z.string().max(200) }), req.body);
    const u = db.get<{ pass_hash: string }>("SELECT pass_hash FROM users WHERE id = ?", id)!;
    if (!(await verifyPassword(password, u.pass_hash))) throw new HttpError(401, "That password isn't right.");
    const mine = db.all<{ id: number; uid: string }>("SELECT id, uid FROM media WHERE user_id = ?", id);
    db.tx(() => {
      const touched = db.all<{ post_id: number }>(
        "SELECT post_id FROM likes WHERE user_id = ? UNION SELECT post_id FROM comments WHERE user_id = ?", id, id,
      );
      const remixed = db.all<{ remix_of: number }>("SELECT DISTINCT remix_of FROM posts WHERE user_id = ? AND remix_of IS NOT NULL", id);
      // Other people's game posts that are built on this user's pictures go too.
      db.run("DELETE FROM posts WHERE user_id != ? AND id IN (SELECT pm.post_id FROM post_media pm JOIN media m ON m.id = pm.media_id WHERE m.user_id = ?)", id, id);
      db.run("DELETE FROM posts WHERE user_id = ?", id);
      db.run("DELETE FROM users WHERE id = ?", id);
      for (const t of touched) {
        db.run(
          "UPDATE posts SET like_count = (SELECT count(*) FROM likes WHERE post_id = posts.id), comment_count = (SELECT count(*) FROM comments WHERE post_id = posts.id) WHERE id = ?",
          t.post_id,
        );
      }
      for (const r of remixed) db.run("UPDATE posts SET remix_count = (SELECT count(*) FROM posts c WHERE c.remix_of = posts.id) WHERE id = ?", r.remix_of);
    });
    for (const m of mine) await fs.promises.rm(media.dir(m.uid), { recursive: true, force: true });
    reply.header("Set-Cookie", sessionCookie(null, cfg.cookieSecure));
    return { ok: true };
  });

  /** Everything you've put on pics.me, as a ZIP: your pictures and videos plus a readable data.json. */
  server.get("/api/me/export", async (req, reply) => {
    const id = requireUser(req);
    limit(req, "export", 3);
    const me = meDTO(id)!;
    const posts = db.all<PostRow>("SELECT * FROM posts WHERE user_id = ? ORDER BY id", id);
    const files: { name: string; file: string }[] = [];
    const postData = hydrate(posts, id).map((p, i) => ({
      id: p.id,
      kind: p.kind,
      caption: p.caption,
      createdAt: new Date(p.createdAt).toISOString(),
      visibility: p.visibility,
      likes: p.likeCount,
      comments: p.commentCount,
      remixOf: p.remixOf,
      files: p.media.map((m, j) => {
        const src = m.video ? m.video.src : m.urls.l;
        const name = `media/${String(i + 1).padStart(4, "0")}-${p.id}-${j + 1}${path.extname(src)}`;
        files.push({ name, file: path.join(media.root, src.replace("/media/", "")) });
        return name;
      }),
    }));
    const data = {
      exportedAt: new Date().toISOString(),
      profile: { username: me.username, displayName: me.displayName, bio: me.bio, email: me.email, settings: me.settings },
      posts: postData,
      comments: db.all("SELECT c.body, c.created_at AS createdAt, p.uid AS post FROM comments c JOIN posts p ON p.id = c.post_id WHERE c.user_id = ? ORDER BY c.id", id),
      likes: db.all<{ uid: string }>("SELECT p.uid FROM likes l JOIN posts p ON p.id = l.post_id WHERE l.user_id = ?", id).map((r) => r.uid),
      saved: db.all<{ uid: string }>("SELECT p.uid FROM saves s JOIN posts p ON p.id = s.post_id WHERE s.user_id = ?", id).map((r) => r.uid),
      following: db.all<{ username: string }>("SELECT u.username FROM follows f JOIN users u ON u.id = f.followee_id WHERE f.follower_id = ?", id).map((r) => r.username),
      followers: db.all<{ username: string }>("SELECT u.username FROM follows f JOIN users u ON u.id = f.follower_id WHERE f.followee_id = ?", id).map((r) => r.username),
      closeCircle: db.all<{ username: string }>("SELECT u.username FROM circle c JOIN users u ON u.id = c.member_id WHERE c.owner_id = ?", id).map((r) => r.username),
    };
    const out = new PassThrough();
    const zip = new ZipWriter(out);
    void (async () => {
      try {
        await zip.add("data.json", Buffer.from(JSON.stringify(data, null, 2)));
        for (const f of files) {
          const buf = await fs.promises.readFile(f.file).catch(() => null);
          if (buf) await zip.add(f.name, buf);
        }
        await zip.end();
      } catch (err) {
        out.destroy(err as Error);
      }
    })();
    return reply
      .header("Content-Type", "application/zip")
      .header("Content-Disposition", `attachment; filename="pics.me-${me.username}.zip"`)
      .header("Cache-Control", "no-store")
      .send(out);
  });

  // ---- media ---------------------------------------------------------------

  server.post("/api/media", async (req) => {
    const id = requireUser(req);
    limit(req, "upload", 40);
    if (!req.isMultipart()) throw bad("Send the file as multipart form data.");
    const files: Record<string, { buf: Buffer; mime: string }> = {};
    const fields: Record<string, string> = {};
    for await (const part of req.parts()) {
      if (part.type === "file") files[part.fieldname] = { buf: await part.toBuffer(), mime: part.mimetype };
      else fields[part.fieldname] = String(part.value);
    }
    const file = files.file;
    if (!file?.buf.length) throw bad("No file received.");
    if (files.poster) {
      if (files.poster.buf.length > cfg.maxImageBytes) throw new HttpError(413, "That file is too large.");
      const row = await media.addVideo(id, file.buf, files.poster.buf, {
        width: Number(fields.width) || 0,
        height: Number(fields.height) || 0,
        duration: Number(fields.duration) || 0,
      });
      return { media: mediaDTO(row) };
    }
    if (file.buf.length > cfg.maxImageBytes) throw new HttpError(413, "That picture is too large.");
    return { media: mediaDTO(await media.addImage(id, file.buf)) };
  });

  // ---- posts ---------------------------------------------------------------

  server.post("/api/posts", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 30);
    const body = parse(NewPost, req.body);
    const source = body.remixOf ? postFor(body.remixOf, id) : null;
    if (source && source.user_id !== id && !source.allow_remix) throw new HttpError(403, "The creator has turned off remixes for this post.");

    const rows = body.mediaIds.map((uid) => {
      const m = media.byUid(uid);
      if (!m) throw bad("One of those files is missing — try uploading again.");
      // A game is played on the original picture, so it may reference the source post's media.
      const fromSource = source != null && body.kind === "game" &&
        db.get("SELECT 1 FROM post_media WHERE post_id = ? AND media_id = ?", source.id, m.id) != null;
      if (m.user_id !== id && !fromSource) throw new HttpError(403, "You can only post your own uploads.");
      return m;
    });
    const images = rows.every((m) => m.kind === "image");
    const meta: PostMeta = {};
    if (body.meta.ai) meta.ai = body.meta.ai;
    if (body.kind === "photo" && !images) throw bad("Photo posts can only contain pictures.");
    if (body.kind === "video" && !(rows.length === 1 && rows[0]!.kind === "video")) throw bad("A video post needs exactly one video.");
    if (body.kind === "ad") {
      if (!(rows.length === 1 && images)) throw bad("An ad post needs exactly one picture.");
      if (body.meta.ad) meta.ad = body.meta.ad;
    }
    if (body.kind === "game") {
      if (!(rows.length === 1 && images) || !body.meta.game) throw bad("A game needs one picture and a game type.");
      meta.game = body.meta.game;
    }

    const uid = newUid(8);
    const circle = body.visibility === "circle";
    const tags = new Set([...body.caption.matchAll(TAG_RE)].map((m) => m[1]!.toLowerCase()));
    db.tx(() => {
      const res = db.run(
        "INSERT INTO posts (uid, user_id, kind, caption, remix_of, allow_remix, visibility, meta, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        // Circle posts stay inside the circle: no remixes, no tag pages.
        uid, id, body.kind, body.caption, source?.id ?? null, body.allowRemix && !circle ? 1 : 0, body.visibility, JSON.stringify(meta), Date.now(),
      );
      const postId = Number(res.lastInsertRowid);
      rows.forEach((m, i) => db.run("INSERT INTO post_media (post_id, media_id, position) VALUES (?, ?, ?)", postId, m.id, i));
      if (!circle) for (const tag of [...tags].slice(0, 20)) db.run("INSERT OR IGNORE INTO tags (tag, post_id) VALUES (?, ?)", tag, postId);
      if (source) {
        db.run("UPDATE posts SET remix_count = remix_count + 1 WHERE id = ?", source.id);
        if (!circle) notify(source.user_id, id, "remix", postId);
      }
    });
    return { post: hydrate([postFor(uid, id)], id)[0] };
  });

  server.get<{ Params: { uid: string } }>("/api/posts/:uid", async (req) => {
    const v = viewer(req);
    return { post: hydrate([postFor(req.params.uid, v)], v)[0] };
  });

  server.delete<{ Params: { uid: string } }>("/api/posts/:uid", async (req) => {
    const id = requireUser(req);
    const post = postFor(req.params.uid, id);
    if (post.user_id !== id) throw new HttpError(403, "That's not your post.");
    await removePost(post);
    return { ok: true };
  });

  server.get<{ Params: { uid: string }; Querystring: { cursor?: string } }>("/api/posts/:uid/remixes", async (req) => {
    const v = viewer(req);
    const post = postFor(req.params.uid, v);
    const { items, next } = pageById(`p.remix_of = ? AND ${VISIBLE}`, [post.id, ...vis(v)], req.query.cursor, v, 24);
    return { items, next };
  });

  server.post<{ Params: { uid: string } }>("/api/posts/:uid/like", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 120);
    const post = postFor(req.params.uid, id);
    db.tx(() => {
      const r = db.run("INSERT OR IGNORE INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)", id, post.id, Date.now());
      if (r.changes) {
        db.run("UPDATE posts SET like_count = like_count + 1 WHERE id = ?", post.id);
        // One entry per person per post, even if they un-like and like again.
        if (!db.get("SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND kind = 'like' AND post_id = ?", post.user_id, id, post.id)) {
          notify(post.user_id, id, "like", post.id);
        }
      }
    });
    return { liked: true, likeCount: postRow(post.id).like_count };
  });

  server.delete<{ Params: { uid: string } }>("/api/posts/:uid/like", async (req) => {
    const id = requireUser(req);
    const post = postFor(req.params.uid, id);
    db.tx(() => {
      const r = db.run("DELETE FROM likes WHERE user_id = ? AND post_id = ?", id, post.id);
      if (r.changes) db.run("UPDATE posts SET like_count = max(like_count - 1, 0) WHERE id = ?", post.id);
    });
    return { liked: false, likeCount: postRow(post.id).like_count };
  });

  server.post<{ Params: { uid: string } }>("/api/posts/:uid/save", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 120);
    db.run("INSERT OR IGNORE INTO saves (user_id, post_id, created_at) VALUES (?, ?, ?)", id, postFor(req.params.uid, id).id, Date.now());
    return { saved: true };
  });

  server.delete<{ Params: { uid: string } }>("/api/posts/:uid/save", async (req) => {
    const id = requireUser(req);
    db.run("DELETE FROM saves WHERE user_id = ? AND post_id = ?", id, postFor(req.params.uid, id).id);
    return { saved: false };
  });

  /** Saved posts are private: only you can list them. */
  server.get<{ Querystring: { cursor?: string } }>("/api/saved", async (req) => {
    const id = requireUser(req);
    const before = Number(req.query.cursor) || Number.MAX_SAFE_INTEGER;
    const rows = db.all<PostRow & { save_rowid: number }>(
      `SELECT p.*, s.rowid AS save_rowid FROM saves s JOIN posts p ON p.id = s.post_id
       WHERE s.user_id = ? AND s.rowid < ? AND ${VISIBLE} ORDER BY s.rowid DESC LIMIT 25`, id, before, ...vis(id),
    );
    const items = rows.slice(0, 24);
    return { items: hydrate(items, id), next: rows.length > 24 ? String(items[23]!.save_rowid) : null };
  });

  interface CommentRow { id: number; body: string; created_at: number; user_id: number }
  const commentDTO = (c: CommentRow, users: Map<number, UserRow>): CommentDTO => ({
    id: c.id, body: c.body, createdAt: c.created_at, author: userDTO(users.get(c.user_id)!),
  });

  server.get<{ Params: { uid: string }; Querystring: { cursor?: string } }>("/api/posts/:uid/comments", async (req) => {
    const v = viewer(req);
    const post = postFor(req.params.uid, v);
    const before = Number(req.query.cursor) || Number.MAX_SAFE_INTEGER;
    const rows = db.all<CommentRow>(
      `SELECT * FROM comments WHERE post_id = ? AND id < ?
         AND user_id NOT IN (SELECT blocked_id FROM blocks WHERE blocker_id = ?) ORDER BY id DESC LIMIT 31`,
      post.id, before, v ?? 0,
    );
    const items = rows.slice(0, 30);
    const users = usersById([...new Set(items.map((c) => c.user_id))]);
    return { items: items.map((c) => commentDTO(c, users)), next: rows.length > 30 ? String(items[29]!.id) : null };
  });

  server.post<{ Params: { uid: string } }>("/api/posts/:uid/comments", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 30);
    const post = postFor(req.params.uid, id);
    const { body } = parse(NewComment, req.body);
    const cid = db.tx(() => {
      const r = db.run("INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)", post.id, id, body, Date.now());
      db.run("UPDATE posts SET comment_count = comment_count + 1 WHERE id = ?", post.id);
      notify(post.user_id, id, "comment", post.id);
      return Number(r.lastInsertRowid);
    });
    const row = db.get<CommentRow>("SELECT * FROM comments WHERE id = ?", cid)!;
    return { comment: commentDTO(row, usersById([id])), commentCount: postRow(post.id).comment_count };
  });

  server.delete<{ Params: { id: string } }>("/api/comments/:id", async (req) => {
    const id = requireUser(req);
    const c = db.get<{ id: number; user_id: number; post_id: number }>("SELECT id, user_id, post_id FROM comments WHERE id = ?", Number(req.params.id));
    if (!c) throw notFound();
    const owner = db.get<{ user_id: number }>("SELECT user_id FROM posts WHERE id = ?", c.post_id);
    if (c.user_id !== id && owner?.user_id !== id) throw new HttpError(403, "You can't delete that comment.");
    db.tx(() => {
      db.run("DELETE FROM comments WHERE id = ?", c.id);
      db.run("UPDATE posts SET comment_count = max(comment_count - 1, 0) WHERE id = ?", c.post_id);
    });
    return { ok: true };
  });

  server.post<{ Params: { uid: string } }>("/api/posts/:uid/report", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 20);
    const post = postFor(req.params.uid, id);
    const { reason } = parse(Report, req.body);
    db.run("INSERT OR IGNORE INTO reports (post_id, user_id, reason, created_at) VALUES (?, ?, ?, ?)", post.id, id, reason, Date.now());
    return { ok: true };
  });

  const topScores = (postId: number): ScoreDTO[] => {
    const rows = db.all<{ user_id: number; ms: number; moves: number }>(
      "SELECT user_id, ms, moves FROM scores WHERE post_id = ? ORDER BY ms ASC, moves ASC LIMIT 10", postId,
    );
    const users = usersById(rows.map((r) => r.user_id));
    return rows.map((r) => ({ user: userDTO(users.get(r.user_id)!), ms: r.ms, moves: r.moves }));
  };

  server.get<{ Params: { uid: string } }>("/api/posts/:uid/scores", async (req) => {
    return { scores: topScores(postFor(req.params.uid, viewer(req)).id) };
  });

  server.post<{ Params: { uid: string } }>("/api/posts/:uid/scores", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 60);
    const post = postFor(req.params.uid, id);
    if (post.kind !== "game") throw bad("That post isn't a game.");
    const s = parse(NewScore, req.body);
    db.run(
      `INSERT INTO scores (post_id, user_id, ms, moves, created_at) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (post_id, user_id) DO UPDATE SET ms = excluded.ms, moves = excluded.moves, created_at = excluded.created_at
       WHERE excluded.ms < scores.ms`,
      post.id, id, s.ms, s.moves, Date.now(),
    );
    return { scores: topScores(post.id) };
  });

  // ---- streams -------------------------------------------------------------
  //
  // There is no engagement model here. Home is the people you follow, newest
  // first, and it ends. Discover applies exactly one rule that the viewer
  // picked, and never looks at what they watched, liked or lingered on.

  const withWhy = (items: PostDTO[], why: (p: PostDTO) => string) => items.map((p) => ({ ...p, why: why(p) }));

  /** Home: your follows + your own posts, strictly newest first, with a "new since last visit" marker. */
  server.get<{ Querystring: { cursor?: string } }>("/api/feed/home", async (req) => {
    const id = requireUser(req);
    const me = db.get<{ username: string; last_seen_post: number }>("SELECT username, last_seen_post FROM users WHERE id = ?", id)!;
    const [beforeRaw, seenRaw] = (req.query.cursor ?? "").split(":");
    const first = !req.query.cursor;
    const lastSeen = first ? me.last_seen_post : Number(seenRaw) || 0;
    const page = pageById(
      `(p.user_id = ? OR p.user_id IN (SELECT followee_id FROM follows WHERE follower_id = ?)) AND ${VISIBLE}`,
      [id, id, ...vis(id)], beforeRaw || undefined, id,
    );
    if (first) db.run("UPDATE users SET last_seen_post = (SELECT coalesce(max(id), 0) FROM posts) WHERE id = ?", id);
    const items = page.items.map((p, i) => ({
      ...p,
      fresh: page.rows[i]!.id > lastSeen && p.author.username !== me.username,
      why: p.author.username === me.username ? "Your own post" : p.visibility === "circle" ? `@${p.author.username} shared this with their close circle` : `You follow @${p.author.username}`,
    }));
    return { items, next: page.next ? `${page.next}:${lastSeen}` : null };
  });

  server.get<{ Querystring: { lens?: string; cursor?: string } }>("/api/feed/discover", async (req) => {
    const v = viewer(req);
    const lens: Lens = req.query.lens && req.query.lens in LENSES ? (req.query.lens as Lens) : "latest";
    const cursor = req.query.cursor;

    if (lens === "latest") {
      const { items, next } = pageById(PUBLIC, nb(v), cursor, v);
      return { lens, items: withWhy(items, () => "Newest public posts, in order"), next };
    }
    if (lens === "fresh") {
      const { items, next } = pageById(
        `${PUBLIC} AND (SELECT count(*) FROM follows f WHERE f.followee_id = p.user_id) < ${FRESH_VOICE_MAX}`, nb(v), cursor, v,
      );
      return { lens, items: withWhy(items, (p) => `@${p.author.username} has fewer than ${FRESH_VOICE_MAX} followers`), next };
    }
    if (lens === "remixes") {
      const { items, next } = pageById(`${PUBLIC} AND p.kind != 'photo'`, nb(v), cursor, v);
      return { lens, items: withWhy(items, () => "Made in the Studio, newest first"), next };
    }

    // The remaining lenses page by offset; the cursor pins what they sort by so pages don't reshuffle.
    const [offRaw, pinRaw] = (cursor ?? "").split(":");
    const offset = Math.max(Number(offRaw) || 0, 0);
    if (lens === "loved") {
      const now = Number(pinRaw) || Date.now();
      const rows = db.all<PostRow>(
        `SELECT p.* FROM posts p WHERE ${PUBLIC} AND p.created_at > ? AND p.created_at <= ? AND p.like_count > 0
         ORDER BY p.like_count DESC, p.id DESC LIMIT ? OFFSET ?`,
        ...nb(v), now - 7 * 864e5, now, PAGE + 1, offset,
      );
      const items = hydrate(rows.slice(0, PAGE), v);
      return { lens, items: withWhy(items, () => "Among the most liked posts of the last 7 days"), next: rows.length > PAGE ? `${offset + PAGE}:${now}` : null };
    }
    // shuffle: a fixed pseudo-random order per visit over recent public posts.
    const seed = Math.min(Math.max(Math.floor(Number(pinRaw)) || 1 + Math.floor(Math.random() * 999_983), 1), 999_983);
    const rows = db.all<PostRow>(
      `SELECT p.* FROM posts p WHERE ${PUBLIC} AND p.id > (SELECT coalesce(max(id), 0) FROM posts) - ${WINDOW}
       ORDER BY (p.id * ?) % 1000003, p.id LIMIT ? OFFSET ?`,
      ...nb(v), seed, PAGE + 1, offset,
    );
    const items = hydrate(rows.slice(0, PAGE), v);
    return { lens, items: withWhy(items, () => "Picked at random — nothing ranked this"), next: rows.length > PAGE ? `${offset + PAGE}:${seed}` : null };
  });

  server.get("/api/explore", async (req) => {
    const v = viewer(req);
    const since = Date.now() - 14 * 864e5;
    const tags = db.all<{ tag: string; n: number }>(
      `SELECT t.tag, count(*) AS n FROM tags t JOIN posts p ON p.id = t.post_id
       WHERE p.created_at > ? AND ${PUBLIC} GROUP BY t.tag ORDER BY n DESC, t.tag LIMIT 14`, since, ...nb(v),
    );
    const top = db.all<PostRow>(
      `SELECT p.* FROM posts p WHERE ${PUBLIC} AND p.id > (SELECT coalesce(max(id), 0) FROM posts) - ${WINDOW}
       ORDER BY p.like_count DESC, p.id DESC LIMIT 36`, ...nb(v),
    );
    return { tags, posts: hydrate(top, v) };
  });

  server.get<{ Querystring: { q?: string } }>("/api/search", async (req) => {
    const v = viewer(req);
    const q = (req.query.q ?? "").trim().replace(/^[#@]/, "").slice(0, 60);
    if (!q) return { users: [], tags: [], posts: [] };
    const pat = `%${like(q)}%`;
    const users = db.all<UserRow>(
      `${USER_SELECT} WHERE (u.username LIKE ? ESCAPE '\\' OR u.display_name LIKE ? ESCAPE '\\')
         AND u.id NOT IN (SELECT blocker_id FROM blocks WHERE blocked_id = ?) ORDER BY u.username LIMIT 8`, pat, pat, v ?? 0,
    ).map(userDTO);
    const tags = db.all<{ tag: string; n: number }>(
      "SELECT tag, count(*) AS n FROM tags WHERE tag LIKE ? ESCAPE '\\' GROUP BY tag ORDER BY n DESC LIMIT 8", `${like(q.toLowerCase())}%`,
    );
    const posts = db.all<PostRow>(`SELECT p.* FROM posts p WHERE p.caption LIKE ? ESCAPE '\\' AND ${PUBLIC} ORDER BY p.id DESC LIMIT 24`, pat, ...nb(v));
    return { users, tags, posts: hydrate(posts, v) };
  });

  server.get<{ Params: { tag: string }; Querystring: { cursor?: string } }>("/api/tags/:tag/posts", async (req) => {
    const v = viewer(req);
    const { items, next } = pageById(`p.id IN (SELECT post_id FROM tags WHERE tag = ?) AND ${PUBLIC}`, [req.params.tag.toLowerCase(), ...nb(v)], req.query.cursor, v, 24);
    return { items, next };
  });

  // ---- people --------------------------------------------------------------

  server.get<{ Params: { username: string } }>("/api/users/:username", async (req) => {
    const v = viewer(req);
    const u = userFor(req.params.username, v);
    const extra = db.get<{ bio: string; posts: number; followers: number; following: number; likes: number }>(
      `SELECT u.bio,
        (SELECT count(*) FROM posts p WHERE p.user_id = u.id AND ${VISIBLE}) AS posts,
        (SELECT count(*) FROM follows WHERE followee_id = u.id) AS followers,
        (SELECT count(*) FROM follows WHERE follower_id = u.id) AS following,
        (SELECT coalesce(sum(like_count), 0) FROM posts WHERE user_id = u.id AND visibility = 'public') AS likes
       FROM users u WHERE u.id = ?`, ...vis(v), u.id,
    )!;
    const has = (sql: string) => v != null && db.get(sql, v, u.id) != null;
    const profile: ProfileDTO = {
      ...userDTO(u),
      ...extra,
      isMe: v === u.id,
      isFollowing: has("SELECT 1 FROM follows WHERE follower_id = ? AND followee_id = ?"),
      inMyCircle: has("SELECT 1 FROM circle WHERE owner_id = ? AND member_id = ?"),
      blocked: has("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?"),
    };
    return { profile };
  });

  server.get<{ Params: { username: string }; Querystring: { cursor?: string } }>("/api/users/:username/posts", async (req) => {
    const v = viewer(req);
    const { items, next } = pageById(`p.user_id = ? AND ${VISIBLE}`, [userFor(req.params.username, v).id, ...vis(v)], req.query.cursor, v, 24);
    return { items, next };
  });

  server.post<{ Params: { username: string } }>("/api/users/:username/follow", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 60);
    const u = userFor(req.params.username, id);
    if (u.id === id) throw bad("You can't follow yourself.");
    if (db.get("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?", id, u.id)) throw bad("Unblock this person first.");
    const r = db.run("INSERT OR IGNORE INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)", id, u.id, Date.now());
    if (r.changes && !db.get("SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND kind = 'follow'", u.id, id)) notify(u.id, id, "follow", null);
    return { following: true };
  });

  server.delete<{ Params: { username: string } }>("/api/users/:username/follow", async (req) => {
    const id = requireUser(req);
    db.run("DELETE FROM follows WHERE follower_id = ? AND followee_id = ?", id, userFor(req.params.username, id).id);
    return { following: false };
  });

  /** Blocking is mutual invisibility: neither side sees the other's posts, comments or profile activity. */
  server.post<{ Params: { username: string } }>("/api/users/:username/block", async (req) => {
    const id = requireUser(req);
    const u = userFor(req.params.username, id);
    if (u.id === id) throw bad("You can't block yourself.");
    db.tx(() => {
      db.run("INSERT OR IGNORE INTO blocks (blocker_id, blocked_id, created_at) VALUES (?, ?, ?)", id, u.id, Date.now());
      db.run("DELETE FROM follows WHERE (follower_id = ? AND followee_id = ?) OR (follower_id = ? AND followee_id = ?)", id, u.id, u.id, id);
      db.run("DELETE FROM circle WHERE (owner_id = ? AND member_id = ?) OR (owner_id = ? AND member_id = ?)", id, u.id, u.id, id);
      db.run("DELETE FROM notifications WHERE (user_id = ? AND actor_id = ?) OR (user_id = ? AND actor_id = ?)", id, u.id, u.id, id);
    });
    return { blocked: true };
  });

  server.delete<{ Params: { username: string } }>("/api/users/:username/block", async (req) => {
    const id = requireUser(req);
    const u = db.get<{ id: number }>("SELECT id FROM users WHERE username = ?", req.params.username);
    if (u) db.run("DELETE FROM blocks WHERE blocker_id = ? AND blocked_id = ?", id, u.id);
    return { blocked: false };
  });

  server.get("/api/blocks", async (req) => {
    const id = requireUser(req);
    return { users: db.all<UserRow>(`${USER_SELECT} JOIN blocks b ON b.blocked_id = u.id WHERE b.blocker_id = ? ORDER BY b.created_at DESC`, id).map(userDTO) };
  });

  // Close circle: a private audience you choose. Members see your circle posts; nobody else does.
  server.get("/api/circle", async (req) => {
    const id = requireUser(req);
    return { members: db.all<UserRow>(`${USER_SELECT} JOIN circle c ON c.member_id = u.id WHERE c.owner_id = ? ORDER BY u.username`, id).map(userDTO) };
  });

  server.put<{ Params: { username: string } }>("/api/circle/:username", async (req) => {
    const id = requireUser(req);
    limit(req, "write", 60);
    const u = userFor(req.params.username, id);
    if (u.id === id) throw bad("You're already in your own circle.");
    if (db.get("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_id = ?", id, u.id)) throw bad("Unblock this person first.");
    if (db.get<{ n: number }>("SELECT count(*) AS n FROM circle WHERE owner_id = ?", id)!.n >= 150) throw bad("A close circle holds up to 150 people.");
    const r = db.run("INSERT OR IGNORE INTO circle (owner_id, member_id, created_at) VALUES (?, ?, ?)", id, u.id, Date.now());
    if (r.changes && !db.get("SELECT 1 FROM notifications WHERE user_id = ? AND actor_id = ? AND kind = 'circle'", u.id, id)) notify(u.id, id, "circle", null);
    return { inMyCircle: true };
  });

  server.delete<{ Params: { username: string } }>("/api/circle/:username", async (req) => {
    const id = requireUser(req);
    const u = db.get<{ id: number }>("SELECT id FROM users WHERE username = ?", req.params.username);
    if (u) db.run("DELETE FROM circle WHERE owner_id = ? AND member_id = ?", id, u.id);
    return { inMyCircle: false };
  });

  // ---- activity ------------------------------------------------------------

  /** Your inbox. Reading it marks it read; there are no push nudges to pull you back. */
  server.get("/api/notifications", async (req) => {
    const id = requireUser(req);
    const rows = db.all<{ id: number; actor_id: number; kind: NotificationDTO["kind"]; post_id: number | null; read: number; created_at: number }>(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 60", id,
    );
    const actors = usersById([...new Set(rows.map((r) => r.actor_id))]);
    const postIds = [...new Set(rows.map((r) => r.post_id).filter((p): p is number => p != null))];
    const posts = new Map<number, { id: string; thumb: string | null }>();
    if (postIds.length) {
      for (const p of db.all<{ id: number; uid: string; media_uid: string | null }>(
        `SELECT p.id, p.uid, (SELECT m.uid FROM post_media pm JOIN media m ON m.id = pm.media_id WHERE pm.post_id = p.id ORDER BY pm.position LIMIT 1) AS media_uid
         FROM posts p WHERE p.id IN (${qs(postIds.length)})`, ...postIds,
      )) posts.set(p.id, { id: p.uid, thumb: p.media_uid ? `/media/${p.media_uid}/t.webp` : null });
    }
    db.run("UPDATE notifications SET read = 1 WHERE user_id = ? AND read = 0", id);
    const items: NotificationDTO[] = rows.filter((r) => actors.has(r.actor_id)).map((r) => ({
      id: r.id, kind: r.kind, actor: userDTO(actors.get(r.actor_id)!), post: r.post_id != null ? (posts.get(r.post_id) ?? null) : null,
      createdAt: r.created_at, read: r.read === 1,
    }));
    return { items };
  });

  // ---- moderation ----------------------------------------------------------

  const requireAdmin = (req: FastifyRequest) => {
    const id = requireUser(req);
    if (!isAdmin(id)) throw notFound();
    return id;
  };

  server.get("/api/admin/reports", async (req) => {
    requireAdmin(req);
    const rows = db.all<{ post_id: number; reason: string; created_at: number; username: string }>(
      "SELECT r.post_id, r.reason, r.created_at, u.username FROM reports r JOIN users u ON u.id = r.user_id ORDER BY r.id DESC LIMIT 500",
    );
    const byPost = new Map<number, ReportDTO["reasons"]>();
    for (const r of rows) byPost.set(r.post_id, [...(byPost.get(r.post_id) ?? []), { by: r.username, reason: r.reason, createdAt: r.created_at }]);
    const ids = [...byPost.keys()];
    const posts = ids.length ? db.all<PostRow>(`SELECT * FROM posts WHERE id IN (${qs(ids.length)})`, ...ids) : [];
    const dto = new Map(hydrate(posts, null).map((p, i) => [posts[i]!.id, p]));
    const reports: ReportDTO[] = ids.filter((pid) => dto.has(pid)).map((pid) => ({ post: dto.get(pid)!, reasons: byPost.get(pid)! }));
    return { reports };
  });

  server.post<{ Params: { uid: string } }>("/api/admin/reports/:uid", async (req) => {
    requireAdmin(req);
    const { action } = parse(z.object({ action: z.enum(["dismiss", "remove"]) }), req.body);
    const post = db.get<PostRow>("SELECT * FROM posts WHERE uid = ?", req.params.uid);
    if (!post) throw notFound();
    if (action === "remove") await removePost(post);
    else db.run("DELETE FROM reports WHERE post_id = ?", post.id);
    return { ok: true };
  });

  // ---- AI studio -----------------------------------------------------------

  /** Studio tools may read your own uploads, or pictures from a public post that allows remixing. */
  async function aiImage(uid: string, userId: number): Promise<AiImage> {
    const m = media.byUid(uid);
    if (!m) throw notFound("That picture is missing.");
    if (m.user_id !== userId) {
      const open = db.get(
        `SELECT 1 FROM post_media pm JOIN posts p ON p.id = pm.post_id WHERE pm.media_id = ? AND p.allow_remix = 1 AND ${PUBLIC} LIMIT 1`, m.id, ...nb(userId),
      );
      if (!open) throw new HttpError(403, "That picture isn't open for remixing.");
    }
    return { data: ai.provider === "claude" ? await media.readMedium(uid) : Buffer.alloc(0), color: m.color, width: m.width, height: m.height };
  }

  server.post("/api/ai/caption", async (req) => {
    const id = requireUser(req);
    limit(req, "ai", 20);
    const body = parse(AiCaption, req.body);
    const result = await ai.caption(await aiImage(body.mediaId, id), body.hint);
    const m = media.byUid(body.mediaId)!;
    if (m.user_id === id && !m.alt) db.run("UPDATE media SET alt = ? WHERE id = ?", result.alt, m.id);
    return result;
  });

  server.post("/api/ai/ad", async (req) => {
    const id = requireUser(req);
    limit(req, "ai", 20);
    const body = parse(AiAd, req.body);
    return ai.ad(await aiImage(body.mediaId, id), body);
  });

  server.post("/api/ai/storyboard", async (req) => {
    const id = requireUser(req);
    limit(req, "ai", 20);
    const body = parse(AiStoryboard, req.body);
    const images = await Promise.all(body.mediaIds.map((uid) => aiImage(uid, id)));
    return ai.storyboard(images, body.vibe);
  });

  server.get("/api/health", async () => ({ ok: true, ai: ai.provider }));

  // ---- static + share pages ------------------------------------------------

  await server.register(fastifyStatic, {
    root: media.root,
    prefix: "/media/",
    immutable: true,
    maxAge: "365d",
    index: false,
  });

  const dist = path.resolve(import.meta.dirname, "../dist");
  const indexFile = path.join(dist, "index.html");
  const hasDist = fs.existsSync(indexFile);
  const indexHtml = hasDist ? fs.readFileSync(indexFile, "utf8") : "";
  const CSP = "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'";

  const page = (reply: FastifyReply, og?: { title: string; description: string; image?: string; url: string; type?: string }) => {
    let html = indexHtml;
    if (og) {
      const abs = (p: string) => (cfg.publicUrl ? cfg.publicUrl + p : p);
      const tags = [
        `<title>${esc(og.title)}</title>`,
        `<meta name="description" content="${esc(og.description)}">`,
        `<meta property="og:title" content="${esc(og.title)}">`,
        `<meta property="og:description" content="${esc(og.description)}">`,
        `<meta property="og:type" content="${og.type ?? "article"}">`,
        `<meta property="og:url" content="${esc(abs(og.url))}">`,
        `<meta property="og:site_name" content="pics.me">`,
        og.image ? `<meta property="og:image" content="${esc(abs(og.image))}"><meta name="twitter:card" content="summary_large_image">` : "",
      ].join("");
      html = html.replace(/<title>.*?<\/title>/, tags);
    }
    return reply.header("Content-Security-Policy", CSP).header("Cache-Control", "no-cache").type("text/html").send(html);
  };

  if (hasDist) {
    await server.register(fastifyStatic, { root: dist, prefix: "/", decorateReply: false, index: false, wildcard: false, maxAge: "1h" });

    server.get<{ Params: { uid: string } }>("/p/:uid", async (req, reply) => {
      // Link previews are only generated for public posts.
      const row = db.get<PostRow>("SELECT * FROM posts WHERE uid = ? AND visibility = 'public'", req.params.uid);
      if (!row) return page(reply);
      const post = hydrate([row], null)[0]!;
      return page(reply, {
        title: `${post.author.displayName} on pics.me`,
        description: post.caption.slice(0, 200) || `A ${post.kind} by @${post.author.username}`,
        image: post.media[0]?.urls.m,
        url: `/p/${post.id}`,
      });
    });

    server.get<{ Params: { username: string } }>("/u/:username", async (req, reply) => {
      const u = db.get<UserRow & { bio: string }>(
        `SELECT u.id, u.username, u.display_name, u.bio, m.uid AS avatar_uid FROM users u LEFT JOIN media m ON m.id = u.avatar_media_id WHERE u.username = ?`,
        req.params.username,
      );
      if (!u) return page(reply.status(404));
      return page(reply, {
        title: `${u.display_name} (@${u.username}) · pics.me`,
        description: u.bio || `See @${u.username}'s pictures on pics.me`,
        image: u.avatar_uid ? `/media/${u.avatar_uid}/m.webp` : undefined,
        url: `/u/${u.username}`,
        type: "profile",
      });
    });
  }

  server.setNotFoundHandler((req, reply) => {
    const url = req.raw.url ?? "";
    if (hasDist && req.method === "GET" && !url.startsWith("/api/") && !url.startsWith("/media/") && !/\.\w{2,5}$/.test(url.split("?")[0]!)) {
      return page(reply);
    }
    return reply.status(404).send({ error: "Not found" });
  });

  return { server, db, media, ai };
}
