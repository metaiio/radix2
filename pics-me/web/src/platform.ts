// Where the app is running. On the web, the page and the API share an origin
// and a session cookie. In the Android/iOS apps the pages are bundled inside
// the app and talk to the API at VITE_API_BASE with a bearer token.

export const API_BASE = ((import.meta.env.VITE_API_BASE as string | undefined) ?? "").replace(/\/$/, "");
export const BUNDLED = API_BASE !== "";
/** Public address used in links people share. */
export const SITE = API_BASE || location.origin;

const KEY = "pm_token";
export const token = {
  get: (): string | null => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  },
  set: (value: string | null) => {
    try {
      if (value) localStorage.setItem(KEY, value);
      else localStorage.removeItem(KEY);
    } catch { /* storage unavailable */ }
  },
};

interface NativeShare {
  share(opts: { title?: string; text?: string; url?: string; dialogTitle?: string }): Promise<unknown>;
}
const nativeShare = () => (globalThis as { Capacitor?: { isNativePlatform?: () => boolean; Plugins?: { Share?: NativeShare } } }).Capacitor;

/** Opens the system share sheet where there is one; otherwise copies to the clipboard. */
export async function share(opts: { title?: string; text?: string; url: string }): Promise<"shared" | "copied" | "none"> {
  try {
    const cap = nativeShare();
    if (cap?.isNativePlatform?.() && cap.Plugins?.Share) {
      await cap.Plugins.Share.share(opts);
      return "shared";
    }
    if (navigator.share) {
      await navigator.share(opts);
      return "shared";
    }
    await navigator.clipboard.writeText([opts.text, opts.url].filter(Boolean).join(" "));
    return "copied";
  } catch {
    return "none"; // dismissed, or nothing available
  }
}

/** Rewrites server-relative media paths in an API response to absolute ones. */
export function absolutize<T>(value: T): T {
  if (!BUNDLED) return value;
  const walk = (v: unknown): unknown => {
    if (typeof v === "string") return v.startsWith("/media/") ? API_BASE + v : v;
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(v)) out[k] = walk(x);
      return out;
    }
    return v;
  };
  return walk(value) as T;
}
