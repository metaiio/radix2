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

## What's in it

**Stream** — full-screen vertical feed with snap scrolling, "For you" (engagement decayed by age) and "Following" tabs, multi-picture carousels, double-tap to like, comments, follows, share links, hashtags, search, explore, profiles, reporting, account deletion.

**Studio** — tap the spark on any post (or upload fresh pictures):

- **Video** — a storyboard (shots, camera moves, on-screen lines) is planned from the pictures, then rendered on the device to a 720p clip. Shots are editable and re-renderable before posting.
- **Ad** — headline, supporting line, button and layout are written for the picture and brief, composed on a canvas in 4:5 / 1:1 / 9:16, and stay fully editable.
- **Game** — slide puzzle, tile swap or memory match built from the picture, with a per-post leaderboard.

Remixes credit the original post and creators can switch remixing off per post.

**How the AI is wired.** With `ANTHROPIC_API_KEY` set, the planning and copy come from Claude looking at the actual picture (`server/ai.ts`). Without a key the same tools run on built-in templates that only know the picture's colours and shape — useful for trying the product, not a substitute. Pixels are always rendered in the browser; the video tool animates your stills (camera moves, cuts, text) rather than generating new footage. Plugging in a generative image-to-video provider is the natural next step and would slot in beside `renderVideo`.

**Efficiency**

- Uploads are shrunk in the browser before they leave the phone, then stored as WebP in three sizes; the feed requests only the size the screen needs (`srcset`).
- Each picture ships with its dominant colour and a ~300-byte blurred preview, so cards paint instantly.
- Only cards next to the viewport mount their media; video loads on demand.
- EXIF/GPS metadata is stripped from every upload.
- Media URLs are immutable and cached for a year; the service worker keeps viewed pictures offline.
- The creation tools are code-split, so viewers download ~85 KB of gzipped JS.
- If ffmpeg is installed, recorded WebM is transcoded to H.264 MP4 in the background for iOS playback and video files are verified with ffprobe.

## Tests

```bash
npm run typecheck
npm test             # API integration tests (auth, uploads, feed, remix rules, video, cleanup)
npm run test:e2e     # real-browser run: sign up → post → like/comment → ad, game, video (needs `npm run build`)
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
- **Moderation** — reports are stored (`reports` table) but there is no review tool or automated screening of uploads yet.
- **Accounts** — email/password only; no email verification, password reset or social sign-in yet.
- **Rate limits** are in-memory per process.
- **Feed ranking** is a simple engagement/recency score over the most recent 5,000 posts.
- **Legal** — terms, privacy policy and a takedown process are needed for user-generated content (and are required by both app stores).

## Mobile apps

The web app is already installable from the browser. For store builds, the quickest route is wrapping this web build with Capacitor (camera, share sheet and push via plugins); the API already returns a session token for native clients to send as `Authorization: Bearer …`.
