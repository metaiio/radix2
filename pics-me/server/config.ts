import path from "node:path";

const env = process.env;
const num = (v: string | undefined, d: number) => (v && Number.isFinite(Number(v)) ? Number(v) : d);

export interface Config {
  port: number;
  dataDir: string;
  publicUrl: string;
  cookieSecure: boolean;
  trustProxy: boolean;
  maxImageBytes: number;
  maxVideoBytes: number;
  aiModel: string;
  aiEnabled: boolean;
  production: boolean;
  /** Multiplier for rate limits (tests raise it). */
  rateScale: number;
  /** Usernames allowed to review reports. */
  admins: string[];
  /** Origins of the bundled Android/iOS apps, which call the API cross-origin with bearer tokens. */
  appOrigins: string[];
}

export function loadConfig(overrides: Partial<Config> = {}): Config {
  return {
    port: num(env.PORT, 3000),
    dataDir: path.resolve(env.DATA_DIR ?? "./data"),
    publicUrl: (env.PUBLIC_URL ?? "").replace(/\/$/, ""),
    cookieSecure: env.COOKIE_SECURE === "1",
    trustProxy: env.TRUST_PROXY === "1",
    maxImageBytes: num(env.MAX_IMAGE_MB, 25) * 1024 * 1024,
    maxVideoBytes: num(env.MAX_VIDEO_MB, 60) * 1024 * 1024,
    aiModel: env.AI_MODEL || "claude-opus-5-5",
    aiEnabled: Boolean(env.ANTHROPIC_API_KEY || env.ANTHROPIC_AUTH_TOKEN),
    production: env.NODE_ENV === "production",
    rateScale: num(env.RATE_SCALE, 1),
    admins: (env.ADMIN_USERS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean),
    appOrigins: (env.APP_ORIGINS ?? "capacitor://localhost,https://localhost").split(",").map((s) => s.trim()).filter(Boolean),
    ...overrides,
  };
}
