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

export type ProStatus = {
  isPro: boolean;
  state: "none" | "trial" | "active";
  since: string | null;
  trialEndsAt: string | null;
};

type AuthStatus = "unknown" | "guest" | "authenticated";

type Result = { ok: true } | { ok: false; error: string };

type AuthState = {
  user: AuthUser | null;
  status: AuthStatus;
  pro: ProStatus | null;
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
  /** Pull fresh Pro status (used after login/register). */
  refreshPro: () => Promise<void>;
  subscribePro: () => Promise<Result>;
  cancelPro: () => Promise<void>;
};

async function readError(res: Response, fallback: string): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error || fallback;
  } catch {
    return fallback;
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  status: "unknown",
  pro: null,

  loadSession: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as {
        user: AuthUser | null;
        pro: ProStatus | null;
      };
      if (data.user) {
        set({
          user: data.user,
          status: "authenticated",
          pro: data.pro ?? null,
        });
        await useFavoritesStore.getState().onAuthenticated();
      } else {
        set({ user: null, status: "guest", pro: null });
        useFavoritesStore.getState().loadGuest();
      }
    } catch {
      set({ user: null, status: "guest", pro: null });
      useFavoritesStore.getState().loadGuest();
    }
  },

  refreshPro: async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      const data = (await res.json()) as { pro: ProStatus | null };
      set({ pro: data.pro ?? null });
    } catch {
      /* keep prior pro state */
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
    await get().refreshPro();
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
    await get().refreshPro();
    return { ok: true };
  },

  logout: async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch {
      /* clear client state regardless */
    }
    set({ user: null, status: "guest", pro: null });
    trackEvent({
      type: "auth_logged_out",
      recordedAt: new Date().toISOString(),
      payload: {},
    });
    useFavoritesStore.getState().onLoggedOut();
  },

  subscribePro: async () => {
    let res: Response;
    try {
      res = await fetch("/api/pro", { method: "POST" });
    } catch {
      return { ok: false, error: "Network error. Try again." };
    }
    if (!res.ok) {
      return {
        ok: false,
        error: await readError(res, "Could not start Pro."),
      };
    }
    const data = (await res.json()) as { pro: ProStatus };
    set({ pro: data.pro });
    trackEvent({
      type: "pro_subscribed",
      recordedAt: new Date().toISOString(),
      payload: { state: data.pro.state },
    });
    return { ok: true };
  },

  cancelPro: async () => {
    try {
      await fetch("/api/pro", { method: "DELETE" });
    } catch {
      /* clear client state regardless */
    }
    set({
      pro: { isPro: false, state: "none", since: null, trialEndsAt: null },
    });
    trackEvent({
      type: "pro_canceled",
      recordedAt: new Date().toISOString(),
      payload: {},
    });
  },
}));
