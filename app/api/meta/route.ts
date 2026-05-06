import { getKvRuntimeInfo } from "@/lib/server/kv";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const kv = getKvRuntimeInfo();
  return NextResponse.json(
    {
      ok: true,
      kv,
    },
    { headers: { "cache-control": "no-store" } },
  );
}

