import crypto from "node:crypto";
import { promisify } from "node:util";
import type { DB } from "./db.ts";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const SESSION_DAYS = 60;
export const COOKIE = "pm_session";

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, 64);
  return `s1$${salt.toString("base64url")}$${key.toString("base64url")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [v, salt, key] = stored.split("$");
  if (v !== "s1" || !salt || !key) return false;
  const expected = Buffer.from(key, "base64url");
  const actual = await scrypt(password, Buffer.from(salt, "base64url"), expected.length);
  return crypto.timingSafeEqual(expected, actual);
}

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

/** Creates a session and returns the opaque token (only its hash is stored). */
export function createSession(db: DB, userId: number): string {
  const token = crypto.randomBytes(32).toString("base64url");
  const now = Date.now();
  db.run(
    "INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
    sha(token), userId, now, now + SESSION_DAYS * 864e5,
  );
  return token;
}

export function sessionUser(db: DB, token: string | undefined): number | null {
  if (!token) return null;
  const row = db.get<{ user_id: number; expires_at: number }>(
    "SELECT user_id, expires_at FROM sessions WHERE token_hash = ?", sha(token),
  );
  if (!row || row.expires_at < Date.now()) return null;
  return row.user_id;
}

export function destroySession(db: DB, token: string | undefined) {
  if (token) db.run("DELETE FROM sessions WHERE token_hash = ?", sha(token));
}

export function readToken(headers: { cookie?: string; authorization?: string }): string | undefined {
  const auth = headers.authorization;
  if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
  for (const part of (headers.cookie ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === COOKIE) return part.slice(i + 1).trim();
  }
  return undefined;
}

export function sessionCookie(token: string | null, secure: boolean): string {
  const base = `${COOKIE}=${token ?? ""}; Path=/; HttpOnly; SameSite=Lax${secure ? "; Secure" : ""}`;
  return token ? `${base}; Max-Age=${SESSION_DAYS * 86400}` : `${base}; Max-Age=0`;
}

export const newUid = (bytes = 8) => crypto.randomBytes(bytes).toString("base64url");
