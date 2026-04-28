"use client";

import { useAuth } from "@/components/AuthContext";
import { DecksProvider } from "@/components/DecksContext";
import { LoginPanel } from "@/components/LoginPanel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, sessionToken, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-slate-400">Loading…</div>
    );
  }

  if (!user || !sessionToken) {
    return <LoginPanel />;
  }

  return (
    <DecksProvider key={user.id} userId={user.id} sessionToken={sessionToken}>
      {children}
    </DecksProvider>
  );
}
