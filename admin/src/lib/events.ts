export type Variant = "a" | "b";

/** Wire format mirrors web/src/lib/telemetry.ts's TelemetryEvent. */
export type AdminEvent = {
  type: string;
  recordedAt: string;
  sessionId: string;
  payload?: Record<string, unknown>;
};

export function parseEvents(raw: string[]): AdminEvent[] {
  const events: AdminEvent[] = [];
  for (const line of raw) {
    try {
      const parsed = JSON.parse(line);
      if (
        parsed &&
        typeof parsed === "object" &&
        typeof parsed.type === "string" &&
        typeof parsed.recordedAt === "string" &&
        typeof parsed.sessionId === "string"
      ) {
        events.push(parsed as AdminEvent);
      }
    } catch {
      // skip malformed
    }
  }
  return events;
}

export function getVariant(event: AdminEvent): Variant | null {
  const v = (event.payload as { variant?: string } | undefined)?.variant;
  return v === "a" || v === "b" ? v : null;
}

export function getSymbol(event: AdminEvent): string | null {
  const s = (event.payload as { symbol?: unknown } | undefined)?.symbol;
  return typeof s === "string" ? s.toUpperCase() : null;
}
