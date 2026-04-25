import { NextResponse } from "next/server";
import { del, kvAvailable } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENTS_KEY = "events:all";

export async function POST() {
  if (!kvAvailable()) {
    return NextResponse.json({ error: "kv_unavailable" }, { status: 503 });
  }
  const removed = await del(EVENTS_KEY);
  return NextResponse.json({ ok: true, removed });
}
