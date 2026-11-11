// End-to-end check of the main journeys in a real browser:
//   npm run build && npm run test:e2e
// Boots its own server on a throwaway data directory. Screenshots land in e2e/out.

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import sharp from "sharp";
import { spotLayout } from "../shared/spot.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "e2e/out");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "picsme-e2e-"));
const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server/index.ts"], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: data, RATE_SCALE: "100", ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "", ADMIN_USERS: "ada" },
  stdio: ["ignore", "inherit", "inherit"],
});

let browser;
let failed = false;
const steps = [];
const step = async (name, fn) => {
  const t = Date.now();
  await fn();
  steps.push(name);
  console.log(`  ✓ ${name} (${Date.now() - t}ms)`);
};
const expect = (cond, msg) => {
  if (!cond) throw new Error(`Expectation failed: ${msg}`);
};

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${BASE}/api/health`)).ok) break;
    } catch { /* not up yet */ }
    if (i > 50) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 100));
  }

  // A test photo with recognisable regions (so puzzles have distinct tiles).
  const photo = path.join(data, "photo.jpg");
  await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#3a2bd9"/></linearGradient></defs><rect width="1800" height="2400" fill="url(#g)"/><circle cx="500" cy="700" r="320" fill="#ffe08a"/><rect x="950" y="1300" width="600" height="700" rx="80" fill="#12c2a0"/><path d="M200 2100 L800 1500 L1100 2100Z" fill="#fff" opacity=".8"/></svg>`,
  )).jpeg({ quality: 92 }).toFile(photo);

  browser = await chromium.launch();
  const errors = [];
  const open = async () => {
    const ctx = await browser.newContext({ ...devices["Pixel 7"] });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => m.type() === "error" && !/status of 40[14]/.test(m.text()) && errors.push(m.text()));
    page.on("dialog", (d) => d.accept());
    return page;
  };
  // The home stream stays mounted (hidden) under other pages; look only at the visible one.
  const live = (page) => page.locator(".feed-page:not([hidden])");
  const shot = (page, name) => page.screenshot({ path: path.join(out, `${name}.png`) });
  const signup = async (page, name) => {
    await page.goto(`${BASE}/signup`);
    await page.getByLabel("Username").fill(name);
    await page.getByLabel("Email").fill(`${name}@example.com`);
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("link", { name: "Profile" }).waitFor();
  };
  const api = async (page, url) => (await page.request.get(BASE + url)).json();

  const ada = await open();

  await step("signed out, the stream is Discover and says what it shows", async () => {
    await ada.goto(BASE);
    await ada.getByText("Nothing in Latest right now").waitFor();
    await ada.getByRole("button", { name: /Change what Discover shows/ }).click();
    await ada.getByRole("radio", { name: /Shuffle/ }).waitFor();
    await shot(ada, "01-lenses");
    await ada.getByRole("button", { name: "Close" }).click();
  });

  await step("sign up lands on an empty Following stream", async () => {
    await signup(ada, "ada");
    await ada.getByText("This stream only shows people you follow").waitFor();
  });

  await step("upload a picture with a suggested caption", async () => {
    await ada.getByRole("link", { name: "Post", exact: true }).click();
    await ada.locator('input[type="file"]').setInputFiles(photo);
    await ada.getByRole("button", { name: "Suggest a caption" }).click();
    const caption = ada.getByLabel("Caption");
    await ada.waitForFunction(() => document.querySelector("textarea")?.value.includes("#"));
    await caption.fill((await caption.inputValue()) + " #e2e");
    await shot(ada, "02-upload");
    await ada.getByRole("button", { name: "Post", exact: true }).click();
    await ada.waitForURL(/\/p\//);
    await live(ada).locator(".card .pic img").first().waitFor();
  });

  const postUrl = ada.url();
  const postId = postUrl.split("/p/")[1];

  await step("like, save and comment", async () => {
    await ada.getByRole("button", { name: "Like", exact: true }).click();
    await ada.getByRole("button", { name: "Unlike" }).waitFor();
    await ada.getByRole("button", { name: "Save", exact: true }).click();
    await ada.getByRole("button", { name: "Remove from saved" }).waitFor();
    await ada.getByRole("button", { name: "Comments" }).click();
    await ada.getByLabel("Add a comment").fill("first!");
    await ada.getByRole("button", { name: "Post", exact: true }).click();
    await ada.locator(".comment", { hasText: "first!" }).waitFor();
    await ada.getByRole("button", { name: "Close" }).click();
    await ada.reload();
    await ada.getByRole("button", { name: "Unlike" }).waitFor();
    await ada.getByRole("button", { name: "Remove from saved" }).waitFor();
  });

  await step("studio: write and post an ad", async () => {
    await ada.getByRole("button", { name: "Remix in Studio" }).first().click();
    await ada.getByRole("tab", { name: /Ad/ }).click();
    await ada.getByLabel("Brand").fill("Northwind");
    await ada.getByLabel("Promoting").fill("trail shoes");
    await ada.getByRole("button", { name: "Write my ad" }).click();
    const headline = ada.getByLabel("Headline");
    await headline.waitFor();
    expect((await headline.inputValue()).length > 3, "headline generated");
    await ada.waitForTimeout(300);
    await shot(ada, "03-ad-studio");
    await ada.getByRole("button", { name: "Post ad" }).click();
    await ada.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl);
    await live(ada).locator(".badge-ad").waitFor();
  });

  await step("studio: post a tile-swap game, then solve it", async () => {
    await ada.goto(postUrl);
    await ada.getByRole("button", { name: "Remix in Studio" }).first().click();
    await ada.getByRole("tab", { name: /Game/ }).click();
    await ada.getByRole("button", { name: /Tile swap/ }).click();
    await ada.locator(".board .tile").first().waitFor();
    await ada.getByRole("button", { name: "Post game" }).click();
    await ada.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl);
    await ada.getByRole("button", { name: /Play Tile swap/ }).click();
    await ada.locator(".overlay .board .tile").first().waitFor();
    for (let home = 0; home < 9; home++) {
      const at = Number(await ada.locator(`.overlay .tile[data-tile="${home}"]`).getAttribute("data-pos"));
      if (at === home) continue;
      await ada.locator(`.overlay .tile[data-pos="${at}"]`).click();
      await ada.locator(`.overlay .tile[data-pos="${home}"]`).click();
    }
    await ada.getByText(/Solved in/).waitFor();
    await ada.locator(".leaderboard li", { hasText: "@ada" }).waitFor();
    await ada.getByRole("button", { name: "Challenge a friend" }).waitFor();
    await ada.getByRole("button", { name: "Close game" }).click();
  });

  await step("studio: post a spot-the-difference game, then find every change", async () => {
    await ada.goto(postUrl);
    await ada.getByRole("button", { name: "Remix in Studio" }).first().click();
    await ada.getByRole("tab", { name: /Game/ }).click();
    await ada.getByRole("button", { name: /Spot the difference/ }).click();
    await ada.locator('.spot-pair .board[data-ready="1"]').waitFor();
    await shot(ada, "04-spot-studio");
    await ada.getByRole("button", { name: "Post game" }).click();
    await ada.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl);
    const { post } = await api(ada, `/api/posts/${ada.url().split("/p/")[1]}`);
    expect(post.meta.game.type === "spot" && post.meta.game.seed > 0, "spot game stores its seed");
    await ada.getByRole("button", { name: /Play Spot the difference/ }).click();
    const board = ada.locator('.overlay .spot-pair .board[data-ready="1"]');
    await board.waitFor();
    const box = await board.boundingBox();
    const spots = spotLayout(post.meta.game.seed, post.meta.game.size);
    // First tap somewhere that isn't a change: it should count as a move, not a find.
    let miss = { x: 0.5, y: 0.5 };
    for (let gx = 0.15; gx < 0.9; gx += 0.1) for (let gy = 0.15; gy < 0.9; gy += 0.1) {
      if (spots.every((s) => Math.hypot(s.x - gx, s.y - gy) > 0.2)) miss = { x: gx, y: gy };
    }
    await board.click({ position: { x: miss.x * box.width, y: miss.y * box.height } });
    expect((await ada.locator(".overlay .spot-ring").count()) === 0, "a miss finds nothing");
    for (const s of spots) {
      await board.click({ position: { x: s.x * box.width, y: s.y * box.height } });
    }
    await ada.getByText(/Solved in/).waitFor();
    expect((await ada.locator(".overlay .spot-ring").count()) === post.meta.game.size * 2, "every change is ringed on both pictures");
    await shot(ada, "05-spot-won");
    await ada.getByRole("button", { name: "Close game" }).click();
  });

  await step("studio: render a video with a generated soundtrack and post it", async () => {
    await ada.goto(postUrl);
    await ada.getByRole("button", { name: "Remix in Studio" }).first().click();
    await ada.getByLabel("Vibe").fill("launch hype");
    await ada.getByRole("button", { name: /Upbeat/ }).click();
    await ada.getByRole("button", { name: "Create video" }).click();
    await ada.getByRole("progressbar").waitFor();
    await ada.getByRole("button", { name: "Post video" }).waitFor({ timeout: 60_000 });
    await shot(ada, "06-video-studio");
    await ada.getByRole("button", { name: "Post video" }).click();
    await ada.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl, { timeout: 30_000 });
    await live(ada).locator(".card video").waitFor();
    await ada.waitForFunction(() => {
      const v = document.querySelector(".feed-page:not([hidden]) .card video");
      return v && !v.paused && v.currentTime > 0.3;
    }, null, { timeout: 15_000 });
    const { post } = await api(ada, `/api/posts/${ada.url().split("/p/")[1]}`);
    expect(post.media[0].w === 720, "video is 720px wide");
    try {
      const file = path.join(data, post.media[0].video.src.replace("/media/", "media/"));
      const streams = execFileSync("ffprobe", ["-v", "error", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file]).toString();
      expect(streams.includes("audio") && streams.includes("video"), `recording has picture and sound (got ${streams.trim()})`);
    } catch (err) {
      if (err.code !== "ENOENT") throw err;
    }
  });

  // ---- a second person ------------------------------------------------------
  const ben = await open();

  await step("a new member follows from a profile and gets a finite, labelled Following stream", async () => {
    await signup(ben, "ben");
    await ben.goto(`${BASE}/u/ada`);
    await ben.getByRole("button", { name: "Follow", exact: true }).click();
    await ben.getByRole("button", { name: "Following" }).waitFor();
    await ben.getByRole("link", { name: "Stream" }).click();
    await live(ben).locator(".badge-new").first().waitFor();
    await live(ben).getByText("You follow @ada").first().waitFor();
    await shot(ben, "07-following");
    const feed = live(ben).locator(".feed");
    for (let i = 0; i < 8; i++) {
      await feed.evaluate((el) => el.scrollBy(0, el.clientHeight));
      await ben.waitForTimeout(350);
    }
    await ben.getByRole("heading", { name: "That's everything" }).waitFor();
    await shot(ben, "08-the-end");
  });

  await step("Discover can be switched to another rule, and posts say why they're there", async () => {
    await ben.getByRole("link", { name: "Discover", exact: true }).click();
    await ben.getByRole("button", { name: /Change what Discover shows/ }).click();
    await ben.getByRole("radio", { name: /Shuffle/ }).click();
    await live(ben).getByText("Picked at random — nothing ranked this").first().waitFor();
    await live(ben).locator(".why").first().click();
    await ben.getByText("Why it's here.").waitFor();
    await shot(ben, "09-why");
    await ben.getByRole("button", { name: "Close" }).click();
  });

  await step("close-circle posts reach the circle and nobody else", async () => {
    await ada.goto(`${BASE}/u/ben`);
    await ada.getByRole("button", { name: "Add to circle" }).click();
    await ada.getByRole("button", { name: "In your circle" }).waitFor();
    await ada.goto(`${BASE}/upload`);
    await ada.locator('input[type="file"]').setInputFiles(photo);
    await ada.getByLabel("Caption").fill("just for the circle");
    await ada.getByRole("radio", { name: /Close circle/ }).click();
    await ada.getByRole("button", { name: "Post", exact: true }).click();
    await ada.waitForURL((u) => /\/p\//.test(u.pathname));
    const circleId = ada.url().split("/p/")[1];
    await live(ada).getByText("Close circle").first().waitFor();

    await ben.goto(BASE);
    await live(ben).getByText("just for the circle").waitFor();
    await live(ben).getByText("@ada shared this with their close circle").waitFor();
    expect((await live(ben).locator(".feed-slot").first().getByRole("button", { name: "Remix in Studio" }).count()) === 0, "circle posts can't be remixed");
    expect((await fetch(`${BASE}/api/posts/${circleId}`)).status === 404, "outsiders can't open a circle post");
    const discover = await api(ben, "/api/feed/discover?lens=latest");
    expect(!discover.items.some((p) => p.id === circleId), "circle post is not in Discover");
  });

  await step("activity inbox, quiet counts and data export", async () => {
    await ben.goto(postUrl);
    await ben.getByRole("button", { name: "Like", exact: true }).first().click();
    await ben.getByRole("button", { name: "Unlike" }).first().waitFor();

    await ada.goto(BASE);
    await ada.getByRole("link", { name: /Activity, 2 new/ }).click();
    await ada.getByText("started following you").waitFor();
    await ada.getByText("liked your post").waitFor();
    await shot(ada, "10-activity");

    await ada.goto(`${BASE}/settings`);
    await ada.getByText("Quiet counts").click();
    await shot(ada, "11-settings");
    await ada.goto(postUrl);
    await ada.getByRole("button", { name: "Unlike" }).first().waitFor();
    expect((await ada.getByRole("button", { name: "Unlike" }).first().innerText()).trim() === "Like", "numbers are hidden in quiet mode");

    const zip = await ada.request.get(`${BASE}/api/me/export`);
    expect(zip.headers()["content-type"] === "application/zip" && (await zip.body()).length > 20_000, "export downloads a zip with media");
  });

  await step("report → admin review → removed", async () => {
    await ben.goto(postUrl);
    await ben.getByRole("button", { name: "More options" }).first().click();
    await ben.getByRole("button", { name: "Report" }).click(); // the prompt is auto-accepted with an empty reason…
    await ben.request.post(`${BASE}/api/posts/${postId}/report`, { data: { reason: "testing the queue" }, headers: { origin: BASE } });
    await ada.goto(`${BASE}/admin`);
    await ada.getByText("testing the queue").waitFor();
    await shot(ada, "12-admin");
    await ada.getByRole("button", { name: "Keep post" }).click();
    await ada.getByText("Nothing waiting for review").waitFor();
    await ben.goto(`${BASE}/admin`);
    await ben.getByText("There's nothing at this address").waitFor();
  });

  await step("profile shows posts and private saves; about page explains the stream", async () => {
    await ada.goto(`${BASE}/u/ada`);
    await ada.locator(".grid-cell").first().waitFor();
    expect((await ada.locator(".grid-cell").count()) === 6, "six posts on the profile");
    await ada.getByRole("tab", { name: "Saved" }).click();
    await ada.waitForFunction(() => document.querySelectorAll(".grid-cell").length === 1, null, { timeout: 5000 });
    await shot(ada, "13-profile");
    await ada.goto(`${BASE}/about`);
    await ada.getByRole("heading", { name: "You pick the rule" }).waitFor();
    await shot(ada, "14-about");
  });

  await step("share page carries Open Graph tags; log out", async () => {
    const html = await (await fetch(postUrl)).text();
    expect(/property="og:image" content="[^"]+m\.webp"/.test(html), "og:image present");
    await ada.goto(`${BASE}/settings`);
    await ada.getByRole("button", { name: "Log out" }).click();
    await ada.getByRole("link", { name: "Sign in" }).waitFor();
  });

  expect(errors.length === 0, `no browser errors, got: ${errors.join(" | ")}`);
  console.log(`\nAll ${steps.length} journeys passed. Screenshots: ${path.relative(process.cwd(), out)}`);
} catch (err) {
  failed = true;
  console.error("\n✗ E2E failed:", err);
} finally {
  await browser?.close();
  server.kill();
  fs.rmSync(data, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
