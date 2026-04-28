import { getRedisOrNull } from "@/lib/server/redis";
import {
  createSessionForUser,
  ensureDefaultAdminUser,
  normalizeUsername,
  verifyPassword,
} from "@/lib/server/users";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const r = getRedisOrNull();
  if (!r) {
    return NextResponse.json(
      { ok: false, error: "server-storage-unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  await ensureDefaultAdminUser(r);
  const user = await verifyPassword(r, username, password);
  if (!user) {
    return NextResponse.json({ ok: false, error: "Invalid username or password." }, { status: 401 });
  }
  const n = normalizeUsername(username);
  const sessionToken = await createSessionForUser(r, n, user);
  return NextResponse.json(
    {
      ok: true,
      sessionToken,
      user: { id: user.id, username: n, isAdmin: n === "admin" },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
