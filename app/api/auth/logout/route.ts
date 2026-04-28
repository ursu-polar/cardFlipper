import { getSessionTokenFromRequest } from "@/lib/server/authRequest";
import { getAppKv } from "@/lib/server/kv";
import { deleteSession, isSessionTokenForm } from "@/lib/server/users";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const r = getAppKv();
  const t = getSessionTokenFromRequest(request);
  if (t && isSessionTokenForm(t)) {
    await deleteSession(r, t);
  }
  return NextResponse.json({ ok: true }, { headers: { "cache-control": "no-store" } });
}
