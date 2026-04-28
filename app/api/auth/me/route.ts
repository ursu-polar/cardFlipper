import { requireSession } from "@/lib/server/authRequest";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) {
    return NextResponse.json(
      { ok: false, error: auth.error },
      { status: auth.status, headers: { "cache-control": "no-store" } },
    );
  }
  return NextResponse.json(
    {
      ok: true,
      user: {
        id: auth.session.userId,
        username: auth.session.username,
        isAdmin: auth.session.isAdmin,
      },
    },
    { headers: { "cache-control": "no-store" } },
  );
}
