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
  app = await buildApp(loadConfig({ dataDir: dir, aiEnabled: false, rateScale: 1000, production: false, admins: ["boss"], appOrigins: ["capacitor://localhost"] }));
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

  const feed = await call("GET", "/api/feed/discover", { token: bob });
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

  assert.equal((await call("GET", "/api/feed/home", { token: bob })).json.items.length, 0);
  assert.equal((await call("POST", "/api/users/alice/follow", { token: bob })).json.following, true);
  assert.equal((await call("POST", "/api/users/bob/follow", { token: bob })).status, 400);
  assert.equal((await call("GET", "/api/feed/home", { token: bob })).json.items.length, 1);
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
    const r = await call("GET", `/api/feed/discover?lens=latest&cursor=${encodeURIComponent(cursor)}`);
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

test("home is chronological, marks what's new since the last visit, and ends", async () => {
  const reader = await signup("reader");
  const a = await signup("poster_a");
  const b = await signup("poster_b");
  await call("POST", "/api/users/poster_a/follow", { token: reader });
  await call("POST", "/api/users/poster_b/follow", { token: reader });
  const m = await upload(a);
  const mb = await upload(b);
  const p1 = await post(a, { kind: "photo", caption: "one", mediaIds: [m.id] });
  const p2 = await post(b, { kind: "photo", caption: "two", mediaIds: [mb.id] });
  // Likes must not change the order.
  await call("POST", `/api/posts/${p1.id}/like`, { token: b });

  const first = await call("GET", "/api/feed/home", { token: reader });
  assert.deepEqual(first.json.items.map((x: Json) => [x.id, x.fresh]), [[p2.id, true], [p1.id, true]]);
  assert.equal(first.json.items[0].why, "You follow @poster_b");
  assert.equal(first.json.next, null, "the stream has an end");

  const p3 = await post(a, { kind: "photo", caption: "three", mediaIds: [m.id] });
  const second = await call("GET", "/api/feed/home", { token: reader });
  assert.deepEqual(second.json.items.map((x: Json) => [x.id, x.fresh]), [[p3.id, true], [p2.id, false], [p1.id, false]]);
  assert.equal((await call("GET", "/api/feed/home")).status, 401);
});

test("discover lenses each follow their one stated rule", async () => {
  const viewer = await signup("lensviewer");
  const star = await signup("lens_star");
  const m = await upload(star);
  const plain = await post(star, { kind: "photo", caption: "lensplain", mediaIds: [m.id] });
  const loved = await post(star, { kind: "photo", caption: "lensloved", mediaIds: [m.id] });
  const game = await post(star, { kind: "game", caption: "lensgame", mediaIds: [m.id], meta: { game: { type: "spot", size: 5, seed: 42 } } });
  await call("POST", `/api/posts/${loved.id}/like`, { token: viewer });

  const ids = async (lens: string) => (await call("GET", `/api/feed/discover?lens=${lens}`, { token: viewer })).json.items.map((x: Json) => x.id);
  const latest = await ids("latest");
  assert.deepEqual(latest.slice(0, 3), [game.id, loved.id, plain.id]);

  const lovedIds = await ids("loved");
  assert.ok(lovedIds.includes(loved.id) && !lovedIds.includes(plain.id), "loved only lists posts with likes");
  assert.ok((await ids("remixes")).includes(game.id) && !(await ids("remixes")).includes(plain.id));
  assert.ok((await ids("fresh")).includes(plain.id), "an account with few followers is a fresh voice");

  const s1 = await call("GET", "/api/feed/discover?lens=shuffle", { token: viewer });
  assert.ok(s1.json.items.length > 0);
  assert.match(s1.json.items[0].why, /random/);
  if (s1.json.next) {
    const s2 = await call("GET", `/api/feed/discover?lens=shuffle&cursor=${s1.json.next}`, { token: viewer });
    const seen = new Set(s1.json.items.map((x: Json) => x.id));
    assert.ok(s2.json.items.every((x: Json) => !seen.has(x.id)), "shuffle pages don't repeat");
  }
  assert.equal(game.meta.game.seed, 42);
});

test("close circle posts are only visible inside the circle", async () => {
  const owner = await signup("circ_owner");
  const friend = await signup("circ_friend");
  const stranger = await signup("circ_stranger");
  assert.equal((await call("PUT", "/api/circle/circ_friend", { token: owner })).json.inMyCircle, true);
  assert.equal((await call("PUT", "/api/circle/circ_owner", { token: owner })).status, 400);
  assert.deepEqual((await call("GET", "/api/circle", { token: owner })).json.members.map((u: Json) => u.username), ["circ_friend"]);
  await call("POST", "/api/users/circ_owner/follow", { token: friend });

  const m = await upload(owner);
  const p = await post(owner, { kind: "photo", caption: "family only #secretcircletag", mediaIds: [m.id], visibility: "circle" });
  assert.equal(p.visibility, "circle");
  assert.equal(p.allowRemix, false, "circle posts can't be remixed");

  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: friend })).status, 200);
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: stranger })).status, 404);
  assert.equal((await call("GET", `/api/posts/${p.id}`)).status, 404);
  assert.equal((await call("POST", `/api/posts/${p.id}/like`, { token: stranger })).status, 404);
  assert.equal((await call("GET", `/api/posts/${p.id}/comments`, { token: stranger })).status, 404);

  const home = await call("GET", "/api/feed/home", { token: friend });
  assert.equal(home.json.items[0].id, p.id);
  assert.match(home.json.items[0].why, /close circle/);
  const everywhere = [
    (await call("GET", "/api/feed/discover", { token: friend })).json.items,
    (await call("GET", "/api/tags/secretcircletag/posts", { token: friend })).json.items,
    (await call("GET", "/api/search?q=family%20only", { token: friend })).json.posts,
    (await call("GET", "/api/users/circ_owner/posts", { token: stranger })).json.items,
  ];
  assert.ok(everywhere.every((list) => !list.some((x: Json) => x.id === p.id)), "never in public surfaces or to outsiders");
  assert.equal((await call("GET", "/api/users/circ_owner/posts", { token: friend })).json.items.length, 1);
  assert.equal((await call("GET", "/api/users/circ_owner", { token: stranger })).json.profile.posts, 0);
  assert.equal((await call("POST", "/api/ai/caption", { token: friend, body: { mediaId: m.id } })).status, 403);

  await call("DELETE", "/api/circle/circ_friend", { token: owner });
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: friend })).status, 404, "leaving the circle removes access");
});

test("blocking hides both people from each other", async () => {
  const ann = await signup("blk_ann");
  const troll = await signup("blk_troll");
  const p = await post(ann, { kind: "photo", caption: "blkpost", mediaIds: [(await upload(ann)).id] });
  await call("POST", "/api/users/blk_ann/follow", { token: troll });
  await call("POST", `/api/posts/${p.id}/comments`, { token: troll, body: { body: "rude" } });

  assert.equal((await call("POST", "/api/users/blk_troll/block", { token: ann })).json.blocked, true);
  assert.equal((await call("GET", "/api/users/blk_ann", { token: troll })).status, 404);
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: troll })).status, 404);
  assert.equal((await call("POST", "/api/users/blk_ann/follow", { token: troll })).status, 404);
  assert.ok(!(await call("GET", "/api/feed/discover", { token: troll })).json.items.some((x: Json) => x.id === p.id));
  assert.equal((await call("GET", `/api/posts/${p.id}/comments`, { token: ann })).json.items.length, 0, "their comments disappear for the blocker");
  assert.equal((await call("GET", "/api/users/blk_ann")).json.profile.followers, 0, "block removes the follow");
  assert.equal((await call("GET", "/api/users/blk_troll", { token: ann })).json.profile.blocked, true);
  assert.deepEqual((await call("GET", "/api/blocks", { token: ann })).json.users.map((u: Json) => u.username), ["blk_troll"]);

  await call("DELETE", "/api/users/blk_troll/block", { token: ann });
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: troll })).status, 200);
});

test("saves are private; activity inbox records likes, comments, follows and remixes once", async () => {
  const maker = await signup("act_maker");
  const fan = await signup("act_fan");
  const m = await upload(maker);
  const p = await post(maker, { kind: "photo", mediaIds: [m.id] });

  assert.equal((await call("POST", `/api/posts/${p.id}/save`, { token: fan })).json.saved, true);
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: fan })).json.post.saved, true);
  assert.equal((await call("GET", `/api/posts/${p.id}`, { token: maker })).json.post.saved, false);
  assert.deepEqual((await call("GET", "/api/saved", { token: fan })).json.items.map((x: Json) => x.id), [p.id]);
  assert.equal((await call("GET", "/api/saved")).status, 401);
  await call("DELETE", `/api/posts/${p.id}/save`, { token: fan });
  assert.equal((await call("GET", "/api/saved", { token: fan })).json.items.length, 0);

  await call("POST", `/api/posts/${p.id}/like`, { token: fan });
  await call("DELETE", `/api/posts/${p.id}/like`, { token: fan });
  await call("POST", `/api/posts/${p.id}/like`, { token: fan });
  await call("POST", `/api/posts/${p.id}/like`, { token: maker });
  await call("POST", `/api/posts/${p.id}/comments`, { token: fan, body: { body: "nice" } });
  await call("POST", "/api/users/act_maker/follow", { token: fan });
  await post(fan, { kind: "game", mediaIds: [m.id], remixOf: p.id, meta: { game: { type: "slide", size: 3 } } });

  assert.equal((await call("GET", "/api/me", { token: maker })).json.user.unread, 4);
  const inbox = await call("GET", "/api/notifications", { token: maker });
  assert.deepEqual(inbox.json.items.map((n: Json) => n.kind), ["remix", "follow", "comment", "like"]);
  assert.ok(inbox.json.items.every((n: Json) => n.actor.username === "act_fan" && n.read === false));
  assert.match(inbox.json.items[3].post.thumb, /t\.webp$/);
  assert.equal((await call("GET", "/api/me", { token: maker })).json.user.unread, 0, "opening the inbox marks it read");
});

test("pace settings are stored per person with calm defaults", async () => {
  const token = await signup("pacer");
  const me = (await call("GET", "/api/me", { token })).json.user;
  assert.deepEqual(me.settings, { quietCounts: false, breakEvery: 30, autoplay: true, lens: "latest" }, "personal ranking is off by default");
  const r = await call("PATCH", "/api/me", { token, body: { settings: { quietCounts: true, breakEvery: 0, lens: "shuffle" } } });
  assert.deepEqual(r.json.user.settings, { quietCounts: true, breakEvery: 0, autoplay: true, lens: "shuffle" });
  assert.equal((await call("PATCH", "/api/me", { token, body: { settings: { lens: "engagement" } } })).status, 400);
});

test("data export is a valid zip with your data and pictures", async () => {
  const token = await signup("exporter");
  const m = await upload(token);
  await post(token, { kind: "photo", caption: "export me", mediaIds: [m.id] });
  const res = await app.server.inject({ method: "GET", url: "/api/me/export", headers: { authorization: `Bearer ${token}` } });
  assert.equal(res.statusCode, 200);
  assert.equal(res.headers["content-type"], "application/zip");
  const zip = res.rawPayload;
  assert.equal(zip.readUInt32LE(0), 0x04034b50);
  const eocd = zip.length - 22;
  assert.equal(zip.readUInt32LE(eocd), 0x06054b50);
  assert.equal(zip.readUInt16LE(eocd + 10), 2, "data.json + one picture");
  // First entry is stored uncompressed, so the JSON is readable in place.
  const nameLen = zip.readUInt16LE(26), size = zip.readUInt32LE(18);
  assert.equal(zip.toString("utf8", 30, 30 + nameLen), "data.json");
  const data = JSON.parse(zip.toString("utf8", 30 + nameLen, 30 + nameLen + size));
  assert.equal(data.profile.username, "exporter");
  assert.equal(data.posts[0].caption, "export me");
  assert.match(data.posts[0].files[0], /^media\/0001-.*\.webp$/);
  const file = path.join(dir, "export.zip");
  fs.writeFileSync(file, zip);
  try {
    execFileSync("unzip", ["-tq", file]);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
});

test("reports reach admins, who can dismiss or remove", async () => {
  const boss = await signup("boss");
  const user = await signup("reporter");
  const bad1 = await post(user, { kind: "photo", mediaIds: [(await upload(user)).id] });
  const bad2 = await post(user, { kind: "photo", mediaIds: [(await upload(user)).id] });
  await call("POST", `/api/posts/${bad1.id}/report`, { token: boss, body: { reason: "spam" } });
  await call("POST", `/api/posts/${bad2.id}/report`, { token: boss, body: { reason: "worse spam" } });

  assert.equal((await call("GET", "/api/admin/reports", { token: user })).status, 404, "not visible to non-admins");
  assert.equal((await call("GET", "/api/me", { token: boss })).json.user.isAdmin, true);
  const queue = await call("GET", "/api/admin/reports", { token: boss });
  assert.equal(queue.json.reports.length, 2);
  assert.equal(queue.json.reports[0].reasons[0].by, "boss");

  await call("POST", `/api/admin/reports/${bad1.id}`, { token: boss, body: { action: "dismiss" } });
  await call("POST", `/api/admin/reports/${bad2.id}`, { token: boss, body: { action: "remove" } });
  assert.equal((await call("GET", `/api/posts/${bad1.id}`)).status, 200);
  assert.equal((await call("GET", `/api/posts/${bad2.id}`)).status, 404);
  assert.equal((await call("GET", "/api/admin/reports", { token: boss })).json.reports.length, 0);
});

test("For you ranks on deliberate signals only and explains each pick", async () => {
  const me = await signup("fy_me");
  const friend = await signup("fy_friend");
  const liked = await signup("fy_liked_author");
  const tagger = await signup("fy_tagger");
  const nobody = await signup("fy_nobody");
  const pic = async (t: string) => (await upload(t)).id;

  const seedPost = await post(liked, { kind: "photo", caption: "older #fyceramics", mediaIds: [await pic(liked)] });
  await call("POST", `/api/posts/${seedPost.id}/like`, { token: me });
  await call("POST", `/api/posts/${seedPost.id}/save`, { token: me });
  await call("POST", "/api/users/fy_friend/follow", { token: me });

  const byAuthor = await post(liked, { kind: "photo", caption: "new from an author I liked", mediaIds: [await pic(liked)] });
  const byTag = await post(tagger, { kind: "photo", caption: "a stranger's #fyceramics", mediaIds: [await pic(tagger)] });
  const byFriendLike = await post(nobody, { kind: "photo", caption: "my friend liked this", mediaIds: [await pic(nobody)] });
  const cold = await post(nobody, { kind: "photo", caption: "no signal at all", mediaIds: [await pic(nobody)] });
  await call("POST", `/api/posts/${byFriendLike.id}/like`, { token: friend });

  const r = await call("GET", "/api/feed/discover?lens=foryou", { token: me });
  assert.equal(r.json.lens, "foryou");
  const items: Json[] = r.json.items;
  const pos = (id: string) => items.findIndex((x) => x.id === id);
  const why = (id: string) => items[pos(id)]!.why as string;
  assert.ok(pos(seedPost.id) < 0, "posts you already liked aren't shown again");
  for (const p of [byAuthor, byTag, byFriendLike]) assert.ok(pos(p.id) >= 0 && pos(p.id) < pos(cold.id), "signalled posts outrank a cold one");
  assert.equal(why(byAuthor.id), "You've liked or saved posts by @fy_liked_author");
  assert.equal(why(byTag.id), "You've liked or saved posts tagged #fyceramics");
  assert.equal(why(byFriendLike.id), "Liked by someone you follow");
  assert.match(why(cold.id), /Recent and well liked/);

  const anon = await call("GET", "/api/feed/discover?lens=foryou");
  assert.equal(anon.json.lens, "loved", "signed out there is nothing personal to rank by");
});

test("bundled apps get token-only CORS; other origins stay locked out", async () => {
  const token = await signup("native_user");
  const app = { origin: "capacitor://localhost", host: "pics.me" };
  const pre = await call("OPTIONS", "/api/posts", { headers: { ...app, "access-control-request-method": "POST" } });
  assert.equal(pre.status, 204);
  assert.equal(pre.res.headers["access-control-allow-origin"], "capacitor://localhost");
  assert.match(String(pre.res.headers["access-control-allow-headers"]), /authorization/);
  assert.equal(pre.res.headers["access-control-allow-credentials"], undefined);

  const m = await upload(token);
  const created = await call("POST", "/api/posts", { token, headers: app, body: { kind: "photo", mediaIds: [m.id] } });
  assert.equal(created.status, 200);
  assert.equal(created.res.headers["access-control-allow-origin"], "capacitor://localhost");

  // A cookie alone must not authenticate a cross-origin app request.
  const login = await call("POST", "/api/auth/login", { body: { login: "native_user", password: "correct horse" } });
  const cookie = String(login.res.headers["set-cookie"]).split(";")[0]!;
  assert.equal((await call("GET", "/api/me", { headers: { cookie } })).json.user.username, "native_user");
  assert.equal((await call("GET", "/api/me", { headers: { ...app, cookie } })).json.user, null);

  assert.equal((await call("POST", "/api/posts", { token, headers: { origin: "https://evil.example", host: "pics.me" }, body: {} })).status, 403);
  assert.equal((await call("GET", m.urls.m)).res.headers["access-control-allow-origin"], "*");
});
