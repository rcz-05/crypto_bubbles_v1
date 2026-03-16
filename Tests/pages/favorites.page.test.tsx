import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const favoritesPageMocks = vi.hoisted(() => ({
  state: {
    favorites: [] as Array<{ symbol: string; name: string; added_at?: string }>,
    load: vi.fn(),
    remove: vi.fn(),
  },
}));

vi.mock("@/store/favorites", () => ({
  useFavoritesStore: () => favoritesPageMocks.state,
}));

import FavoritesPage from "../../web/src/app/favorites/page";

describe("FavoritesPage", () => {
  beforeEach(() => {
    favoritesPageMocks.state.favorites = [];
    favoritesPageMocks.state.load.mockReset();
    favoritesPageMocks.state.remove.mockReset();
  });

  it("loads favorites and shows the empty state when none are saved", async () => {
    render(<FavoritesPage />);

    await waitFor(() => {
      expect(favoritesPageMocks.state.load).toHaveBeenCalledTimes(1);
    });

    expect(
      screen.getByText("No favorites yet. Add coins from the bubble board."),
    ).toBeInTheDocument();
  });

  it("renders saved favorites and removes a selected coin", () => {
    favoritesPageMocks.state.favorites = [
      {
        symbol: "btc",
        name: "Bitcoin",
        added_at: "2026-03-16T12:00:00.000Z",
      },
    ];

    render(<FavoritesPage />);

    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("Bitcoin")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(favoritesPageMocks.state.remove).toHaveBeenCalledWith("btc");
  });
});
