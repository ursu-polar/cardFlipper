"use client";

import { useCallback, useEffect, useState } from "react";

type Row = { username: string; password: string };

export function AdminUsersDialog({
  sessionToken,
  onClose,
}: {
  sessionToken: string;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [newU, setNewU] = useState("");
  const [newP, setNewP] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch("/api/admin/users", {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    const j = (await res.json()) as { users?: Row[]; error?: string };
    if (!res.ok) {
      setError(j.error ?? "Failed to load users");
      setRows([]);
    } else {
      setRows(j.users ?? []);
    }
    setLoading(false);
  }, [sessionToken]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="ui-backdrop" role="dialog" onClick={onClose} onKeyDown={(e) => e.key === "Escape" && onClose()}>
      <div
        className="ui-elevate max-h-[90dvh] w-full max-w-lg overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-100">Users</h2>
        {loading && <p className="mt-2 text-sm text-slate-400">Loading…</p>}
        {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

        {!loading && !error && (
          <ul className="mt-3 divide-y divide-slate-700 rounded-xl border border-slate-600/50">
            {rows.map((r) => (
              <li key={r.username} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-mono text-sm text-slate-100">{r.username}</p>
                  <p className="text-xs text-slate-500">
                    password: <span className="text-slate-300">{r.password}</span>
                  </p>
                </div>
                <button
                  type="button"
                  className="shrink-0 text-sm text-red-400 hover:underline"
                  onClick={async () => {
                    if (!confirm(`Delete user "${r.username}"?`)) return;
                    const d = await fetch("/api/admin/users", {
                      method: "DELETE",
                      headers: {
                        Authorization: `Bearer ${sessionToken}`,
                        "content-type": "application/json",
                      },
                      body: JSON.stringify({ username: r.username }),
                    });
                    if (!d.ok) {
                      const b = (await d.json().catch(() => ({}))) as { error?: string };
                      setError(b.error ?? "Delete failed");
                      return;
                    }
                    void load();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 rounded-xl border border-slate-600/50 p-3">
          <h3 className="text-sm font-medium text-slate-200">Create user</h3>
          <div className="mt-2 space-y-2 sm:flex sm:flex-wrap sm:gap-2 sm:space-y-0">
            <input
              className="ui-input flex-1"
              placeholder="username"
              value={newU}
              onChange={(e) => setNewU(e.target.value)}
            />
            <input
              type="password"
              className="ui-input flex-1"
              placeholder="password"
              value={newP}
              onChange={(e) => setNewP(e.target.value)}
            />
            <button
              type="button"
              className="ui-btn-primary w-full sm:w-auto"
              onClick={async () => {
                setError(null);
                const res = await fetch("/api/admin/users", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${sessionToken}`,
                    "content-type": "application/json",
                  },
                  body: JSON.stringify({ username: newU.trim(), password: newP }),
                });
                const b = (await res.json().catch(() => ({}))) as { error?: string; ok?: boolean };
                if (!res.ok) {
                  setError(b.error ?? "Create failed");
                  return;
                }
                setNewU("");
                setNewP("");
                void load();
              }}
            >
              Create
            </button>
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <button type="button" className="ui-btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
