import { beforeEach, describe, expect, it, vi } from "vitest";
import { FavoriteCoin } from "../../web/src/lib/favorites";

const favoritesLibMocks = vi.hoisted(() => ({
  addFavoriteToApi: vi.fn(),
  fetchFavoritesFromApi: vi.fn(),
  loadLocalFavorites: vi.fn(),
  removeFavoriteFromApi: vi.fn(),
  saveLocalFavorites: vi.fn(),
}));

const telemetryMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("@/lib/favorites", () => ({
  addFavoriteToApi: favoritesLibMocks.addFavoriteToApi,
  fetchFavoritesFromApi: favoritesLibMocks.fetchFavoritesFromApi,
  loadLocalFavorites: favoritesLibMocks.loadLocalFavorites,
  removeFavoriteFromApi: favoritesLibMocks.removeFavoriteFromApi,
  saveLocalFavorites: favoritesLibMocks.saveLocalFavorites,
}));

vi.mock("@/lib/telemetry", () => ({
  trackEvent: telemetryMocks.trackEvent,
}));

import { useFavoritesStore } from "../../web/src/store/favorites";

describe("favorites store", () => {
  beforeEach(() => {
    useFavoritesStore.setState({
      favorites: [],
      ready: false,
    });

    favoritesLibMocks.addFavoriteToApi.mockReset();
    favoritesLibMocks.fetchFavoritesFromApi.mockReset();
    favoritesLibMocks.loadLocalFavorites.mockReset();
    favoritesLibMocks.removeFavoriteFromApi.mockReset();
    favoritesLibMocks.saveLocalFavorites.mockReset();
    telemetryMocks.trackEvent.mockReset();
  });

  it("loads local favorites first and merges remote results when available", async () => {
    const local: FavoriteCoin[] = [{ symbol: "btc", name: "Bitcoin" }];
    const remote: FavoriteCoin[] = [{ symbol: "eth", name: "Ethereum" }];
    favoritesLibMocks.loadLocalFavorites.mockReturnValue(local);
    favoritesLibMocks.fetchFavoritesFromApi.mockResolvedValue(remote);

    await useFavoritesStore.getState().load();

    expect(useFavoritesStore.getState()).toMatchObject({
      ready: true,
      favorites: [...local, ...remote],
    });
    expect(favoritesLibMocks.saveLocalFavorites).toHaveBeenCalledWith([
      ...local,
      ...remote,
    ]);
  });

  it("keeps the local-first state if the remote hydrate fails", async () => {
    const local: FavoriteCoin[] = [{ symbol: "btc", name: "Bitcoin" }];
    favoritesLibMocks.loadLocalFavorites.mockReturnValue(local);
    favoritesLibMocks.fetchFavoritesFromApi.mockRejectedValue(new Error("offline"));

    await useFavoritesStore.getState().load();

    expect(useFavoritesStore.getState()).toMatchObject({
      ready: true,
      favorites: local,
    });
  });

  it("adds favorites optimistically, tracks telemetry, and ignores duplicates", async () => {
    favoritesLibMocks.addFavoriteToApi.mockRejectedValue(new Error("offline"));

    await useFavoritesStore.getState().add({ symbol: "btc", name: "Bitcoin" });
    await useFavoritesStore.getState().add({ symbol: "btc", name: "Bitcoin" });

    expect(useFavoritesStore.getState().favorites).toHaveLength(1);
    expect(favoritesLibMocks.saveLocalFavorites).toHaveBeenCalledTimes(1);
    expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "favorite_added",
        payload: { symbol: "btc" },
      }),
    );
  });

  it("removes favorites optimistically and records the removal", async () => {
    useFavoritesStore.setState({
      favorites: [
        { symbol: "btc", name: "Bitcoin", added_at: "2026-03-16T12:00:00.000Z" },
      ],
      ready: true,
    });
    favoritesLibMocks.removeFavoriteFromApi.mockRejectedValue(new Error("offline"));

    await useFavoritesStore.getState().remove("btc");

    expect(useFavoritesStore.getState().favorites).toEqual([]);
    expect(favoritesLibMocks.saveLocalFavorites).toHaveBeenCalledWith([]);
    expect(telemetryMocks.trackEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "favorite_removed",
        payload: { symbol: "btc" },
      }),
    );
  });
});
