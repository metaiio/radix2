// End-to-end check of the main journeys in a real browser:
//   npm run build && npm run test:e2e
// Boots its own server on a throwaway data directory. Screenshots land in e2e/out.

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "e2e/out");
const data = fs.mkdtempSync(path.join(os.tmpdir(), "picsme-e2e-"));
const PORT = 3199;
const BASE = `http://localhost:${PORT}`;
fs.mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server/index.ts"], {
  cwd: root,
  env: { ...process.env, PORT: String(PORT), DATA_DIR: data, RATE_SCALE: "100", ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "" },
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

  // A test photo with recognisable quadrants (so puzzles have distinct tiles).
  const photo = path.join(data, "photo.jpg");
  await sharp(Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1800" height="2400"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ff7a59"/><stop offset="1" stop-color="#3a2bd9"/></linearGradient></defs><rect width="1800" height="2400" fill="url(#g)"/><circle cx="500" cy="700" r="320" fill="#ffe08a"/><rect x="950" y="1300" width="600" height="700" rx="80" fill="#12c2a0"/><path d="M200 2100 L800 1500 L1100 2100Z" fill="#fff" opacity=".8"/></svg>`,
  )).jpeg({ quality: 92 }).toFile(photo);

  browser = await chromium.launch();
  const ctx = await browser.newContext({ ...devices["Pixel 7"] });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("dialog", (d) => d.accept());
  // The home stream stays mounted (hidden) under other pages; look only at the visible one.
  const live = page.locator(".feed-page:not([hidden])");
  const shot = (name) => page.screenshot({ path: path.join(out, `${name}.png`) });

  await step("empty stream invites the first post", async () => {
    await page.goto(BASE);
    await page.getByText("Be the first to post").waitFor();
  });

  await step("sign up", async () => {
    await page.getByRole("link", { name: "Sign in" }).click();
    await page.getByRole("link", { name: "Create an account" }).click();
    await page.getByLabel("Username").fill("e2e_user");
    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("link", { name: "Profile" }).waitFor();
  });

  await step("upload a picture with a suggested caption", async () => {
    await page.getByRole("link", { name: "Post", exact: true }).click();
    await page.locator('input[type="file"]').setInputFiles(photo);
    await page.getByRole("button", { name: "Suggest a caption" }).click();
    const caption = page.getByLabel("Caption");
    await page.waitForFunction(() => document.querySelector("textarea")?.value.includes("#"));
    await caption.fill((await caption.inputValue()) + " #e2e");
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.waitForURL(/\/p\//);
    await live.locator(".card .pic img").first().waitFor();
    await shot("1-post");
  });

  const postUrl = page.url();

  await step("like and comment", async () => {
    await page.getByRole("button", { name: "Like", exact: true }).click();
    await page.getByRole("button", { name: "Unlike" }).waitFor();
    await page.getByRole("button", { name: "Comments" }).click();
    await page.getByLabel("Add a comment").fill("first!");
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.locator(".comment", { hasText: "first!" }).waitFor();
    await shot("2-comments");
    await page.getByRole("button", { name: "Close" }).click();
    await page.reload();
    await page.getByRole("button", { name: "Unlike" }).waitFor();
    expect((await page.getByRole("button", { name: "Comments" }).innerText()).includes("1"), "comment count persisted");
  });

  await step("studio: write and post an ad", async () => {
    await page.getByRole("button", { name: "Remix with AI" }).first().click();
    await page.getByRole("tab", { name: /Ad/ }).click();
    await page.getByLabel("Brand").fill("Northwind");
    await page.getByLabel("Promoting").fill("trail shoes");
    await page.getByRole("button", { name: "Write my ad" }).click();
    const headline = page.getByLabel("Headline");
    await headline.waitFor();
    expect((await headline.inputValue()).length > 3, "headline generated");
    await page.waitForTimeout(300);
    await shot("3-ad-studio");
    await page.getByRole("button", { name: "Post ad" }).click();
    await page.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl);
    await live.locator(".badge-ad").waitFor();
    await live.locator(".card .pic img").first().waitFor();
    await page.waitForTimeout(400);
    await shot("4-ad-post");
  });

  await step("studio: post a game, then solve it", async () => {
    await page.goto(postUrl);
    await page.getByRole("button", { name: "Remix with AI" }).first().click();
    await page.getByRole("tab", { name: /Game/ }).click();
    await page.getByRole("button", { name: /Tile swap/ }).click();
    await page.locator(".board .tile").first().waitFor();
    await shot("5-game-studio");
    await page.getByRole("button", { name: "Post game" }).click();
    await page.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl);
    await page.getByRole("button", { name: /Play Tile swap/ }).click();
    await page.locator(".overlay .board .tile").first().waitFor();
    // Solve: put each tile in its home cell, left to right.
    for (let home = 0; home < 9; home++) {
      const at = Number(await page.locator(`.overlay .tile[data-tile="${home}"]`).getAttribute("data-pos"));
      if (at === home) continue;
      await page.locator(`.overlay .tile[data-pos="${at}"]`).click();
      await page.locator(`.overlay .tile[data-pos="${home}"]`).click();
    }
    await page.getByText(/Solved in/).waitFor();
    await page.locator(".leaderboard li", { hasText: "@e2e_user" }).waitFor();
    await shot("6-game-won");
    await page.getByRole("button", { name: "Close game" }).click();
  });

  await step("studio: render and post a video", async () => {
    await page.goto(postUrl);
    await page.getByRole("button", { name: "Remix with AI" }).first().click();
    await page.getByLabel("Vibe").fill("launch hype");
    await page.getByRole("button", { name: "Create video" }).click();
    await page.getByRole("progressbar").waitFor();
    await shot("7-video-rendering");
    await page.getByRole("button", { name: "Post video" }).waitFor({ timeout: 60_000 });
    const dur = await page.locator(".preview video").evaluate((v) => new Promise((res) => (v.readyState >= 1 ? res(v.videoWidth) : (v.onloadedmetadata = () => res(v.videoWidth)))));
    expect(dur === 720, `rendered video is 720px wide (got ${dur})`);
    await page.getByRole("button", { name: "Post video" }).click();
    await page.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl, { timeout: 30_000 });
    await live.locator(".card video").waitFor();
    await page.waitForFunction(() => {
      const v = document.querySelector(".feed-page:not([hidden]) .card video");
      return v && !v.paused && v.currentTime > 0.3;
    }, null, { timeout: 15_000 });
    await shot("8-video-post");
  });

  await step("stream, explore, tag and profile show everything", async () => {
    await page.goto(BASE);
    await page.locator(".feed-slot").nth(3).waitFor({ state: "attached" });
    expect((await page.locator(".feed-slot").count()) === 4, "four posts in the stream");
    await page.goto(`${BASE}/tag/e2e`);
    await page.locator(".grid-cell").first().waitFor();
    await page.goto(`${BASE}/explore`);
    await page.getByLabel("Search").fill("e2e");
    await page.locator(".user-row", { hasText: "@e2e_user" }).click();
    await page.locator(".profile").waitFor();
    expect((await page.locator(".grid-cell").count()) === 4, "four posts on the profile");
    await shot("9-profile");
    const original = await (await fetch(`${BASE}/api/posts/${postUrl.split("/p/")[1]}`)).json();
    expect(original.post.remixCount === 3, "original shows three remixes");
  });

  await step("share page carries Open Graph tags", async () => {
    const html = await (await fetch(postUrl)).text();
    expect(/property="og:image" content="[^"]+m\.webp"/.test(html), "og:image present");
    expect(html.includes("e2e_user on pics.me"), "og:title present");
  });

  await step("log out", async () => {
    await page.getByRole("button", { name: "Edit profile" }).click();
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("link", { name: "Sign in" }).waitFor();
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
