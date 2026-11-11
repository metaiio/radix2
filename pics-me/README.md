# pics.me

A fast, swipeable picture stream with a built-in remix **Studio**: any picture can become a short video, an ad, or a playable game.

This is the web version (installable as a PWA). The API is plain REST with bearer-token support, so the Android and iOS apps can sit on the same backend.

## Run it

Requires Node 22.18+ (ffmpeg optional, see below).

```bash
cd pics-me
npm install
npm run build        # builds the web app into dist/
npm run seed         # optional: demo accounts + pictures (login: demo / picsme-demo)
npm start            # http://localhost:3000
```

Development with hot reload: `npm run dev` (API on :3000, web on :5173).

Docker: `docker build -t pics-me . && docker run -p 3000:3000 -v picsme-data:/data pics-me`

### Configuration

Copy `.env.example` and set what you need. The ones that matter in production:

| Variable | Purpose |
|---|---|
| `PUBLIC_URL` | `https://pics.me` — used in share links and Open Graph tags |
| `COOKIE_SECURE=1` | mark the session cookie Secure (HTTPS) |
| `TRUST_PROXY=1` | when behind a load balancer, so rate limits see real client IPs |
| `DATA_DIR` | where the SQLite database and media files live (mount a volume here) |
| `ANTHROPIC_API_KEY` | turns on Claude vision for captions, ad copy and video storyboards |
| `ADMIN_USERS` | comma-separated usernames who can review reports at `/admin` |

## What makes it different

pics.me is built on a few rules that are enforced in code, not just promised (see `/about` in the app, and the "streams" section of `server/app.ts`):

- **Following is your people, in order.** Only accounts you follow, strictly newest first. Nothing is inserted or reordered. It marks what's new since your last visit, tells you when you're caught up, and has a real end.
- **Discover follows one rule that you pick.** Latest, Loved this week, Fresh voices (under 25 followers), Remixes, Shuffle — or **For you**, the one personal ranking. For you is off unless chosen, uses only deliberate signals (your likes, saves, comments, follows, and likes from people you follow), never watch time or scroll behaviour, skips posts you already liked so it runs dry instead of looping, and states the reason for every pick (`forYou()` in `server/app.ts`).
- **Your pace.** Optional pause suggestions every N posts, "quiet counts" to hide like/comment numbers, and autoplay you can switch off. No push nudges.
- **Close circle.** Share a post only with people you chose. Circle posts never reach Discover, search, tags or link previews, and can't be remixed.
- **AI is a labeled tool.** Everything from the Studio carries a label, credits its source, and creators can switch remixing off.
- **Your data is yours.** Location metadata is stripped on upload, a one-tap ZIP export returns everything you posted, and account deletion removes it.
- **People review reports.** Reports go to a human queue at `/admin` (set `ADMIN_USERS`); blocking makes two people invisible to each other.

These choices came from looking at what people say drove them off the big platforms (algorithmic feeds replacing friends, reels and ad load), what made the small "anti-Instagram" apps loved (private circles, no vanity counts), and research suggesting attention controls work best when the user sets them rather than one size for all.

## What's in it

**Stream** — full-screen vertical feed with snap scrolling, multi-picture carousels, double-tap to like, comments, saves (private), follows, activity inbox, share links, hashtags, search, explore, profiles, blocking, reporting.

**Studio** — tap the spark on any post (or upload fresh pictures):

- **Video** — a storyboard (shots, camera moves, on-screen lines) is planned from the pictures, then rendered on the device to a 720p clip with an optional soundtrack synthesised on the device (calm, lo-fi, upbeat — nothing sampled, so nothing to license). Shots are editable and re-renderable before posting.
- **Ad** — headline, supporting line, button and layout are written for the picture and brief, composed on a canvas in 4:5 / 1:1 / 9:16, and stay fully editable.
- **Game** — slide puzzle, tile swap, memory match or spot-the-difference built from the picture, each with a per-post leaderboard and a "challenge a friend" share.

**How the AI is wired.** With `ANTHROPIC_API_KEY` set, the planning and copy come from Claude looking at the actual picture (`server/ai.ts`). Without a key the same tools run on built-in templates that only know the picture's colours and shape — useful for trying the product, not a substitute. Pixels are always rendered in the browser; the video tool animates your stills (camera moves, cuts, text, music) rather than generating new footage. Plugging in a generative image-to-video provider is the natural next step and would slot in beside `renderVideo`.

**Efficiency**

- Uploads are shrunk in the browser before they leave the phone, then stored as WebP in three sizes; the feed requests only the size the screen needs (`srcset`).
- Each picture ships with its dominant colour and a ~300-byte blurred preview, so cards paint instantly.
- Only cards next to the viewport mount their media; video loads on demand.
- Media URLs are immutable and cached for a year; the service worker keeps viewed pictures offline.
- The creation tools are code-split from the stream.
- If ffmpeg is installed, recorded WebM is transcoded to H.264 MP4 in the background for iOS playback and video files are verified with ffprobe.

## Tests

```bash
npm run typecheck
npm test             # API integration tests (auth, uploads, stream rules, circles, blocking, export, moderation…)
npm run test:e2e     # real-browser run with two people: post, Studio tools, Following/Discover, circle, activity (needs `npm run build`)
```

The Claude-backed path is type-checked but has not been exercised against the live API in this repo's tests (they run without a key). Try it once with your key before launch.

## Layout

```
server/   Fastify API — app.ts (routes), media.ts (image/video pipeline), ai.ts, auth.ts, db.ts (SQLite schema)
web/src/  React app — Feed.tsx, Studio.tsx, studio/render.ts (video + ad renderers), games.tsx, pages.tsx
shared/   Types used by both sides
scripts/  seed.ts
e2e/      Playwright journey test
```

## Before real traffic

Things deliberately left simple that should be decided before a public launch:

- **Storage** — media is on local disk and the database is a single SQLite file. Fine for one server; move media to object storage + CDN and the database to Postgres when you need more than one.
- **Moderation** — reports reach a human review queue, but there is no automated screening of uploads (required at scale, and legally for some content categories).
- **Circle privacy** — circle posts are access-checked in the API, but media files are served from unguessable URLs rather than signed ones; move to signed URLs with object storage.
- **Accounts** — email/password only; no email verification, password reset or social sign-in yet.
- **Rate limits** are in-memory per process.
- **Legal** — terms, privacy policy and a takedown process are needed for user-generated content (and are required by both app stores).

## Android and iOS apps

The `android/` and `ios/` folders are native projects (Capacitor) that bundle the same web app and talk to the API at the address in `.env.native` (default `https://pics.me`) using a bearer token instead of a cookie. The server must list the apps' origins in `APP_ORIGINS` (the defaults already match).

```bash
npm run mobile:android   # builds the bundle, syncs, opens Android Studio  → Run, or Build > Generate Signed Bundle
npm run mobile:ios       # same for Xcode (macOS only)                     → pick a team under Signing, then Run / Archive
npm run test:e2e:native  # browser stand-in for the apps' cross-origin, token-auth mode
```

To point a build at a test server, run `VITE_API_BASE=https://staging.example npm run mobile:sync` and add that build's origin to the server's `APP_ORIGINS` if it differs.

There is also a manually-triggered GitHub Actions workflow (`.github/workflows/pics-me-mobile.yml`) that produces a debug APK and an iOS simulator build.

What is and isn't verified: the bundled, cross-origin mode is covered by `test:e2e:native` in desktop Chromium. The native projects themselves were generated and synced but **not compiled or run on a device** in this repository's environment (no Android SDK or Xcode there), and the CI workflow has not been run yet. Expect a round of on-device fixes — in particular on-device video recording in the iOS WebView and the photo picker on older Android versions.

Before store submission you still need: signing keys / an Apple developer team, store listings and screenshots, a privacy policy URL, age rating answers, and (both stores require these for user-generated content) the in-app report, block and account-deletion flows — which exist. Push notifications are not implemented. The session token is kept in WebView storage; moving it to Keychain/Keystore is a recommended hardening step.
