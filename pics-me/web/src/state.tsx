import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useSyncExternalStore, type AnchorHTMLAttributes, type ReactNode } from "react";
import { DEFAULT_SETTINGS, type Settings } from "../../shared/types.ts";
import { api, ApiError, type Me } from "./api.ts";

// ---- router (history API, no dependency) -----------------------------------

const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => {
  listeners.add(fn);
  window.addEventListener("popstate", fn);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("popstate", fn);
  };
};

/** How many in-app pages sit behind the current one (so "back" never leaves the app). */
let depth = 0;
window.addEventListener("popstate", () => (depth = Math.max(depth - 1, 0)));

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  if (to === location.pathname + location.search) return;
  if (opts.replace) history.replaceState(null, "", to);
  else {
    history.pushState(null, "", to);
    depth++;
  }
  listeners.forEach((fn) => fn());
}

export function goBack(fallback = "/") {
  if (depth > 0) history.back();
  else navigate(fallback, { replace: true });
}

export function useLocation() {
  const href = useSyncExternalStore(subscribe, () => location.pathname + location.search);
  return useMemo(() => {
    const url = new URL(href, location.origin);
    return { path: url.pathname, query: url.searchParams, parts: url.pathname.split("/").filter(Boolean).map(decodeURIComponent) };
  }, [href]);
}

export function Link({ to, onClick, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={to}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(to);
      }}
      {...rest}
    />
  );
}

// ---- stream freshness -------------------------------------------------------

let feedVersion = 0;
const feedListeners = new Set<() => void>();

/** Call after creating or deleting a post so the home stream reloads next time it shows. */
export function refreshFeeds() {
  feedVersion++;
  feedListeners.forEach((fn) => fn());
}

export function useFeedVersion() {
  return useSyncExternalStore(
    (fn) => (feedListeners.add(fn), () => void feedListeners.delete(fn)),
    () => feedVersion,
  );
}

// ---- session + toasts ------------------------------------------------------

interface Session {
  user: Me | null;
  ready: boolean;
  ai: "claude" | "model" | "local";
  setUser: (u: Me | null) => void;
  /** Pace settings. Stored on the account when signed in, on this device otherwise. */
  settings: Settings;
  updateSettings: (change: Partial<Settings>) => void;
  /** Re-reads the account (unread count etc.). */
  refreshMe: () => void;
  /** Returns true when signed in; otherwise sends the visitor to sign-in and returns false. */
  requireAuth: () => boolean;
  toast: (msg: string) => void;
}

const Ctx = createContext<Session | null>(null);

export function useSession() {
  const s = useContext(Ctx);
  if (!s) throw new Error("SessionProvider missing");
  return s;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [ai, setAi] = useState<"claude" | "model" | "local">("local");
  const [local, setLocal] = useState<Settings>(() => {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem("pm_settings") ?? "{}") };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [toastMsg, setToastMsg] = useState<{ id: number; msg: string } | null>(null);
  const timer = useRef<number>(0);

  useEffect(() => {
    api.me()
      .then((r) => {
        setUser(r.user);
        setAi(r.ai);
      })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const toast = useCallback((msg: string) => {
    window.clearTimeout(timer.current);
    setToastMsg({ id: Date.now(), msg });
    timer.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const requireAuth = useCallback(() => {
    if (user) return true;
    navigate(`/login?next=${encodeURIComponent(location.pathname + location.search)}`);
    return false;
  }, [user]);

  const settings = user?.settings ?? local;
  const updateSettings = useCallback((change: Partial<Settings>) => {
    if (!user) {
      setLocal((prev) => {
        const next = { ...prev, ...change };
        try {
          localStorage.setItem("pm_settings", JSON.stringify(next));
        } catch { /* private mode */ }
        return next;
      });
      return;
    }
    setUser({ ...user, settings: { ...user.settings, ...change } });
    api.updateMe({ settings: change }).catch((err) => toast(err instanceof ApiError ? err.message : "Couldn't save that setting."));
  }, [user, toast]);

  const refreshMe = useCallback(() => {
    api.me().then((r) => setUser(r.user)).catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ user, ready, ai, setUser, settings, updateSettings, refreshMe, requireAuth, toast }),
    [user, ready, ai, settings, updateSettings, refreshMe, requireAuth, toast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toastMsg && (
        <div className="toast" role="status" key={toastMsg.id}>
          {toastMsg.msg}
        </div>
      )}
    </Ctx.Provider>
  );
}
