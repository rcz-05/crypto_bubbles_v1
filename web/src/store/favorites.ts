"use client";

import { create } from "zustand";
import {
  FavoriteCoin,
  addFavoriteToApi,
  fetchFavoritesFromApi,
  loadLocalFavorites,
  removeFavoriteFromApi,
  saveLocalFavorites,
} from "@/lib/favorites";

type FavoritesState = {
  favorites: FavoriteCoin[];
  ready: boolean;
  load: () => Promise<void>;
  add: (fav: FavoriteCoin) => Promise<void>;
  remove: (symbol: string) => Promise<void>;
  isFavorite: (symbol: string) => boolean;
};

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  ready: false,
  load: async () => {
    const local = loadLocalFavorites();
    set({ favorites: local, ready: true });
    // Try to hydrate from API if available
    try {
      const remote = await fetchFavoritesFromApi();
      if (remote && remote.length) {
        const merged = mergeFavorites(local, remote);
        set({ favorites: merged });
        saveLocalFavorites(merged);
      }
    } catch {
      // silently fall back to localStorage
    }
  },
  add: async (fav) => {
    const current = get().favorites;
    if (current.some((c) => c.symbol === fav.symbol)) return;
    const next = [...current, { ...fav, added_at: new Date().toISOString() }];
    set({ favorites: next });
    saveLocalFavorites(next);
    try {
      await addFavoriteToApi(fav);
    } catch {
      // ignore API errors; localStorage already updated
    }
  },
  remove: async (symbol) => {
    const next = get().favorites.filter((f) => f.symbol !== symbol);
    set({ favorites: next });
    saveLocalFavorites(next);
    try {
      await removeFavoriteFromApi(symbol);
    } catch {
      // ignore API errors
    }
  },
  isFavorite: (symbol) => get().favorites.some((f) => f.symbol === symbol),
}));

function mergeFavorites(a: FavoriteCoin[], b: FavoriteCoin[]) {
  const map = new Map<string, FavoriteCoin>();
  [...a, ...b].forEach((fav) => map.set(fav.symbol, fav));
  return Array.from(map.values());
}
