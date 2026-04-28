export const SESSION_STORAGE_KEY = "card-flipper-session";

export type AuthUser = { id: string; username: string; isAdmin: boolean };

export function readStoredSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    return localStorage.getItem(SESSION_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function writeStoredSessionToken(token: string): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, token);
  } catch {
    /* ignore */
  }
}

export function clearStoredSessionToken(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export async function apiMe(
  token: string,
): Promise<{ ok: true; user: AuthUser } | { ok: false; reason: "unavailable" | "unauthorized" }> {
  if (!token) return { ok: false, reason: "unauthorized" };
  try {
    const res = await fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (res.status === 401) return { ok: false, reason: "unauthorized" };
    if (res.status === 503) return { ok: false, reason: "unavailable" };
    if (!res.ok) return { ok: false, reason: "unauthorized" };
    const j = (await res.json()) as { ok?: boolean; user?: AuthUser };
    if (!j?.ok || !j.user) return { ok: false, reason: "unauthorized" };
    return { ok: true, user: j.user };
  } catch {
    return { ok: false, reason: "unavailable" };
  }
}

export async function apiLogin(
  username: string,
  password: string,
): Promise<
  | { ok: true; sessionToken: string; user: AuthUser }
  | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    sessionToken?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: j.error ?? "Login failed", status: res.status };
  }
  if (!j.sessionToken || !j.user) {
    return { ok: false, error: "Invalid response", status: 500 };
  }
  return { ok: true, sessionToken: j.sessionToken, user: j.user };
}

export async function apiRegister(
  username: string,
  password: string,
): Promise<
  { ok: true; sessionToken: string; user: AuthUser } | { ok: false; error: string; status: number }
> {
  const res = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });
  const j = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    sessionToken?: string;
    user?: AuthUser;
    error?: string;
  };
  if (!res.ok) {
    return { ok: false, error: j.error ?? "Registration failed", status: res.status };
  }
  if (!j.sessionToken || !j.user) {
    return { ok: false, error: "Invalid response", status: 500 };
  }
  return { ok: true, sessionToken: j.sessionToken, user: j.user };
}

export async function apiLogout(token: string): Promise<void> {
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    /* ignore */
  }
}
