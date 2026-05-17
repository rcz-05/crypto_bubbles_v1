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
import { trackEvent } from "@/lib/telemetry";

type FavoritesMode = "guest" | "user";

type FavoritesState = {
  favorites: FavoriteCoin[];
  ready: boolean;
  /** "guest" => localStorage only; "user" => synced to the account. */
  mode: FavoritesMode;
  /** Guest baseline load (localStorage). Idempotent. */
  load: () => void;
  /** Called by the auth store once a session resolves to a guest. */
  loadGuest: () => void;
  /** Called by the auth store after login/register: merge guest list up,
   *  then treat the account as the source of truth. */
  onAuthenticated: () => Promise<void>;
  /** Called by the auth store on logout: revert to the guest list. */
  onLoggedOut: () => void;
  add: (fav: FavoriteCoin) => Promise<void>;
  remove: (symbol: string) => Promise<void>;
  isFavorite: (symbol: string) => boolean;
};

function mergeFavorites(a: FavoriteCoin[], b: FavoriteCoin[]) {
  const map = new Map<string, FavoriteCoin>();
  [...a, ...b].forEach((fav) => map.set(fav.symbol, fav));
  return Array.from(map.values());
}

export const useFavoritesStore = create<FavoritesState>((set, get) => ({
  favorites: [],
  ready: false,
  mode: "guest",

  load: () => {
    if (get().ready) return;
    set({ favorites: loadLocalFavorites(), ready: true, mode: "guest" });
  },

  loadGuest: () => {
    set({ favorites: loadLocalFavorites(), ready: true, mode: "guest" });
  },

  onAuthenticated: async () => {
    const local = loadLocalFavorites();
    // Push anything saved as a guest up to the account (server dedups).
    for (const f of local) {
      try {
        await addFavoriteToApi(f);
      } catch {
        /* ignore — best effort */
      }
    }
    try {
      const remote = await fetchFavoritesFromApi();
      set({
        favorites: mergeFavorites(local, remote),
        ready: true,
        mode: "user",
      });
    } catch {
      set({ favorites: local, ready: true, mode: "user" });
    }
  },

  onLoggedOut: () => {
    set({ favorites: loadLocalFavorites(), ready: true, mode: "guest" });
  },

  add: async (fav) => {
    const current = get().favorites;
    if (current.some((c) => c.symbol === fav.symbol)) return;
    const entry = { ...fav, added_at: new Date().toISOString() };
    const next = [...current, entry];
    set({ favorites: next });
    trackEvent({
      type: "favorite_added",
      recordedAt: new Date().toISOString(),
      payload: { symbol: fav.symbol },
    });
    if (get().mode === "user") {
      try {
        await addFavoriteToApi(entry);
      } catch {
        /* optimistic; ignore */
      }
    } else {
      saveLocalFavorites(next);
    }
  },

  remove: async (symbol) => {
    const next = get().favorites.filter((f) => f.symbol !== symbol);
    set({ favorites: next });
    trackEvent({
      type: "favorite_removed",
      recordedAt: new Date().toISOString(),
      payload: { symbol },
    });
    if (get().mode === "user") {
      try {
        await removeFavoriteFromApi(symbol);
      } catch {
        /* optimistic; ignore */
      }
    } else {
      saveLocalFavorites(next);
    }
  },

  isFavorite: (symbol) => get().favorites.some((f) => f.symbol === symbol),
}));
