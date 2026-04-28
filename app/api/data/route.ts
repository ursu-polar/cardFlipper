import { parseAppDataFromJsonString } from "@/lib/storage";
import type { AppData } from "@/lib/types";
import { Redis } from "@upstash/redis";
import { type NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const TOKEN_HEADER = "x-card-flipper-token";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_BYTES = 2_000_000;

function redisOrNull(): Redis | null {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  try {
    return Redis.fromEnv();
  } catch {
    return null;
  }
}

function kvKey(token: string) {
  return `cardflip:appdata:${token}`;
}

function jsonResponse(body: object, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function GET(request: NextRequest) {
  const r = redisOrNull();
  if (!r) {
    return jsonResponse(
      { ok: false, error: "cloud-storage-unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const token = request.headers.get(TOKEN_HEADER) ?? "";
  if (!UUID_RE.test(token)) {
    return jsonResponse({ ok: false, error: "invalid-token" }, { status: 400 });
  }
  const raw = await r.get<string>(kvKey(token));
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
  const r = redisOrNull();
  if (!r) {
    return jsonResponse(
      { ok: false, error: "cloud-storage-unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  const token = request.headers.get(TOKEN_HEADER) ?? "";
  if (!UUID_RE.test(token)) {
    return jsonResponse({ ok: false, error: "invalid-token" }, { status: 400 });
  }
  const text = await request.text();
  if (text.length > MAX_BYTES) {
    return jsonResponse({ ok: false, error: "payload-too-large" }, { status: 413 });
  }
  const parsed: AppData = parseAppDataFromJsonString(text);
  if (typeof parsed !== "object" || parsed == null) {
    return jsonResponse({ ok: false, error: "invalid-body" }, { status: 400 });
  }
  await r.set(kvKey(token), text);
  return jsonResponse(
    { ok: true },
    { headers: { "cache-control": "no-store" } },
  );
}
