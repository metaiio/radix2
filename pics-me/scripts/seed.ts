// Fills an empty database with demo accounts and procedurally drawn pictures,
// so the stream has something in it on first run:  npm run seed
// Every demo account uses the password printed at the end.

import path from "node:path";
import sharp from "sharp";
import { hashPassword, newUid } from "../server/auth.ts";
import { loadConfig } from "../server/config.ts";
import { DB } from "../server/db.ts";
import { MediaStore } from "../server/media.ts";

const PASSWORD = "picsme-demo";
const cfg = loadConfig();
const db = new DB(path.join(cfg.dataDir, "pics.db"));
const media = new MediaStore(db, cfg.dataDir);

if (db.get("SELECT 1 FROM users LIMIT 1") && !process.argv.includes("--force")) {
  console.log("The database already has accounts — nothing seeded. Pass --force to add demo content anyway.");
  process.exit(0);
}

// Small deterministic PRNG so the demo set looks the same on every machine.
let state = 20261111;
const rnd = () => ((state = (state * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const between = (a: number, b: number) => a + rnd() * (b - a);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]!;
const hsl = (h: number, s: number, l: number) => `hsl(${Math.round(((h % 360) + 360) % 360)} ${Math.round(s)}% ${Math.round(l)}%)`;

function ridge(w: number, h: number, base: number, rough: number, color: string) {
  let d = `M0 ${h}`;
  let y = base;
  for (let x = 0; x <= w; x += w / 14) {
    y = Math.min(Math.max(y + between(-rough, rough), base - rough * 2.5), base + rough * 2);
    d += ` L${x.toFixed(0)} ${y.toFixed(0)}`;
  }
  return `<path d="${d} L${w} ${h} Z" fill="${color}"/>`;
}

function dusk(w: number, h: number) {
  const hue = pick([18, 32, 285, 330, 200]);
  const sunX = between(0.25, 0.75) * w, sunY = between(0.3, 0.5) * h, r = between(0.07, 0.13) * Math.min(w, h);
  return `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${hsl(hue + 220, 55, 22)}"/><stop offset=".55" stop-color="${hsl(hue + 10, 80, 58)}"/><stop offset="1" stop-color="${hsl(hue + 30, 95, 72)}"/>
    </linearGradient><radialGradient id="g"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
    <rect width="${w}" height="${h}" fill="url(#s)"/>
    <circle cx="${sunX}" cy="${sunY}" r="${r * 3.2}" fill="url(#g)" opacity=".5"/><circle cx="${sunX}" cy="${sunY}" r="${r}" fill="${hsl(hue + 35, 100, 88)}"/>
    ${ridge(w, h, h * 0.62, h * 0.035, hsl(hue + 240, 35, 34))}${ridge(w, h, h * 0.74, h * 0.04, hsl(hue + 245, 40, 22))}${ridge(w, h, h * 0.88, h * 0.03, hsl(hue + 250, 45, 11))}`;
}

function blobs(w: number, h: number) {
  const hue = between(0, 360);
  let out = `<defs><filter id="b"><feGaussianBlur stdDeviation="${Math.min(w, h) / 14}"/></filter></defs><rect width="${w}" height="${h}" fill="${hsl(hue, 45, 12)}"/><g filter="url(#b)">`;
  for (let i = 0; i < 7; i++) {
    out += `<circle cx="${between(0, w)}" cy="${between(0, h)}" r="${between(0.16, 0.36) * Math.min(w, h)}" fill="${hsl(hue + i * between(25, 55), 85, between(48, 66))}" opacity=".85"/>`;
  }
  return out + "</g>";
}

function skyline(w: number, h: number) {
  const hue = pick([215, 250, 290, 190]);
  let out = `<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${hsl(hue, 60, 9)}"/><stop offset="1" stop-color="${hsl(hue + 60, 70, 38)}"/></linearGradient></defs><rect width="${w}" height="${h}" fill="url(#s)"/>`;
  for (let i = 0; i < 70; i++) out += `<circle cx="${between(0, w)}" cy="${between(0, h * 0.5)}" r="${between(0.6, 2.2)}" fill="#fff" opacity="${between(0.3, 0.9).toFixed(2)}"/>`;
  for (let layer = 0; layer < 2; layer++) {
    for (let x = -20; x < w;) {
      const bw = between(0.06, 0.13) * w, bh = between(0.18, 0.5 - layer * 0.12) * h, top = h - bh;
      out += `<rect x="${x}" y="${top}" width="${bw}" height="${bh}" fill="${hsl(hue, 40, layer ? 7 : 15)}"/>`;
      for (let wy = top + 14; wy < h - 10; wy += 26) for (let wx = x + 9; wx < x + bw - 12; wx += 20) {
        if (rnd() < 0.36) out += `<rect x="${wx}" y="${wy}" width="9" height="13" fill="${hsl(44, 95, 70)}" opacity="${layer ? 0.9 : 0.5}"/>`;
      }
      x += bw + between(-4, 14);
    }
  }
  return out;
}

function tiles(w: number, h: number) {
  const hue = between(0, 360), n = pick([5, 6, 8]), size = w / n;
  let out = `<rect width="${w}" height="${h}" fill="${hsl(hue, 30, 92)}"/>`;
  for (let y = 0; y < h / size; y++) for (let x = 0; x < n; x++) {
    const c = hsl(hue + pick([0, 28, 180, 205]), between(60, 90), between(45, 70));
    const cx = x * size, cy = y * size, k = Math.floor(rnd() * 4);
    out += k === 0 ? `<circle cx="${cx + size / 2}" cy="${cy + size / 2}" r="${size * 0.42}" fill="${c}"/>`
      : k === 1 ? `<path d="M${cx} ${cy} h${size} a${size} ${size} 0 0 1 -${size} ${size}Z" fill="${c}"/>`
      : k === 2 ? `<rect x="${cx + size * 0.1}" y="${cy + size * 0.1}" width="${size * 0.8}" height="${size * 0.8}" rx="${size * 0.18}" fill="${c}"/>`
      : `<path d="M${cx + size} ${cy + size} h-${size} a${size} ${size} 0 0 1 ${size} -${size}Z" fill="${c}"/>`;
  }
  return out;
}

const SCENES = { dusk, blobs, skyline, tiles };
const SHAPES: [number, number][] = [[1440, 2400], [1440, 1920], [1600, 1600], [2160, 1440], [1440, 2560]];

const render = (scene: keyof typeof SCENES, w: number, h: number) =>
  sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${SCENES[scene](w, h)}</svg>`)).jpeg({ quality: 90 }).toBuffer();

const USERS = [
  { username: "demo", name: "Demo", bio: "The house account. Log in as me to look around." },
  { username: "mara.k", name: "Mara Kessler", bio: "Chasing the last ten minutes of light." },
  { username: "tomasz", name: "Tomasz W.", bio: "City at night, mostly on foot." },
  { username: "juno", name: "Juno Okafor", bio: "Colour first. Questions later." },
  { username: "patternhaus", name: "Pattern Haus", bio: "A small print studio. Shapes for sale." },
];

const POSTS: { user: string; scenes: (keyof typeof SCENES)[]; caption: string }[] = [
  { user: "mara.k", scenes: ["dusk"], caption: "Stayed until the ridge went black. Worth the cold hands. #goldenhour #mountains" },
  { user: "tomasz", scenes: ["skyline"], caption: "Every lit window is somebody still up. #citynights #lowlight" },
  { user: "juno", scenes: ["blobs", "blobs", "blobs"], caption: "Three studies in not overthinking it. Swipe. #colorpop #abstract" },
  { user: "patternhaus", scenes: ["tiles"], caption: "New run of tiles off the press this morning. #pattern #printmaking" },
  { user: "mara.k", scenes: ["dusk", "dusk"], caption: "Same hill, twenty minutes apart. #goldenhour #beforeafter" },
  { user: "demo", scenes: ["blobs"], caption: "Welcome to pics.me. Tap the spark on any post to remix it into a video, an ad or a game. #picsme" },
  { user: "tomasz", scenes: ["skyline", "dusk"], caption: "Left the office late, got the good sky anyway. #citynights #skies" },
  { user: "juno", scenes: ["tiles"], caption: "Accidentally made a quilt. #pattern #colorpop" },
  { user: "patternhaus", scenes: ["tiles", "tiles"], caption: "Two colourways. Which one goes on the tote? #pattern #design" },
  { user: "mara.k", scenes: ["dusk"], caption: "Pink does this for about ninety seconds a day. #skies #mountains" },
  { user: "juno", scenes: ["blobs"], caption: "Wallpaper, if you want it. #abstract #colorpop" },
  { user: "tomasz", scenes: ["skyline"], caption: "The quiet end of town. #citynights" },
];

const COMMENTS = ["This is the one.", "The colours here!", "Okay, remixing this immediately.", "Print when?", "Where is this?", "Saved.", "That light though."];

const hash = await hashPassword(PASSWORD);
const ids = new Map<string, number>();
const now = Date.now();
for (const u of USERS) {
  const r = db.run(
    "INSERT INTO users (username, email, pass_hash, display_name, bio, created_at) VALUES (?, ?, ?, ?, ?, ?)",
    u.username, `${u.username}@demo.pics.me`, hash, u.name, u.bio, now - 30 * 864e5,
  );
  ids.set(u.username, Number(r.lastInsertRowid));
}
const all = [...ids.values()];
for (const a of all) for (const b of all) if (a !== b && rnd() < 0.6) db.run("INSERT INTO follows (follower_id, followee_id, created_at) VALUES (?, ?, ?)", a, b, now);

let made = 0;
for (const [i, p] of POSTS.entries()) {
  const userId = ids.get(p.user)!;
  const rows = [];
  for (const scene of p.scenes) rows.push(await media.addImage(userId, await render(scene, ...pick(SHAPES))));
  const created = now - (POSTS.length - i) * between(2.5, 5) * 3600e3;
  const postId = Number(db.run(
    "INSERT INTO posts (uid, user_id, kind, caption, created_at) VALUES (?, ?, 'photo', ?, ?)", newUid(8), userId, p.caption, Math.round(created),
  ).lastInsertRowid);
  rows.forEach((m, pos) => db.run("INSERT INTO post_media (post_id, media_id, position) VALUES (?, ?, ?)", postId, m.id, pos));
  for (const t of p.caption.matchAll(/#([\p{L}\p{N}_]{1,32})/gu)) db.run("INSERT OR IGNORE INTO tags (tag, post_id) VALUES (?, ?)", t[1]!.toLowerCase(), postId);
  for (const other of all) {
    if (other !== userId && rnd() < 0.55) db.run("INSERT INTO likes (user_id, post_id, created_at) VALUES (?, ?, ?)", other, postId, now);
    if (other !== userId && rnd() < 0.25) db.run("INSERT INTO comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)", postId, other, pick(COMMENTS), now);
  }
  db.run("UPDATE posts SET like_count = (SELECT count(*) FROM likes WHERE post_id = ?1), comment_count = (SELECT count(*) FROM comments WHERE post_id = ?1) WHERE id = ?1", postId);
  made++;
}

// One ready-made game so the remix format is visible straight away.
const src = db.get<{ id: number; media_id: number }>("SELECT p.id, pm.media_id FROM posts p JOIN post_media pm ON pm.post_id = p.id JOIN users u ON u.id = p.user_id WHERE u.username = 'patternhaus' ORDER BY p.id LIMIT 1")!;
const gameId = Number(db.run(
  "INSERT INTO posts (uid, user_id, kind, caption, remix_of, meta, created_at) VALUES (?, ?, 'game', ?, ?, ?, ?)",
  newUid(8), ids.get("juno")!, "Turned @patternhaus's tiles into a puzzle. Beat my time. #puzzle #pattern", src.id, JSON.stringify({ game: { type: "swap", size: 3 } }), now - 3600e3,
).lastInsertRowid);
db.run("INSERT INTO post_media (post_id, media_id, position) VALUES (?, ?, 0)", gameId, src.media_id);
db.run("INSERT OR IGNORE INTO tags (tag, post_id) VALUES ('puzzle', ?), ('pattern', ?)", gameId, gameId);
db.run("UPDATE posts SET remix_count = 1 WHERE id = ?", src.id);

db.close();
console.log(`Seeded ${USERS.length} accounts and ${made + 1} posts.\nLog in as "demo" (or ${USERS.slice(1).map((u) => u.username).join(", ")}) with password "${PASSWORD}".`);
