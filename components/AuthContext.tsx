"use client";

import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegister,
  clearStoredSessionToken,
  readStoredSessionToken,
  writeStoredSessionToken,
  type AuthUser,
} from "@/lib/authClient";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthCtx = {
  user: AuthUser | null;
  sessionToken: string;
  loading: boolean;
  serverUnavailable: boolean;
  login: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  register: (username: string, password: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sessionToken, setSessionToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [serverUnavailable, setServerUnavailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = readStoredSessionToken();
      if (!t) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }
      const r = await apiMe(t);
      if (cancelled) return;
      if (r.ok) {
        setUser(r.user);
        setSessionToken(t);
        setServerUnavailable(false);
      } else {
        if (r.reason === "unavailable") {
          setServerUnavailable(true);
        } else {
          setServerUnavailable(false);
        }
        clearStoredSessionToken();
        setUser(null);
        setSessionToken("");
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await apiLogin(username, password);
    if (!r.ok) {
      if (r.status === 503) {
        setServerUnavailable(true);
      }
      return { ok: false as const, error: r.error };
    }
    writeStoredSessionToken(r.sessionToken);
    setSessionToken(r.sessionToken);
    setUser(r.user);
    setServerUnavailable(false);
    return { ok: true as const };
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const r = await apiRegister(username, password);
    if (!r.ok) {
      if (r.status === 503) {
        setServerUnavailable(true);
      }
      return { ok: false as const, error: r.error };
    }
    writeStoredSessionToken(r.sessionToken);
    setSessionToken(r.sessionToken);
    setUser(r.user);
    setServerUnavailable(false);
    return { ok: true as const };
  }, []);

  const logout = useCallback(async () => {
    const t = readStoredSessionToken();
    if (t) await apiLogout(t);
    clearStoredSessionToken();
    setUser(null);
    setSessionToken("");
  }, []);

  const value = useMemo(
    () => ({
      user,
      sessionToken,
      loading,
      serverUnavailable,
      login,
      register,
      logout,
    }),
    [user, sessionToken, loading, serverUnavailable, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const c = useContext(AuthContext);
  if (!c) throw new Error("useAuth must be used under AuthProvider");
  return c;
}
