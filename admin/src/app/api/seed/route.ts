import { NextResponse } from "next/server";
import { del, kvAvailable, lpush, ltrim } from "@/lib/kv";
import { generateSeedEvents } from "@/lib/seed";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENTS_KEY = "events:all";
const MAX_EVENTS = 5000;
const PUSH_CHUNK = 200;

export async function POST() {
  if (!kvAvailable()) {
    return NextResponse.json({ error: "kv_unavailable" }, { status: 503 });
  }

  // Idempotent: clear existing events first so re-seeding doesn't double up.
  await del(EVENTS_KEY);

  const events = generateSeedEvents();

  // LPUSH oldest first so newest ends up at index 0.
  for (let i = 0; i < events.length; i += PUSH_CHUNK) {
    const chunk = events
      .slice(i, i + PUSH_CHUNK)
      .map((e) => JSON.stringify(e));
    if (chunk.length > 0) await lpush(EVENTS_KEY, ...chunk);
  }

  await ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);

  return NextResponse.json({
    ok: true,
    seeded: events.length,
  });
}
