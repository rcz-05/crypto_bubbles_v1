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
    const fetchMock = vi.fn((input: string | URL | Request) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

      if (url.includes("/api/context")) {
        return Promise.resolve({
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
      }

      if (url.includes("/api/news")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            coin: {
              id: "bitcoin",
              symbol: "btc",
              name: "Bitcoin",
            },
            provider: "gnews",
            query: "(\"Bitcoin\" OR \"BTC\") AND (crypto OR cryptocurrency OR blockchain)",
            fetchedAt: "2026-03-16T12:01:00.000Z",
            articles: [
              {
                title: "Fresh market headline",
                description: "A live article from the configured provider.",
                url: "https://example.com/news/bitcoin",
                image: null,
                publishedAt: "2026-03-16T12:01:00.000Z",
                source: "Example News",
                provider: "gnews",
              },
            ],
          }),
        });
      }

      if (url.includes("/api/explanation")) {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            explanation:
              "Bitcoin is moving higher because strong 24-hour momentum is lining up with supportive fresh headlines, so traders appear to be reacting to both price strength and current news flow rather than a random spike.",
            model: "qwen/qwen3-next-80b-a3b-instruct:free",
            generatedAt: "2026-03-16T12:02:00.000Z",
          }),
        });
      }

      throw new Error(`Unexpected fetch call: ${url}`);
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
        "Bitcoin is moving higher because strong 24-hour momentum is lining up with supportive fresh headlines, so traders appear to be reacting to both price strength and current news flow rather than a random spike.",
      ),
    ).toBeInTheDocument();
    expect(await screen.findByText("Fresh market headline")).toBeInTheDocument();

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

    fireEvent.click(screen.getByRole("link", { name: /Fresh market headline/i }));
    expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "source_opened",
        payload: expect.objectContaining({
          symbol: "btc",
          label: "Fresh market headline",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
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
