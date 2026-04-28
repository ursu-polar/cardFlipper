import { getAppKv } from "@/lib/server/kv";
import { createSessionForUser, registerUser } from "@/lib/server/users";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const r = getAppKv();
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return NextResponse.json({ ok: false, error: "invalid-json" }, { status: 400 });
  }
  const username = typeof body.username === "string" ? body.username : "";
  const password = typeof body.password === "string" ? body.password : "";
  const res = await registerUser(r, username, password);
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: 400 });
  }
  const sessionToken = await createSessionForUser(r, res.usernameNorm, res.user);
  return NextResponse.json(
    {
      ok: true,
      sessionToken,
      user: { id: res.user.id, username: res.usernameNorm, isAdmin: false },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
