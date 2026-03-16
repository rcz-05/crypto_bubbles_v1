import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const settingsMocks = vi.hoisted(() => ({
  loadLocalFavorites: vi.fn(),
  loadTelemetry: vi.fn(),
  clearTelemetry: vi.fn(),
  exportTelemetryPayload: vi.fn(),
}));

vi.mock("@/lib/favorites", () => ({
  loadLocalFavorites: settingsMocks.loadLocalFavorites,
}));

vi.mock("@/lib/telemetry", () => ({
  clearTelemetry: settingsMocks.clearTelemetry,
  exportTelemetryPayload: settingsMocks.exportTelemetryPayload,
  loadTelemetry: settingsMocks.loadTelemetry,
}));

import SettingsPage from "../../web/src/app/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    settingsMocks.loadLocalFavorites.mockReset();
    settingsMocks.loadTelemetry.mockReset();
    settingsMocks.clearTelemetry.mockReset();
    settingsMocks.exportTelemetryPayload.mockReset();

    settingsMocks.loadLocalFavorites.mockReturnValue([{ symbol: "btc", name: "Bitcoin" }]);
    settingsMocks.loadTelemetry.mockReturnValue([
      {
        type: "modal_opened",
        recordedAt: "2026-03-16T12:00:00.000Z",
        payload: { symbol: "btc", coinId: "bitcoin" },
      },
      {
        type: "context_loaded",
        recordedAt: "2026-03-16T12:00:01.000Z",
        payload: {
          symbol: "btc",
          time_to_context_ms: 420,
          context_fallback_used: false,
          headline_count: 3,
        },
      },
      {
        type: "source_opened",
        recordedAt: "2026-03-16T12:00:02.000Z",
        payload: {
          symbol: "btc",
          url: "https://www.coingecko.com/en/coins/bitcoin",
          label: "CoinGecko market page",
        },
      },
    ]);
    settingsMocks.exportTelemetryPayload.mockReturnValue(
      JSON.stringify({ eventCount: 3, events: [] }),
    );
  });

  it("summarizes telemetry, exports the dataset, and clears local evidence", () => {
    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(() => undefined);

    render(<SettingsPage />);

    expect(screen.getAllByText("1")).toHaveLength(4);
    expect(screen.getByText("420ms")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(settingsMocks.exportTelemetryPayload).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Downloaded" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear telemetry" }));
    expect(settingsMocks.clearTelemetry).toHaveBeenCalledTimes(1);
    expect(screen.getByText("No events recorded yet.")).toBeInTheDocument();
  });
});
