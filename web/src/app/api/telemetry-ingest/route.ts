import { NextResponse } from "next/server";
import { kvAvailable, lpush, ltrim } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EVENTS_KEY = "events:all";
const MAX_EVENTS = 5000;
const MAX_BATCH = 50;

type IncomingEvent = {
  type?: string;
  recordedAt?: string;
  sessionId?: string;
  payload?: unknown;
};

function isStringRecordable(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length < 256;
}

function validate(event: IncomingEvent): IncomingEvent | null {
  if (!event || typeof event !== "object") return null;
  if (!isStringRecordable(event.type)) return null;
  if (!isStringRecordable(event.recordedAt)) return null;
  if (!isStringRecordable(event.sessionId)) return null;
  // payload is optional and free-form, but cap stringified size
  return {
    type: event.type,
    recordedAt: event.recordedAt,
    sessionId: event.sessionId,
    payload: event.payload,
  };
}

export async function POST(req: Request) {
  if (!kvAvailable()) {
    return NextResponse.json({ ok: false, reason: "kv_unavailable" }, { status: 200 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const events: IncomingEvent[] = Array.isArray(body)
    ? (body as IncomingEvent[])
    : [body as IncomingEvent];

  if (events.length === 0 || events.length > MAX_BATCH) {
    return NextResponse.json({ error: "bad_batch" }, { status: 400 });
  }

  const valid = events.map(validate).filter((e): e is IncomingEvent => e != null);
  if (valid.length === 0) {
    return NextResponse.json({ ok: false, reason: "no_valid" }, { status: 200 });
  }

  const serialized = valid.map((e) => {
    const json = JSON.stringify(e);
    // safety cap on event size
    return json.length > 4000 ? JSON.stringify({ ...e, payload: "<truncated>" }) : json;
  });

  try {
    await lpush(EVENTS_KEY, ...serialized);
    await ltrim(EVENTS_KEY, 0, MAX_EVENTS - 1);
  } catch {
    // Fire-and-forget — never block UX on Redis failure
    return NextResponse.json({ ok: false, reason: "kv_failed" }, { status: 200 });
  }

  return NextResponse.json({ ok: true, ingested: valid.length });
}
