import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { FFMPEG } from "../server/media.ts";
import { buildApp, type App } from "../server/app.ts";
import { loadConfig } from "../server/config.ts";

let app: App;
let dir: string;

before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "picsme-test-"));
  app = await buildApp(loadConfig({ dataDir: dir, aiEnabled: false, rateScale: 1000, production: false }));
});

after(async () => {
  await app.server.close();
  fs.rmSync(dir, { recursive: true, force: true });
});

type Json = Record<string, any>;

async function call(method: string, url: string, opts: { token?: string; body?: unknown; headers?: Record<string, string>; payload?: Buffer } = {}) {
  const headers: Record<string, string> = { ...opts.headers };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  const res = await app.server.inject({
    method: method as "GET",
    url,
    headers,
    ...(opts.payload ? { payload: opts.payload } : opts.body !== undefined ? { payload: opts.body as object } : {}),
  });
  let json: Json = {};
  try {
    json = res.json();
  } catch { /* non-JSON */ }
  return { status: res.statusCode, json, res };
}

function multipart(parts: { name: string; filename?: string; type?: string; data: Buffer | string }[]) {
  const boundary = "----picsme" + Math.random().toString(16).slice(2);
  const chunks: Buffer[] = [];
  for (const p of parts) {
    chunks.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${p.name}"${p.filename ? `; filename="${p.filename}"` : ""}\r\n` +
      (p.type ? `Content-Type: ${p.type}\r\n` : "") + "\r\n",
    ));
    chunks.push(Buffer.isBuffer(p.data) ? p.data : Buffer.from(p.data));
    chunks.push(Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${boundary}--\r\n`));
  return { payload: Buffer.concat(chunks), headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}

const picture = (w = 1600, h = 1200, color = "#3366cc") =>
  sharp({ create: { width: w, height: h, channels: 3, background: color } }).jpeg().toBuffer();

async function signup(username: string) {
  const r = await call("POST", "/api/auth/signup", { body: { username, email: `${username}@example.com`, password: "correct horse" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.token as string;
}

async function upload(token: string, buf?: Buffer) {
  const r = await call("POST", "/api/media", { token, ...multipart([{ name: "file", filename: "a.jpg", type: "image/jpeg", data: buf ?? (await picture()) }]) });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.media as Json;
}

async function post(token: string, body: Json) {
  const r = await call("POST", "/api/posts", { token, body });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  return r.json.post as Json;
}

test("signup, login, session and validation", async () => {
  const token = await signup("ada");
  const me = await call("GET", "/api/me", { token });
  assert.equal(me.json.user.username, "ada");
  assert.equal(me.json.ai, "local");

  assert.equal((await call("POST", "/api/auth/signup", { body: { username: "ADA", email: "x@example.com", password: "correct horse" } })).status, 409);
  assert.equal((await call("POST", "/api/auth/signup", { body: { username: "a", email: "y@example.com", password: "correct horse" } })).status, 400);
  assert.equal((await call("POST", "/api/auth/signup", { body: { username: "shorty", email: "z@example.com", password: "short" } })).status, 400);
  assert.equal((await call("POST", "/api/auth/login", { body: { login: "ada", password: "nope nope nope" } })).status, 401);

  const login = await call("POST", "/api/auth/login", { body: { login: "ada@example.com", password: "correct horse" } });
  assert.equal(login.status, 200);
  assert.match(String(login.res.headers["set-cookie"]), /pm_session=.+HttpOnly; SameSite=Lax/);

  await call("POST", "/api/auth/logout", { token: login.json.token });
  assert.equal((await call("GET", "/api/me", { token: login.json.token })).json.user, null);
  assert.equal((await call("POST", "/api/posts", { body: {} })).status, 401);
});

test("cross-origin writes are refused", async () => {
  const r = await call("POST", "/api/auth/logout", { headers: { origin: "https://evil.example", host: "pics.me" } });
  assert.equal(r.status, 403);
});

test("image upload produces stripped WebP variants and a placeholder", async () => {
  const token = await signup("lens");
  const withExif = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#cc4422" } })
    .withExif({ IFD0: { Copyright: "secret-location-data" } }).jpeg().toBuffer();
  const m = await upload(token, withExif);
  assert.equal(m.w, 3000);
  assert.equal(m.h, 2000);
  assert.match(m.color, /^#[0-9a-f]{6}$/);
  assert.match(m.ph, /^data:image\/webp;base64,/);
  assert.match(m.urls.l, /\/l\.webp$/);

  const medium = await call("GET", m.urls.m);
  assert.equal(medium.status, 200);
  assert.match(String(medium.res.headers["cache-control"]), /immutable/);
  const meta = await sharp(medium.res.rawPayload).metadata();
  assert.equal(meta.format, "webp");
  assert.equal(meta.width, 1080);
  assert.equal(meta.exif, undefined);
  assert.ok(!medium.res.rawPayload.includes("secret-location-data"));

  const junk = await call("POST", "/api/media", { token, ...multipart([{ name: "file", filename: "a.jpg", type: "image/jpeg", data: Buffer.from("not an image at all") }]) });
  assert.equal(junk.status, 400);
});

test("posts, feed, likes, comments, tags, follow, search", async () => {
  const alice = await signup("alice");
  const bob = await signup("bob");
  const m1 = await upload(alice);
  const m2 = await upload(alice, await picture(900, 1400, "#22aa66"));
  const p = await post(alice, { kind: "photo", caption: "Morning light #Sunrise #coffee", mediaIds: [m1.id, m2.id] });
  assert.equal(p.media.length, 2);
  assert.equal(p.author.username, "alice");

  // bob can't post alice's uploads
  assert.equal((await call("POST", "/api/posts", { token: bob, body: { kind: "photo", mediaIds: [m1.id] } })).status, 403);

  const feed = await call("GET", "/api/feed", { token: bob });
  assert.ok(feed.json.items.some((x: Json) => x.id === p.id));

  const liked = await call("POST", `/api/posts/${p.id}/like`, { token: bob });
  assert.deepEqual(liked.json, { liked: true, likeCount: 1 });
  assert.equal((await call("POST", `/api/posts/${p.id}/like`, { token: bob })).json.likeCount, 1, "like is idempotent");
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: bob })).json.post.liked, true);
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: alice })).json.post.liked, false);
  assert.equal((await call("DELETE", `/api/posts/${p.id}/like`, { token: bob })).json.likeCount, 0);

  const c = await call("POST", `/api/posts/${p.id}/comments`, { token: bob, body: { body: "  love this  " } });
  assert.equal(c.json.comment.body, "love this");
  assert.equal(c.json.commentCount, 1);
  assert.equal((await call("POST", `/api/posts/${p.id}/comments`, { token: bob, body: { body: "   " } })).status, 400);
  assert.equal((await call("GET", `/api/posts/${p.id}/comments`)).json.items.length, 1);
  // the post owner may remove a comment on their post
  assert.equal((await call("DELETE", `/api/comments/${c.json.comment.id}`, { token: alice })).status, 200);
  assert.equal((await call("GET", `/api/posts/${p.id}`)).json.post.commentCount, 0);

  assert.equal((await call("GET", "/api/tags/sunrise/posts")).json.items.length, 1);
  assert.ok((await call("GET", "/api/explore")).json.tags.some((t: Json) => t.tag === "coffee"));
  const found = await call("GET", "/api/search?q=ali");
  assert.equal(found.json.users[0].username, "alice");
  assert.equal((await call("GET", "/api/search?q=%25")).json.users.length, 0, "LIKE wildcards are escaped");

  assert.equal((await call("GET", "/api/feed?tab=following", { token: bob })).json.items.length, 0);
  assert.equal((await call("POST", "/api/users/alice/follow", { token: bob })).json.following, true);
  assert.equal((await call("POST", "/api/users/bob/follow", { token: bob })).status, 400);
  assert.equal((await call("GET", "/api/feed?tab=following", { token: bob })).json.items.length, 1);
  const profile = (await call("GET", "/api/users/alice", { token: bob })).json.profile;
  assert.equal(profile.followers, 1);
  assert.equal(profile.isFollowing, true);
  assert.equal(profile.posts, 1);

  assert.equal((await call("DELETE", `/api/posts/${p.id}`, { token: bob })).status, 403);
  assert.equal((await call("DELETE", `/api/posts/${p.id}`, { token: alice })).status, 200);
  assert.equal((await call("GET", m1.urls.m)).status, 404, "media files are removed with the post");
});

test("feed paginates without repeats", async () => {
  const token = await signup("pager");
  const m = await upload(token);
  for (let i = 0; i < 15; i++) await post(token, { kind: "photo", caption: `n${i}`, mediaIds: [m.id] });
  const seen = new Set<string>();
  let cursor: string | null = "";
  let pages = 0;
  while (cursor !== null && pages < 10) {
    const r = await call("GET", `/api/feed?cursor=${encodeURIComponent(cursor)}`);
    for (const it of r.json.items) {
      assert.ok(!seen.has(it.id), "no duplicates across pages");
      seen.add(it.id);
    }
    cursor = r.json.next;
    pages++;
  }
  assert.ok(seen.size >= 15);
  const mine = await call("GET", "/api/users/pager/posts");
  assert.equal(mine.json.items.length, 15);
});

test("remixes: games, permissions, scores", async () => {
  const maker = await signup("maker");
  const player = await signup("player");
  const m = await upload(maker);
  const open = await post(maker, { kind: "photo", mediaIds: [m.id] });
  const locked = await post(maker, { kind: "photo", mediaIds: [(await upload(maker)).id], allowRemix: false });

  const game = await post(player, { kind: "game", mediaIds: [m.id], remixOf: open.id, meta: { game: { type: "slide", size: 3 } } });
  assert.deepEqual(game.meta.game, { type: "slide", size: 3 });
  assert.deepEqual(game.remixOf, { id: open.id, author: "maker" });
  assert.equal((await call("GET", `/api/posts/${open.id}`)).json.post.remixCount, 1);
  assert.equal((await call("GET", `/api/posts/${open.id}/remixes`)).json.items[0].id, game.id);

  const denied = await call("POST", "/api/posts", { token: player, body: { kind: "game", mediaIds: [locked.media[0].id], remixOf: locked.id, meta: { game: { type: "swap", size: 3 } } } });
  assert.equal(denied.status, 403);
  // a game must come with a game config; someone else's picture can't be re-posted as a plain photo
  assert.equal((await call("POST", "/api/posts", { token: player, body: { kind: "game", mediaIds: [m.id], remixOf: open.id } })).status, 400);
  assert.equal((await call("POST", "/api/posts", { token: player, body: { kind: "photo", mediaIds: [m.id], remixOf: open.id } })).status, 403);

  await call("POST", `/api/posts/${game.id}/scores`, { token: player, body: { ms: 9000, moves: 40 } });
  await call("POST", `/api/posts/${game.id}/scores`, { token: player, body: { ms: 12000, moves: 30 } });
  const board = await call("POST", `/api/posts/${game.id}/scores`, { token: maker, body: { ms: 7000, moves: 55 } });
  assert.deepEqual(board.json.scores.map((s: Json) => [s.user.username, s.ms]), [["maker", 7000], ["player", 9000]]);
  assert.equal((await call("POST", `/api/posts/${open.id}/scores`, { token: maker, body: { ms: 7000, moves: 5 } })).status, 400);

  // deleting the original keeps the source picture alive for the game built on it
  await call("DELETE", `/api/posts/${open.id}`, { token: maker });
  assert.equal((await call("GET", m.urls.m)).status, 200);
  assert.equal((await call("GET", `/api/posts/${game.id}`)).json.post.remixOf, null);
});

test("AI studio falls back to templates without a key", async () => {
  const token = await signup("studio");
  const other = await signup("outsider");
  const m = await upload(token, await picture(1080, 1920, "#e8a13a"));

  const cap = await call("POST", "/api/ai/caption", { token, body: { mediaId: m.id } });
  assert.equal(cap.json.source, "local");
  assert.ok(cap.json.caption.length > 0 && cap.json.hashtags.length > 0 && cap.json.alt.length > 0);

  const ad = await call("POST", "/api/ai/ad", { token, body: { mediaId: m.id, brand: "Northwind", product: "trail shoes", tone: "bold" } });
  assert.ok(ad.json.headline && ad.json.cta);
  assert.match(ad.json.accent, /^#[0-9a-f]{6}$/);
  assert.equal(ad.json.layout, "bottom");

  const sb = await call("POST", "/api/ai/storyboard", { token, body: { mediaIds: [m.id], vibe: "slow sunday" } });
  assert.ok(sb.json.shots.length >= 3);
  assert.ok(sb.json.shots.every((s: Json) => s.mediaIndex === 0 && s.seconds > 0));

  // unposted uploads are private to their owner
  assert.equal((await call("POST", "/api/ai/caption", { token: other, body: { mediaId: m.id } })).status, 403);
  await post(token, { kind: "photo", mediaIds: [m.id] });
  assert.equal((await call("POST", "/api/ai/caption", { token: other, body: { mediaId: m.id } })).status, 200);
});

test("profile edit and account deletion clean up", async () => {
  const token = await signup("leaver");
  const fan = await signup("fan");
  const m = await upload(token);
  const p = await post(token, { kind: "photo", mediaIds: [m.id] });
  const fanPost = await post(fan, { kind: "photo", mediaIds: [(await upload(fan)).id] });
  await call("POST", `/api/posts/${fanPost.id}/like`, { token });
  await post(fan, { kind: "game", mediaIds: [m.id], remixOf: p.id, meta: { game: { type: "memory", size: 4 } } });

  const patched = await call("PATCH", "/api/me", { token, body: { displayName: "Lea V.", bio: "gone soon", avatarMediaId: m.id } });
  assert.equal(patched.json.user.displayName, "Lea V.");
  assert.match(patched.json.user.avatar, /t\.webp$/);

  assert.equal((await call("DELETE", "/api/me", { token, body: { password: "wrong password" } })).status, 401);
  assert.equal((await call("DELETE", "/api/me", { token, body: { password: "correct horse" } })).status, 200);
  assert.equal((await call("GET", "/api/users/leaver")).status, 404);
  assert.equal((await call("GET", m.urls.m)).status, 404);
  assert.equal((await call("GET", `/api/posts/${fanPost.id}`)).json.post.likeCount, 0);
  assert.equal((await call("GET", "/api/users/fan/posts")).json.items.length, 1, "games built on the deleted user's pictures are removed");
});

test("video upload is probed, gets a poster and an MP4 rendition", { skip: !FFMPEG && "ffmpeg not installed" }, async () => {
  const token = await signup("filmer");
  const file = path.join(dir, "clip.webm");
  execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc=size=320x568:rate=15:duration=1", "-c:v", "libvpx", "-b:v", "200k", file]);
  const poster = await picture(320, 568, "#884422");
  const up = await call("POST", "/api/media", {
    token,
    ...multipart([
      { name: "width", data: "9999" }, { name: "height", data: "9999" }, { name: "duration", data: "500" },
      { name: "file", filename: "clip.webm", type: "video/webm", data: fs.readFileSync(file) },
      { name: "poster", filename: "p.jpg", type: "image/jpeg", data: poster },
    ]),
  });
  assert.equal(up.status, 200, JSON.stringify(up.json));
  const m = up.json.media;
  assert.equal(m.kind, "video");
  assert.deepEqual([m.w, m.h], [320, 568], "dimensions come from the file, not the client");
  assert.ok(m.video.duration > 0.5 && m.video.duration < 2);
  const ranged = await call("GET", m.video.src, { headers: { range: "bytes=0-99" } });
  assert.equal(ranged.status, 206);

  const p = await post(token, { kind: "video", mediaIds: [m.id] });
  let mp4: string | undefined;
  for (let i = 0; i < 50 && !mp4; i++) {
    await new Promise((r) => setTimeout(r, 200));
    mp4 = (await call("GET", `/api/posts/${p.id}`)).json.post.media[0].video.mp4;
  }
  assert.ok(mp4, "background transcode produced an mp4");
  assert.equal((await call("GET", mp4!)).status, 200);

  const fake = await call("POST", "/api/media", { token, ...multipart([
    { name: "file", filename: "x.webm", type: "video/webm", data: Buffer.from("definitely not a video file") },
    { name: "poster", filename: "p.jpg", type: "image/jpeg", data: poster },
  ]) });
  assert.equal(fake.status, 400);
});
