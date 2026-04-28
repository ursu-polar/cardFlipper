import type { NextRequest } from "next/server";
import { getRedisOrNull } from "@/lib/server/redis";
import { getSessionPayload, isSessionTokenForm, type SessionPayload } from "@/lib/server/users";

export function getSessionTokenFromRequest(request: Request): string {
  const a = request.headers.get("authorization");
  if (a?.startsWith("Bearer ")) {
    return a.slice(7).trim();
  }
  return request.headers.get("x-session-token")?.trim() ?? "";
}

export async function requireSession(request: NextRequest): Promise<
  { ok: true; r: NonNullable<ReturnType<typeof getRedisOrNull>>; session: SessionPayload; token: string } | { ok: false; status: number; error: string }
> {
  const r = getRedisOrNull();
  if (!r) {
    return { ok: false, status: 503, error: "server-storage-unavailable" };
  }
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
