import { describe, expect, it } from "vitest";
import {
  clearTelemetry,
  exportTelemetryPayload,
  loadTelemetry,
  trackEvent,
} from "../../web/src/lib/telemetry";

describe("telemetry lib", () => {
  it("tracks, loads, clears, and exports telemetry events", () => {
    trackEvent({
      type: "modal_opened",
      recordedAt: "2026-03-16T12:00:00.000Z",
      payload: {
        symbol: "btc",
        coinId: "bitcoin",
      },
    });

    expect(loadTelemetry()).toHaveLength(1);

    const exported = JSON.parse(exportTelemetryPayload());
    expect(exported.eventCount).toBe(1);
    expect(exported.events[0]).toMatchObject({
      type: "modal_opened",
      payload: {
        symbol: "btc",
      },
    });

    clearTelemetry();
    expect(loadTelemetry()).toEqual([]);
  });
});
