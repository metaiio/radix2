// Checks the app the way the Android/iOS builds run it: pages bundled and
// served from one origin, API on another, signed in with a bearer token.
//   npm run test:e2e:native
// (A real device build still needs testing on hardware; this covers the
// cross-origin plumbing the native shells depend on.)

import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, devices } from "playwright";
import sharp from "sharp";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "picsme-native-"));
const API = "http://localhost:3198";
const APP = "http://localhost:3298";
const bundle = path.join(tmp, "bundle");

execFileSync("npx", ["vite", "build", "--mode", "native", "--outDir", bundle, "--emptyOutDir", "--logLevel", "error"], {
  cwd: root, env: { ...process.env, VITE_API_BASE: API }, stdio: "inherit",
});

const server = spawn(process.execPath, ["--disable-warning=ExperimentalWarning", "server/index.ts"], {
  cwd: root,
  env: { ...process.env, PORT: "3198", DATA_DIR: path.join(tmp, "data"), RATE_SCALE: "100", ANTHROPIC_API_KEY: "", ANTHROPIC_AUTH_TOKEN: "", APP_ORIGINS: APP },
  stdio: ["ignore", "inherit", "inherit"],
});

// Stand-in for the native shell's local web server: static files with a single-page fallback.
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".png": "image/png", ".svg": "image/svg+xml", ".webmanifest": "application/manifest+json" };
const shell = http.createServer((req, res) => {
  const rel = decodeURIComponent(new URL(req.url, APP).pathname);
  let file = path.join(bundle, rel);
  if (!file.startsWith(bundle) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(bundle, "index.html");
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}).listen(3298);

let browser;
let failed = false;
const expect = (cond, msg) => {
  if (!cond) throw new Error(`Expectation failed: ${msg}`);
};
const step = async (name, fn) => {
  await fn();
  console.log(`  ✓ ${name}`);
};

try {
  for (let i = 0; ; i++) {
    try {
      if ((await fetch(`${API}/api/health`)).ok) break;
    } catch { /* not up yet */ }
    if (i > 50) throw new Error("server did not start");
    await new Promise((r) => setTimeout(r, 100));
  }
  const photo = path.join(tmp, "photo.jpg");
  await sharp({ create: { width: 1600, height: 2000, channels: 3, background: "#d9634a" } })
    .composite([{ input: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="2000"><circle cx="500" cy="600" r="300" fill="#ffe08a"/><rect x="800" y="1100" width="600" height="600" fill="#2b7fd9"/></svg>') }])
    .jpeg().toFile(photo);

  browser = await chromium.launch();
  const page = await (await browser.newContext({ ...devices["Pixel 7"] })).newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => m.type() === "error" && !/status of 40[14]/.test(m.text()) && errors.push(m.text()));
  const live = page.locator(".feed-page:not([hidden])");

  await step("sign up across origins; the session is a token, not a cookie", async () => {
    await page.goto(`${APP}/signup`);
    await page.getByLabel("Username").fill("pocket");
    await page.getByLabel("Email").fill("pocket@example.com");
    await page.getByLabel("Password").fill("correct horse battery");
    await page.getByRole("button", { name: "Create account" }).click();
    await page.getByRole("link", { name: "Profile" }).waitFor();
    expect((await page.evaluate(() => localStorage.getItem("pm_token")))?.length > 20, "token stored on the device");
    expect((await page.context().cookies()).length === 0, "no cookies involved");
    await page.reload();
    await page.getByRole("link", { name: "Profile" }).waitFor();
  });

  await step("upload and post; pictures load from the API origin", async () => {
    await page.goto(`${APP}/upload`);
    await page.locator('input[type="file"]').setInputFiles(photo);
    await page.getByLabel("Caption").fill("from the app #native");
    await page.getByRole("button", { name: "Post", exact: true }).click();
    await page.waitForURL(/\/p\//);
    const img = live.locator(".card .pic img").first();
    await img.waitFor();
    expect((await img.getAttribute("src")).startsWith(`${API}/media/`), "media URLs are absolute");
    await page.waitForFunction(() => document.querySelector(".feed-page:not([hidden]) .card .pic img")?.naturalWidth > 0);
    await page.getByRole("button", { name: "Like", exact: true }).click();
    await page.getByRole("button", { name: "Unlike" }).waitFor();
  });

  const postUrl = page.url();

  await step("Studio canvases can read cross-origin pictures (ad export + game)", async () => {
    await page.getByRole("button", { name: "Remix in Studio" }).first().click();
    await page.getByRole("tab", { name: /Ad/ }).click();
    await page.getByRole("button", { name: "Write my ad" }).click();
    await page.getByLabel("Headline").waitFor();
    await page.getByRole("button", { name: "Post ad" }).click();
    await page.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl);
    await live.locator(".badge-ad").waitFor();

    await page.goto(postUrl);
    await page.getByRole("button", { name: "Remix in Studio" }).first().click();
    await page.getByRole("tab", { name: /Game/ }).click();
    await page.getByRole("button", { name: /Spot the difference/ }).click();
    await page.locator('.spot-pair .board[data-ready="1"]').waitFor();
  });

  await step("video renders and uploads from the bundled app", async () => {
    await page.getByRole("tab", { name: /Video/ }).click();
    await page.getByRole("button", { name: "Create video" }).click();
    await page.getByRole("button", { name: "Post video" }).waitFor({ timeout: 60_000 });
    await page.getByRole("button", { name: "Post video" }).click();
    await page.waitForURL((u) => /\/p\//.test(u.pathname) && u.href !== postUrl, { timeout: 30_000 });
    await live.locator(".card video").waitFor();
  });

  await step("For you can be switched on; data export and log out work with the token", async () => {
    await page.goto(`${APP}/discover`);
    await page.getByRole("button", { name: /Change what Discover shows/ }).click();
    await page.getByRole("radio", { name: /For you/ }).click();
    await page.getByRole("button", { name: /Showing For you/ }).waitFor();
    await page.goto(`${APP}/settings`);
    const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: /Download everything/ }).click()]);
    expect(download.suggestedFilename() === "pics.me-pocket.zip", "export downloads");
    await page.getByRole("button", { name: "Log out" }).click();
    await page.getByRole("link", { name: "Sign in" }).waitFor();
    expect((await page.evaluate(() => localStorage.getItem("pm_token"))) === null, "token cleared on log out");
  });

  expect(errors.length === 0, `no browser errors, got: ${errors.join(" | ")}`);
  console.log("\nBundled-app mode passed.");
} catch (err) {
  failed = true;
  console.error("\n✗ Native-mode check failed:", err);
} finally {
  await browser?.close();
  server.kill();
  shell.close();
  fs.rmSync(tmp, { recursive: true, force: true });
  process.exit(failed ? 1 : 0);
}
