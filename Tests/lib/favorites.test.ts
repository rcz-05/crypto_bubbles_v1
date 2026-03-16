import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  addFavoriteToApi,
  fetchFavoritesFromApi,
  loadLocalFavorites,
  removeFavoriteFromApi,
  saveLocalFavorites,
} from "../../web/src/lib/favorites";

describe("favorites lib", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("safely reads and writes browser favorites", () => {
    window.localStorage.setItem("crypto-bubbles-favorites", "{not-json");
    expect(loadLocalFavorites()).toEqual([]);

    saveLocalFavorites([{ symbol: "btc", name: "Bitcoin" }]);
    expect(loadLocalFavorites()).toEqual([{ symbol: "btc", name: "Bitcoin" }]);
  });

  it("fetches favorites from the API and throws on non-2xx responses", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => [{ symbol: "eth", name: "Ethereum" }],
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
      });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchFavoritesFromApi()).resolves.toEqual([
      { symbol: "eth", name: "Ethereum" },
    ]);
    await expect(fetchFavoritesFromApi()).rejects.toThrow("Favorites API failed with 503");
  });

  it("posts and deletes favorites through the API wrappers", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await addFavoriteToApi({ symbol: "btc", name: "Bitcoin" });
    await removeFavoriteFromApi("btc");

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      "/api/favorites",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/favorites?symbol=btc",
      expect.objectContaining({ method: "DELETE" }),
    );
  });
});
