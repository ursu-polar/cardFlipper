import { randomUUID } from "node:crypto";
import { requireSession } from "@/lib/server/authRequest";
import {
  deleteUserByUsername,
  getUsersMap,
  listUsersWithPasswords,
  normalizeUsername,
  setUsersMap,
} from "@/lib/server/users";
import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function jsonResponse(body: object, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export async function GET(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, { status: auth.status });
  }
  if (!auth.session.isAdmin) {
    return jsonResponse({ error: "forbidden" }, { status: 403 });
  }
  const map = await getUsersMap(auth.r);
  return jsonResponse({ users: listUsersWithPasswords(map) });
}

export async function POST(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, { status: auth.status });
  }
  if (!auth.session.isAdmin) {
    return jsonResponse({ error: "forbidden" }, { status: 403 });
  }
  const r = auth.r;
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return jsonResponse({ error: "invalid-json" }, { status: 400 });
  }
  const un = typeof body.username === "string" ? body.username : "";
  const pw = typeof body.password === "string" ? body.password : "";
  if (!pw) {
    return jsonResponse({ error: "Password required" }, { status: 400 });
  }
  const n = normalizeUsername(un);
  if (n.length < 2) {
    return jsonResponse({ error: "Invalid username" }, { status: 400 });
  }
  const map = await getUsersMap(r);
  if (map[n]) {
    return jsonResponse({ error: "Username already exists" }, { status: 400 });
  }
  map[n] = { id: randomUUID(), password: pw };
  await setUsersMap(r, map);
  return jsonResponse({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const auth = await requireSession(request);
  if (!auth.ok) {
    return jsonResponse({ error: auth.error }, { status: auth.status });
  }
  if (!auth.session.isAdmin) {
    return jsonResponse({ error: "forbidden" }, { status: 403 });
  }
  const r = auth.r;
  let body: { username?: string };
  try {
    body = (await request.json()) as { username?: string };
  } catch {
    return jsonResponse({ error: "invalid-json" }, { status: 400 });
  }
  const target = typeof body.username === "string" ? body.username : "";
  const res = await deleteUserByUsername(r, target, auth.session.username);
  if (!res.ok) {
    return jsonResponse({ error: res.error }, { status: 400 });
  }
  return jsonResponse({ ok: true });
}
