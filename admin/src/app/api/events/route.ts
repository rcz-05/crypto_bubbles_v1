import { NextResponse } from "next/server";
import { aggregate } from "@/lib/aggregate";
import { parseEvents } from "@/lib/events";
import { kvAvailable, lrange } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENTS_KEY = "events:all";
const DEFAULT_LIMIT = 5000;

export async function GET(req: Request) {
  if (!kvAvailable()) {
    return NextResponse.json(
      { error: "kv_unavailable" },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(req.url);
  const includeStats = searchParams.get("stats") !== "0";
  const limit = Math.min(
    DEFAULT_LIMIT,
    Math.max(1, Number(searchParams.get("limit") ?? DEFAULT_LIMIT)),
  );

  const raw = await lrange(EVENTS_KEY, 0, limit - 1);
  const events = parseEvents(raw);

  return NextResponse.json(
    {
      events,
      stats: includeStats ? aggregate(events) : undefined,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
