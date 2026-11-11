import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import sharp from "sharp";
import { z } from "zod";
import type { AdCopy, AiSource, CaptionSuggestion, Storyboard } from "../shared/types.ts";
import { CAMERA_MOVES } from "../shared/types.ts";
import type { Config } from "./config.ts";

/** An image handed to the model: the 1080px WebP variant plus what we know locally. */
export interface AiImage {
  data: Buffer;
  color: string;
  width: number;
  height: number;
}

export interface AdBrief {
  brand: string;
  product: string;
  tone: string;
}

const CaptionSchema = z.object({
  caption: z.string(),
  hashtags: z.array(z.string()),
  alt: z.string(),
});

const AdSchema = z.object({
  headline: z.string(),
  subhead: z.string(),
  cta: z.string(),
  layout: z.enum(["bottom", "center", "top"]),
  accent: z.string(),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

const StoryboardSchema = z.object({
  title: z.string(),
  shots: z.array(
    z.object({
      mediaIndex: z.number().int(),
      move: z.enum(["zoom-in", "zoom-out", "pan-left", "pan-right", "pan-up", "pan-down"]),
      seconds: z.number(),
      text: z.string(),
    }),
  ),
  caption: z.string(),
  hashtags: z.array(z.string()),
});

const SYSTEM = `You write for pics.me, a picture-sharing app with a vertical, swipeable feed.
You look at people's photos and produce short social copy for them.
Write the way a person with good taste posts: specific to what is actually in the picture, plain words, no clichés, no emoji unless the tone asks for it.
Never guess at who a person in a photo is, and don't describe sensitive traits. Hashtags are lowercase, without the # sign, with no spaces.`;

export class AI {
  private client: Anthropic | null;
  private cfg: Config;

  constructor(cfg: Config) {
    this.cfg = cfg;
    // A self-hosted endpoint, when configured, takes precedence over Claude.
    this.client = cfg.aiEnabled && !cfg.aiBaseUrl ? new Anthropic({ maxRetries: 1, timeout: 60_000 }) : null;
  }

  get provider(): AiSource {
    return this.cfg.aiBaseUrl ? "model" : this.client ? "claude" : "local";
  }

  /** Whether the configured model is sent the actual picture. */
  get seesPictures() {
    return this.provider === "claude" || (this.provider === "model" && this.cfg.aiVision);
  }

  /**
   * One structured call to an OpenAI-compatible chat endpoint (vLLM, llama.cpp, …).
   * Vision models get the pictures; text-only models get what we know about them
   * and are told not to invent what they can't see.
   */
  private async askOpen<S extends z.ZodType>(schema: S, images: AiImage[], prompt: string): Promise<z.infer<S> | null> {
    const { aiBaseUrl, aiApiKey, aiModel, aiVision, aiExtraBody } = this.cfg;
    try {
      let content: unknown;
      if (aiVision) {
        // JPEG at a modest size: every server decodes it, and it keeps small context windows free for the answer.
        const jpegs = await Promise.all(images.map((img) => sharp(img.data).resize(896, 896, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 80 }).toBuffer()));
        content = [
          ...jpegs.map((j) => ({ type: "image_url", image_url: { url: `data:image/jpeg;base64,${j.toString("base64")}` } })),
          { type: "text", text: prompt },
        ];
      } else {
        const facts = images.map((img, i) => {
          const shape = img.height > img.width * 1.15 ? "portrait" : img.width > img.height * 1.15 ? "landscape" : "square";
          return `- Photo ${i}: ${shape}, ${img.width}×${img.height}, dominant colour ${img.color} (${mood(img.color).word})`;
        }).join("\n");
        content = `You cannot see the photo${images.length === 1 ? "" : "s"}. All you know:\n${facts}\n\nWork from those facts and any notes given below. Do not invent specific objects, places or people; keep the copy true of any picture with that look.\n\n${prompt}`;
      }
      const res = await fetch(`${aiBaseUrl}/chat/completions`, {
        method: "POST",
        signal: AbortSignal.timeout(90_000),
        headers: { "Content-Type": "application/json", ...(aiApiKey ? { Authorization: `Bearer ${aiApiKey}` } : {}) },
        body: JSON.stringify({
          ...(aiModel ? { model: aiModel } : {}),
          messages: [
            { role: "system", content: `${SYSTEM}\nReply with a single JSON object and nothing else.` },
            { role: "user", content },
          ],
          max_tokens: 1500,
          temperature: 0.7,
          response_format: { type: "json_schema", json_schema: { name: "result", strict: true, schema: z.toJSONSchema(schema) } },
          ...aiExtraBody,
        }),
      });
      if (!res.ok) {
        console.error(`[ai] ${aiBaseUrl} answered ${res.status}: ${(await res.text()).slice(0, 300)}`);
        return null;
      }
      const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
      // Reasoning models may wrap the answer in <think>…</think> or prose; keep only the JSON object.
      const text = (data.choices?.[0]?.message?.content ?? "").replace(/<think>[\s\S]*?<\/think>/g, "");
      const start = text.indexOf("{"), end = text.lastIndexOf("}");
      if (start < 0 || end <= start) {
        console.error("[ai] model reply contained no JSON object");
        return null;
      }
      const parsed = schema.safeParse(JSON.parse(text.slice(start, end + 1)));
      if (!parsed.success) console.error("[ai] model reply didn't match the expected shape:", parsed.error.issues[0]?.message);
      return parsed.success ? parsed.data : null;
    } catch (err) {
      console.error(`[ai] request to ${aiBaseUrl} failed:`, err instanceof Error ? err.message : err);
      return null;
    }
  }

  /** One structured vision call. Returns null when the model declines or the call fails. */
  private async ask<S extends z.ZodType>(schema: S, images: AiImage[], prompt: string): Promise<z.infer<S> | null> {
    if (this.cfg.aiBaseUrl) return this.askOpen(schema, images, prompt);
    if (!this.client) return null;
    try {
      const res = await this.client.beta.messages.create({
        model: this.cfg.aiModel,
        max_tokens: 4000,
        system: SYSTEM,
        // Short creative copy on an interactive path: keep thinking light.
        output_config: { effort: "low", format: zodOutputFormat(schema) },
        // If a safety classifier declines, let the API retry on its default fallback model.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        messages: [
          {
            role: "user",
            content: [
              ...images.map((img) => ({
                type: "image" as const,
                source: { type: "base64" as const, media_type: "image/webp" as const, data: img.data.toString("base64") },
              })),
              { type: "text" as const, text: prompt },
            ],
          },
        ],
      });
      if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
      const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
      const parsed = schema.safeParse(JSON.parse(text));
      return parsed.success ? parsed.data : null;
    } catch (err) {
      if (err instanceof Anthropic.AuthenticationError) console.error("[ai] invalid Anthropic credentials — using templates");
      else if (err instanceof Anthropic.RateLimitError) console.error("[ai] rate limited — using templates");
      else if (err instanceof Anthropic.APIError) console.error(`[ai] API error ${err.status}: ${err.message}`);
      else console.error("[ai] unexpected response", err);
      return null;
    }
  }

  async caption(image: AiImage, hint: string): Promise<CaptionSuggestion> {
    const out = await this.ask(
      CaptionSchema,
      [image],
      `Write a caption for this photo (under 140 characters), 3 to 6 hashtags, and one sentence of alt text describing the picture for someone who can't see it.` +
        (hint ? `\nThe poster's own notes: "${hint}"` : ""),
    );
    if (out) {
      return { caption: clip(out.caption, 300), hashtags: cleanTags(out.hashtags), alt: clip(out.alt, 300), source: this.provider };
    }
    return localCaption(image, hint);
  }

  async ad(image: AiImage, brief: AdBrief): Promise<AdCopy> {
    const out = await this.ask(
      AdSchema,
      [image],
      `Turn this photo into a social ad.
Brand: ${brief.brand || "(not given — keep it brand-neutral)"}
What's being promoted: ${brief.product || "(not given — infer from the photo)"}
Tone: ${brief.tone || "confident, warm"}

Return:
- headline: at most 6 words, set large over the photo
- subhead: one supporting line, at most 14 words
- cta: button text, at most 3 words
- layout: where the text block sits so it does not cover the subject — "bottom", "center" or "top"
- accent: a hex colour for the button that suits the photo and stays readable with dark text or white text
- caption: the post caption that goes with the ad, under 160 characters
- hashtags: 3 to 5
Only claim what the brief or the picture supports — no invented prices, discounts or guarantees.`,
    );
    if (out) {
      return {
        headline: clip(out.headline, 60),
        subhead: clip(out.subhead, 120),
        cta: clip(out.cta, 24),
        layout: out.layout,
        accent: /^#[0-9a-f]{6}$/i.test(out.accent) ? out.accent : vivid(image.color),
        caption: clip(out.caption, 300),
        hashtags: cleanTags(out.hashtags),
        source: this.provider,
      };
    }
    return localAd(image, brief);
  }

  async storyboard(images: AiImage[], vibe: string): Promise<Storyboard> {
    const n = images.length;
    const out = await this.ask(
      StoryboardSchema,
      images,
      `These ${n} photo${n === 1 ? "" : "s"} (index 0 to ${n - 1}, in the order shown) will be cut into a short vertical video with slow camera moves.
Vibe: ${vibe || "let the pictures decide"}

Plan the edit:
- shots: ${n === 1 ? "3 or 4 shots of the same photo, each a different move, so it feels like one continuous look around the picture" : "use every photo at least once, ordered so the sequence builds"}; total 6 to 15 seconds, each shot 1.5 to 4 seconds
- move: pick the camera move that follows the composition (pan toward the subject, zoom in on a detail, zoom out to reveal)
- text: an on-screen line for the shot, at most 7 words; use "" for shots that should breathe. The lines should read as one thought across the video.
- title: 2 to 4 words
- caption and 3 to 5 hashtags for the post`,
    );
    if (out) {
      const shots = out.shots
        .filter((s) => s.mediaIndex >= 0 && s.mediaIndex < n)
        .slice(0, 12)
        .map((s) => ({ ...s, seconds: Math.min(Math.max(s.seconds, 1.2), 5), text: clip(s.text, 80) }));
      if (shots.length) {
        return { title: clip(out.title, 60), shots, caption: clip(out.caption, 300), hashtags: cleanTags(out.hashtags), source: this.provider };
      }
    }
    return localStoryboard(n, vibe);
  }
}

// ---------------------------------------------------------------------------
// Template fallbacks. These run when no API key is configured (or a call
// fails) so every Studio tool still produces something usable. They only know
// the picture's colour and shape, not its content.

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s).trim();

export function cleanTags(tags: string[]): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const tag = t.toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "").slice(0, 32);
    if (tag) out.add(tag);
  }
  return [...out].slice(0, 8);
}

function hsl(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, d = max - min;
  let h = 0;
  if (d) h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: (h * 60 + 360) % 360, s: d ? d / (1 - Math.abs(2 * l - 1)) : 0, l };
}

function toHex(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(v * 255).toString(16).padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/** A saturated button colour in the photo's own hue family. */
export function vivid(color: string) {
  const { h, s } = hsl(color);
  return s < 0.12 ? "#ffd166" : toHex(h, 0.85, 0.6);
}

function mood(color: string) {
  const { h, s, l } = hsl(color);
  if (l < 0.22) return { word: "after dark", tags: ["nightshots", "lowlight"] };
  if (s < 0.12) return { word: l > 0.7 ? "soft light" : "quiet tones", tags: ["minimal", "monochrome"] };
  if (h < 45 || h >= 330) return { word: "warm light", tags: ["goldenhour", "warmtones"] };
  if (h < 170) return { word: "green days", tags: ["outdoors", "nature"] };
  if (h < 270) return { word: "blue hour", tags: ["bluehour", "skies"] };
  return { word: "neon mood", tags: ["colorpop", "vibes"] };
}

const pick = <T>(arr: T[], seed: number) => arr[Math.abs(Math.floor(seed)) % arr.length]!;
const seedOf = (img: AiImage) => parseInt(img.color.slice(1), 16) + img.width * 7 + img.height * 13;

function localCaption(image: AiImage, hint: string): CaptionSuggestion {
  const m = mood(image.color);
  const seed = seedOf(image);
  const caption = hint.trim()
    ? clip(hint.trim(), 140)
    : pick([`${cap(m.word)}.`, `Kept this one. ${cap(m.word)}.`, `${cap(m.word)}, no filter needed.`, `Proof it happened — ${m.word}.`], seed);
  const shape = image.height > image.width * 1.15 ? "portrait" : image.width > image.height * 1.15 ? "landscape" : "square";
  return {
    caption,
    hashtags: cleanTags([...m.tags, "picsme", shape === "landscape" ? "wideangle" : "photooftheday"]),
    alt: `A ${shape} photo with ${m.word.replace("after dark", "dark, night-time").replace("days", "")} colours.`.replace(/\s+/g, " "),
    source: "local",
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function localAd(image: AiImage, brief: AdBrief): AdCopy {
  const seed = seedOf(image) + brief.product.length;
  const product = brief.product.trim();
  const brand = brief.brand.trim();
  const tone = brief.tone.toLowerCase();
  const playful = /fun|play|bold|loud|cheeky/.test(tone);
  const luxe = /lux|premium|elegant|minimal|calm/.test(tone);
  const subject = product || brand || "this";
  const headline = luxe
    ? pick([`${cap(subject)}, considered.`, `Quietly ${product ? "better" : "yours"}.`, `Less noise. More ${product || "you"}.`], seed)
    : playful
      ? pick([`Say yes to ${subject}.`, `${cap(subject)}? Obviously.`, `Go on. ${cap(subject)}.`], seed)
      : pick([`Meet ${subject}.`, `${cap(subject)}, made for today.`, `Your next ${product || "favourite"}.`], seed);
  const subhead = brand && product
    ? `${cap(product)} from ${brand} — see it for yourself.`
    : pick(["See what everyone's been saving.", "Made to be looked at twice.", "The picture says the rest."], seed + 1);
  return {
    headline: clip(headline, 60),
    subhead,
    cta: pick(luxe ? ["Discover", "Explore"] : playful ? ["Get yours", "I'm in"] : ["Shop now", "Learn more"], seed),
    layout: image.height >= image.width ? "bottom" : "center",
    accent: vivid(image.color),
    caption: clip(`${headline} ${brand ? `— ${brand}` : ""}`.trim(), 160),
    hashtags: cleanTags([brand, product.split(/\s+/)[0] ?? "", "ad", ...mood(image.color).tags.slice(0, 1)]),
    source: "local",
  };
}

function localStoryboard(n: number, vibe: string): Storyboard {
  const v = vibe.trim();
  const fast = /fast|hype|energy|party|punchy/i.test(v);
  const per = fast ? 1.6 : 2.6;
  const indices = n === 1 ? [0, 0, 0] : Array.from({ length: Math.min(n, 8) }, (_, i) => i);
  const lines = n === 1 ? ["", v ? cap(v) : "Look closer", ""] : indices.map((_, i) => (i === 0 ? (v ? cap(v) : "") : i === indices.length - 1 ? "pics.me" : ""));
  return {
    title: v ? clip(cap(v), 40) : "Moments",
    shots: indices.map((mediaIndex, i) => ({
      mediaIndex,
      move: CAMERA_MOVES[(i * 2 + (i % 2 ? 3 : 0)) % CAMERA_MOVES.length]!,
      seconds: per,
      text: lines[i] ?? "",
    })),
    caption: v ? `${cap(v)}.` : "A few seconds worth keeping.",
    hashtags: cleanTags(["picsme", "reel", fast ? "hype" : "slowmo"]),
    source: "local",
  };
}
