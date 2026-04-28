import { requireSession } from "@/lib/server/authRequest";
import { parseAppDataFromJsonString } from "@/lib/storage";
import type { AppData } from "@/lib/types";
import { appDataKeyForUserId } from "@/lib/server/users";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_BYTES = 2_000_000;

function jsonResponse(body: object, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) {
    return jsonResponse(
      { ok: false, error: auth.error },
      { status: auth.status, headers: { "cache-control": "no-store" } },
    );
  }
  const key = appDataKeyForUserId(auth.session.userId);
  const raw = await auth.r.get<string>(key);
  if (raw == null) {
    return jsonResponse(
      { ok: true, data: null },
      { headers: { "cache-control": "no-store" } },
    );
  }
  const s = typeof raw === "string" ? raw : JSON.stringify(raw);
  return jsonResponse(
    { ok: true, data: parseAppDataFromJsonString(s) },
    { headers: { "cache-control": "no-store" } },
  );
}

export async function PUT(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) {
    return jsonResponse(
      { ok: false, error: auth.error },
      { status: auth.status, headers: { "cache-control": "no-store" } },
    );
  }
  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return jsonResponse({ ok: false, error: "payload-too-large" }, { status: 413 });
  }
  const parsed: AppData = parseAppDataFromJsonString(text);
  if (typeof parsed !== "object" || parsed == null) {
    return jsonResponse({ ok: false, error: "invalid-body" }, { status: 400 });
  }
  const key = appDataKeyForUserId(auth.session.userId);
  await auth.r.set(key, text);
  return jsonResponse({ ok: true }, { headers: { "cache-control": "no-store" } });
}
