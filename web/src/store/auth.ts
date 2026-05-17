"use client";

import { create } from "zustand";
import { loadLocalFavorites } from "@/lib/favorites";
import { trackEvent } from "@/lib/telemetry";
import { useFavoritesStore } from "@/store/favorites";

export type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

type AuthStatus = "unknown" | "guest" | "authenticated";

type Result = { ok: true } | { ok: false; error: string };

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  /** Resolve the session once on app start. */
  loadSession: () => Promise<void>;
  login: (email: string, password: string) => Promise<Result>;
  register: (
    email: string,
    password: string,
    displayName: string | undefined,
    source: "register_page" | "onboarding",
  ) => Promise<Result>;
  logout: () => Promise<void>;
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  status: "unknown",

  loadSession: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { user: AuthUser | null };
      if (data.user) {
        set({ user: data.user, status: "authenticated" });
        await useFavoritesStore.getState().onAuthenticated();
      } else {
        set({ user: null, status: "guest" });
        useFavoritesStore.getState().loadGuest();
      }
    } catch {
      set({ user: null, status: "guest" });
      useFavoritesStore.getState().loadGuest();
    }
  },

  login: async (email, password) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      return { ok: false, error: "Network error. Try again." };
    }
    if (!res.ok) {
      return { ok: false, error: await readError(res, "Could not sign in.") };
    }
    const data = (await res.json()) as { user: AuthUser };
    set({ user: data.user, status: "authenticated" });
    trackEvent({
      type: "auth_logged_in",
      recordedAt: new Date().toISOString(),
      payload: {},
    });
    await useFavoritesStore.getState().onAuthenticated();
    return { ok: true };
  },

  register: async (email, password, displayName, source) => {
    let res: Response;
    try {
      res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName,
          guestFavorites: loadLocalFavorites(),
        }),
      });
    } catch {
      return { ok: false, error: "Network error. Try again." };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: await readError(res, "Could not create account."),
      };
    }
    const data = (await res.json()) as { user: AuthUser };
    set({ user: data.user, status: "authenticated" });
    trackEvent({
      type: "auth_signed_up",
      recordedAt: new Date().toISOString(),
      payload: { source },
    });
    await useFavoritesStore.getState().onAuthenticated();
    return { ok: true };
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* clear client state regardless */
    }
    set({ user: null, status: "guest" });
    trackEvent({
      type: "auth_logged_out",
      recordedAt: new Date().toISOString(),
      payload: {},
    });
    useFavoritesStore.getState().onLoggedOut();
  },
}));
