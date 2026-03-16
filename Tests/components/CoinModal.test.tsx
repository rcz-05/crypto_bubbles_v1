import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CoinModal } from "../../web/src/components/CoinModal";
import { makeCoin } from "../fixtures/coins";

const telemetryMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/telemetry", () => ({
  trackEvent: telemetryMocks.trackEvent,
}));

describe("CoinModal", () => {
  it("loads guided context, tracks the load, and supports favorite + source actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        coinId: "bitcoin",
        symbol: "btc",
        summary: "Bitcoin is up because risk appetite and ETF flow are aligned today.",
        headlines: [
          {
            title: "Signal review",
            source: "CoinCanvas research note",
            publishedAt: "2026-03-16T12:00:00.000Z",
            url: "https://www.coingecko.com/en/coins/bitcoin",
          },
        ],
        riskBadges: [
          {
            label: "Fast Move",
            tone: "watch",
            detail: "The move is large enough to attract short-term traders.",
          },
        ],
        lastUpdated: "2026-03-16T12:00:00.000Z",
        isFallback: false,
        sourceLinks: [
          {
            label: "CoinGecko market page",
            url: "https://www.coingecko.com/en/coins/bitcoin",
            kind: "market",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const onClose = vi.fn();
    const onToggleFavorite = vi.fn();

    render(
      <CoinModal
        coin={makeCoin({ id: "bitcoin", symbol: "btc" })}
        onClose={onClose}
        onToggleFavorite={onToggleFavorite}
        isFavorite={() => false}
      />,
    );

    expect(screen.getByText("Loading context")).toBeInTheDocument();
    expect(
      await screen.findByText(
        "Bitcoin is up because risk appetite and ETF flow are aligned today.",
      ),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "context_loaded",
          payload: expect.objectContaining({ symbol: "btc", context_fallback_used: false }),
        }),
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save to favorites" }));
    expect(onToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ symbol: "btc" }));

    fireEvent.click(screen.getByRole("link", { name: /Signal review/i }));
    expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "source_opened",
        payload: expect.objectContaining({
          symbol: "btc",
          label: "Signal review",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("surfaces context failures without breaking the verified market data view", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      }),
    );

    render(
      <CoinModal
        coin={makeCoin({ id: "dogecoin", symbol: "doge", name: "Dogecoin" })}
        onClose={vi.fn()}
        onToggleFavorite={vi.fn()}
        isFavorite={() => false}
      />,
    );

    expect(
      await screen.findByText(/Context API failed with 500/i),
    ).toBeInTheDocument();
    expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "context_failed",
        payload: expect.objectContaining({ symbol: "doge" }),
      }),
    );
    expect(screen.getByText("What is confirmed right now")).toBeInTheDocument();
  });
});
