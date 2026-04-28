import { randomBytes, randomUUID } from "node:crypto";
import type { AppKv } from "@/lib/server/kv";

const USERS_KEY = "cardflip:users";
const SESS_PREFIX = "cardflip:sess:";
const APP_PREFIX = "cardflip:appdata:";

const ADMIN_USERNAME = "admin";
const ADMIN_PASSWORD = "AdminUrsu";

const SESSION_TTL_SEC = 60 * 60 * 24 * 60; // 60 days

export type UserRow = { id: string; password: string };
export type UsersMap = Record<string, UserRow>;

export function normalizeUsername(u: string): string {
  return u.trim().toLowerCase();
}

function readUsersMap(raw: unknown): UsersMap {
  if (raw == null) return {};
  if (typeof raw === "string") {
    try {
      const p = JSON.parse(raw) as unknown;
      return typeof p === "object" && p != null && !Array.isArray(p) ? (p as UsersMap) : {};
    } catch {
      return {};
    }
  }
  if (typeof raw === "object" && !Array.isArray(raw)) return raw as UsersMap;
  return {};
}

export async function getUsersMap(r: AppKv): Promise<UsersMap> {
  const raw = await r.get(USERS_KEY);
  return readUsersMap(raw);
}

export async function setUsersMap(r: AppKv, map: UsersMap): Promise<void> {
  await r.set(USERS_KEY, JSON.stringify(map));
}

/** Admin account exists with the demo password. */
export async function ensureDefaultAdminUser(r: AppKv): Promise<void> {
  const map = await getUsersMap(r);
  if (!map[ADMIN_USERNAME]) {
    map[ADMIN_USERNAME] = { id: randomUUID(), password: ADMIN_PASSWORD };
  } else {
    map[ADMIN_USERNAME]!.password = ADMIN_PASSWORD;
  }
  await setUsersMap(r, map);
}

export function isAdminUsername(username: string): boolean {
  return normalizeUsername(username) === ADMIN_USERNAME;
}

export type SessionPayload = { userId: string; username: string; isAdmin: boolean };

export function sessionKey(token: string): string {
  return `${SESS_PREFIX}${token}`;
}

export function appDataKeyForUserId(userId: string): string {
  return `${APP_PREFIX}${userId}`;
}

const TOKEN_RE = /^[a-f0-9]{64}$/i;

export function isSessionTokenForm(s: string): boolean {
  return TOKEN_RE.test(s);
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

export async function createSessionForUser(
  r: AppKv,
  usernameNorm: string,
  user: UserRow,
): Promise<string> {
  const token = newSessionToken();
  const payload: SessionPayload = {
    userId: user.id,
    username: usernameNorm,
    isAdmin: usernameNorm === ADMIN_USERNAME,
  };
  await r.set(sessionKey(token), JSON.stringify(payload), { ex: SESSION_TTL_SEC });
  return token;
}

export async function verifyPassword(
  r: AppKv,
  username: string,
  password: string,
): Promise<UserRow | null> {
  await ensureDefaultAdminUser(r);
  const map = await getUsersMap(r);
  const n = normalizeUsername(username);
  const u = map[n];
  if (!u || u.password !== password) return null;
  return u;
}

export async function registerUser(
  r: AppKv,
  username: string,
  password: string,
): Promise<{ ok: true; user: UserRow; usernameNorm: string } | { ok: false; error: string }> {
  await ensureDefaultAdminUser(r);
  const n = normalizeUsername(username);
  if (n.length < 2 || n.length > 48) {
    return { ok: false, error: "Username must be 2–48 characters." };
  }
  if (!/^[a-z0-9_]+$/.test(n)) {
    return { ok: false, error: "Use lowercase letters, numbers, and underscore only." };
  }
  if (password.length < 1) {
    return { ok: false, error: "Password is required." };
  }
  const map = await getUsersMap(r);
  if (map[n]) {
    return { ok: false, error: "That username is already taken." };
  }
  const user: UserRow = { id: randomUUID(), password };
  map[n] = user;
  await setUsersMap(r, map);
  return { ok: true, user, usernameNorm: n };
}

export async function deleteUserByUsername(
  r: AppKv,
  targetUsername: string,
  requesterNorm: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const n = normalizeUsername(targetUsername);
  if (n === requesterNorm) {
    return { ok: false, error: "You cannot delete your own account here." };
  }
  if (n === ADMIN_USERNAME) {
    return { ok: false, error: "The admin user cannot be deleted." };
  }
  const map = await getUsersMap(r);
  if (!map[n]) {
    return { ok: false, error: "User not found." };
  }
  const userId = map[n]!.id;
  delete map[n];
  await setUsersMap(r, map);
  await r.del(appDataKeyForUserId(userId));
  return { ok: true };
}

export async function getSessionPayload(
  r: AppKv,
  token: string,
): Promise<SessionPayload | null> {
  if (!isSessionTokenForm(token)) return null;
  const raw = await r.get(sessionKey(token));
  if (raw == null) return null;
  let p: unknown;
  try {
    p = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
  const o = p as SessionPayload;
  if (typeof o.userId !== "string" || typeof o.username !== "string") return null;
  const map = await getUsersMap(r);
  const n = normalizeUsername(o.username);
  const u = map[n];
  if (!u || u.id !== o.userId) return null;
  return {
    userId: o.userId,
    username: o.username,
    isAdmin: n === ADMIN_USERNAME,
  };
}

export async function deleteSession(r: AppKv, token: string): Promise<void> {
  if (isSessionTokenForm(token)) await r.del(sessionKey(token));
}

export function listUsersWithPasswords(map: UsersMap): { username: string; password: string }[] {
  return Object.entries(map)
    .map(([username, row]) => ({
      username,
      password: row?.password ?? "",
    }))
    .sort((a, b) => a.username.localeCompare(b.username));
}