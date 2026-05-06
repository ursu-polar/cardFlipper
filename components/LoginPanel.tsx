"use client";

import { useAuth } from "@/components/AuthContext";
import { useEffect, useState } from "react";

type Mode = "login" | "register";

type MetaOk = { ok: true; kv: { kind: "upstash" | "memory"; source?: string } };
type Meta = MetaOk | { ok: false };

export function LoginPanel() {
  const { login, register, serverUnavailable } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [kvKind, setKvKind] = useState<"upstash" | "memory" | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/meta", { cache: "no-store" });
        const j = (await res.json().catch(() => null)) as Meta | null;
        const kind = j && j.ok === true ? (j as MetaOk).kv.kind : null;
        if (!cancelled) setKvKind(kind ?? null);
      } catch {
        if (!cancelled) setKvKind(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "login") {
        const r = await login(username, password);
        if (!r.ok) setError(r.error);
      } else {
        const r = await register(username, password);
        if (!r.ok) setError(r.error);
      }
    } finally {
      setPending(false);
    }
  }

  if (serverUnavailable) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4">
        <div className="ui-elevate p-6 text-center">
          <h1 className="text-lg font-semibold text-slate-100">Server unavailable</h1>
          <p className="mt-2 text-sm text-slate-400">Could not reach the app. Try again in a moment.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-4 py-10">
      <h1 className="mb-2 text-center text-2xl font-extrabold tracking-tight text-slate-100">
        Card Flipper
      </h1>
      <p className="mb-6 text-center text-sm text-slate-400">Sign in or create an account</p>
      {kvKind === "memory" && (
        <div className="mb-4 rounded-2xl border border-amber-600/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-100 ring-1 ring-inset ring-amber-500/10">
          <p className="font-semibold">Server storage is not configured.</p>
          <p className="mt-1 text-amber-100/90">
            New users and server-saved decks can disappear after a server restart. To fix, add Upstash
            Redis on Vercel and set <code className="rounded bg-slate-900/60 px-1">UPSTASH_REDIS_REST_URL</code>{" "}
            and <code className="rounded bg-slate-900/60 px-1">UPSTASH_REDIS_REST_TOKEN</code>, then redeploy.
          </p>
        </div>
      )}
      <div className="mb-4 flex rounded-full border border-slate-600/80 bg-slate-800/50 p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "login" ? "bg-slate-700 text-slate-100" : "text-slate-400"
          }`}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
        >
          Log in
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-sm font-medium transition ${
            mode === "register" ? "bg-slate-700 text-slate-100" : "text-slate-400"
          }`}
          onClick={() => {
            setMode("register");
            setError(null);
          }}
        >
          Create user
        </button>
      </div>
      <form
        onSubmit={onSubmit}
        className="ui-elevate space-y-4 p-5"
        autoComplete={mode === "register" ? "on" : "on"}
      >
        <div>
          <label className="text-xs text-slate-400" htmlFor="user">
            Username
          </label>
          <input
            id="user"
            className="ui-input mt-1 w-full"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            name="username"
            autoComplete="username"
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-400" htmlFor="pass">
            Password
          </label>
          <input
            id="pass"
            type="password"
            className="ui-input mt-1 w-full"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            name="password"
            autoComplete={mode === "register" ? "new-password" : "current-password"}
            required
          />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" className="ui-btn-primary w-full" disabled={pending}>
          {pending ? "…" : mode === "login" ? "Log in" : "Create account"}
        </button>
        {mode === "register" && (
          <p className="text-center text-xs text-slate-500">
            Use lowercase letters, numbers, and underscore only. Admin account:{" "}
            <span className="text-slate-400">admin</span> / <span className="text-slate-400">AdminUrsu</span>
          </p>
        )}
      </form>
    </div>
  );
}
