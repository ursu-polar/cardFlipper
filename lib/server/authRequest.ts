import type { NextRequest } from "next/server";
import { getAppKv, type AppKv } from "@/lib/server/kv";
import { getSessionPayload, isSessionTokenForm, type SessionPayload } from "@/lib/server/users";

export function getSessionTokenFromRequest(request: Request): string {
  const a = request.headers.get("authorization");
  if (a?.startsWith("Bearer ")) {
    return a.slice(7).trim();
  }
  return request.headers.get("x-session-token")?.trim() ?? "";
}

export async function requireSession(request: NextRequest): Promise<
  { ok: true; r: AppKv; session: SessionPayload; token: string } | { ok: false; status: number; error: string }
> {
  const r = getAppKv();
  const token = getSessionTokenFromRequest(request);
  if (!isSessionTokenForm(token)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  const session = await getSessionPayload(r, token);
  if (!session) {
    return { ok: false, status: 401, error: "unauthorized" };
  }
  return { ok: true, r, session, token };
}
