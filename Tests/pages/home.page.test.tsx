import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { marketCoins } from "../fixtures/coins";

const homeMocks = vi.hoisted(() => ({
  marketState: {
    coins: [] as typeof marketCoins,
    status: "idle" as "idle" | "loading" | "error",
    error: undefined as string | undefined,
    lastUpdated: Date.parse("2026-03-16T12:00:00.000Z"),
    fetchCoins: vi.fn(),
  },
  favoritesState: {
    favorites: [] as Array<{ symbol: string; name: string }>,
    load: vi.fn(),
    add: vi.fn(),
    remove: vi.fn(),
    isFavorite: vi.fn(() => false),
  },
  requestMotionPermission: vi.fn(),
  trackEvent: vi.fn(),
}));

vi.mock("@/store/market", () => ({
  useMarketStore: () => homeMocks.marketState,
}));

vi.mock("@/store/favorites", () => ({
  useFavoritesStore: () => homeMocks.favoritesState,
}));

vi.mock("@/hooks/useMeasure", () => ({
  useMeasure: () => ({
    ref: vi.fn(),
    width: 900,
    height: 640,
  }),
}));

vi.mock("@/hooks/useShakeRefresh", () => ({
  useShakeRefresh: vi.fn(),
  requestMotionPermission: homeMocks.requestMotionPermission,
}));

vi.mock("@/lib/telemetry", () => ({
  trackEvent: homeMocks.trackEvent,
}));

vi.mock("@/components/BubbleChart", () => ({
  BubbleChart: ({
    data,
    onSelect,
  }: {
    data: typeof marketCoins;
    onSelect: (coin: (typeof marketCoins)[number]) => void;
  }) => (
    <div data-testid="bubble-chart">
      {data.map((coin) => (
        <button key={coin.id} onClick={() => onSelect(coin)} type="button">
          {coin.symbol.toUpperCase()}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("@/components/CoinModal", () => ({
  CoinModal: ({ coin }: { coin: { symbol: string } | null }) => (
    <div data-testid="coin-modal">{coin ? coin.symbol.toUpperCase() : "EMPTY"}</div>
  ),
}));

import HomePage from "../../web/src/app/page";

describe("HomePage", () => {
  beforeEach(() => {
    homeMocks.marketState.coins = [...marketCoins];
    homeMocks.marketState.status = "idle";
    homeMocks.marketState.error = undefined;
    homeMocks.marketState.lastUpdated = Date.parse("2026-03-16T12:00:00.000Z");
    homeMocks.marketState.fetchCoins.mockReset();

    homeMocks.favoritesState.favorites = [];
    homeMocks.favoritesState.load.mockReset();
    homeMocks.favoritesState.add.mockReset();
    homeMocks.favoritesState.remove.mockReset();
    homeMocks.favoritesState.isFavorite.mockReset();
    homeMocks.favoritesState.isFavorite.mockReturnValue(false);

    homeMocks.requestMotionPermission.mockReset();
    homeMocks.trackEvent.mockReset();
  });

  it("hydrates the board, filters search results, and records modal opens", async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(homeMocks.marketState.fetchCoins).toHaveBeenCalledTimes(1);
      expect(homeMocks.favoritesState.load).toHaveBeenCalledTimes(1);
    });

    fireEvent.change(screen.getByLabelText("Search the board"), {
      target: { value: "eth" },
    });

    expect(screen.queryByRole("button", { name: "BTC" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "ETH" }));

    expect(screen.getByTestId("coin-modal")).toHaveTextContent("ETH");
    expect(homeMocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "modal_opened",
        payload: expect.objectContaining({
          symbol: "eth",
          coinId: "ethereum",
        }),
      }),
    );
  });

  it("refreshes from both the button and the keyboard shortcut", async () => {
    render(<HomePage />);

    await waitFor(() => {
      expect(homeMocks.marketState.fetchCoins).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Refresh (R)" }));
    fireEvent.keyDown(window, { key: "r" });

    expect(homeMocks.marketState.fetchCoins).toHaveBeenCalledTimes(3);
  });

  it("updates the motion button label when permission is blocked", async () => {
    homeMocks.requestMotionPermission.mockResolvedValue(false);

    render(<HomePage />);

    fireEvent.click(screen.getByRole("button", { name: "Enable shake" }));

    expect(
      await screen.findByRole("button", { name: "Motion blocked" }),
    ).toBeInTheDocument();
  });
});
