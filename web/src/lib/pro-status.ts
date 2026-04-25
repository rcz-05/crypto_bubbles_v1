"use client";

import { useEffect, useState } from "react";
import { getAdminFlags, peekAdminFlags } from "@/lib/admin-flags";
import { trackEvent } from "@/lib/telemetry";

export type ProStatus = {
  isPro: boolean;
  state: "inactive" | "trial" | "active";
  since: string | null;
  trialEndsAt: string | null;
};

const PRO_KEY = "coincanvas-pro";
const SINCE_KEY = "coincanvas-pro-since";
const TRIAL_END_KEY = "coincanvas-pro-trial-ends";
const OVERRIDE_KEY = "coincanvas-pro-override";

const TRIAL_DAYS = 7;

export const PRO_PRICE_USD = 3;
export const PRO_TRIAL_DAYS = TRIAL_DAYS;

const STATUS_CHANGE_EVENT = "coincanvas-pro-changed";

function canUseStorage() {
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function readOverrideFromUrl(): "1" | "0" | null {
  if (typeof window === "undefined") return null;
  const value = new URLSearchParams(window.location.search)
    .get("pro")
    ?.toLowerCase();
  if (value === "1") return "1";
  if (value === "0") return "0";
  return null;
}

function emitChange() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(STATUS_CHANGE_EVENT));
}

function readStatus(): ProStatus {
  if (!canUseStorage()) {
    return { isPro: false, state: "inactive", since: null, trialEndsAt: null };
  }

  // Admin Pro override grants Pro to every visiting session until cleared.
  if (peekAdminFlags().proOverride) {
    return {
      isPro: true,
      state: "active",
      since: null,
      trialEndsAt: null,
    };
  }

  const flag = window.localStorage.getItem(PRO_KEY);
  if (flag !== "true") {
    return { isPro: false, state: "inactive", since: null, trialEndsAt: null };
  }

  const since = window.localStorage.getItem(SINCE_KEY);
  const trialEndsAt = window.localStorage.getItem(TRIAL_END_KEY);

  let state: "trial" | "active" = "active";
  if (trialEndsAt) {
    const ends = Date.parse(trialEndsAt);
    if (!Number.isNaN(ends) && ends > Date.now()) {
      state = "trial";
    } else {
      state = "active";
    }
  }

  return { isPro: true, state, since, trialEndsAt };
}

export function getProStatus(): ProStatus {
  if (!canUseStorage()) {
    return { isPro: false, state: "inactive", since: null, trialEndsAt: null };
  }

  const override = readOverrideFromUrl();
  if (override === "1") {
    const stored = readStatus();
    if (!stored.isPro) {
      window.localStorage.setItem(PRO_KEY, "true");
      window.localStorage.setItem(SINCE_KEY, new Date().toISOString());
      window.localStorage.setItem(OVERRIDE_KEY, "1");
      emitChange();
      return readStatus();
    }
    return stored;
  }

  if (override === "0") {
    if (window.localStorage.getItem(PRO_KEY) === "true") {
      window.localStorage.removeItem(PRO_KEY);
      window.localStorage.removeItem(SINCE_KEY);
      window.localStorage.removeItem(TRIAL_END_KEY);
      window.localStorage.setItem(OVERRIDE_KEY, "0");
      emitChange();
    }
    return readStatus();
  }

  return readStatus();
}

export function activatePro(opts: { withTrial: boolean }) {
  if (!canUseStorage()) return;
  const now = new Date();
  window.localStorage.setItem(PRO_KEY, "true");
  window.localStorage.setItem(SINCE_KEY, now.toISOString());
  if (opts.withTrial) {
    const ends = new Date(now.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
    window.localStorage.setItem(TRIAL_END_KEY, ends.toISOString());
  } else {
    window.localStorage.removeItem(TRIAL_END_KEY);
  }
  trackEvent({
    type: "pro_subscribed",
    recordedAt: now.toISOString(),
    payload: {
      withTrial: opts.withTrial,
      priceUsd: PRO_PRICE_USD,
    },
  });
  emitChange();
}

export function cancelPro(reason: "user" | "override") {
  if (!canUseStorage()) return;
  if (window.localStorage.getItem(PRO_KEY) !== "true") return;
  const since = window.localStorage.getItem(SINCE_KEY);
  window.localStorage.removeItem(PRO_KEY);
  window.localStorage.removeItem(SINCE_KEY);
  window.localStorage.removeItem(TRIAL_END_KEY);
  trackEvent({
    type: "pro_canceled",
    recordedAt: new Date().toISOString(),
    payload: { reason, since: since ?? null },
  });
  emitChange();
}

export function useProStatus(): ProStatus {
  const [status, setStatus] = useState<ProStatus>(() => readStatus());

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      // Sync admin flags so proOverride is picked up on first load.
      await getAdminFlags();
      setStatus(getProStatus());
    }, 0);

    const refresh = () => setStatus(readStatus());
    window.addEventListener(STATUS_CHANGE_EVENT, refresh);
    window.addEventListener("storage", refresh);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener(STATUS_CHANGE_EVENT, refresh);
      window.removeEventListener("storage", refresh);
    };
  }, []);

  return status;
}

export function trialDaysRemaining(trialEndsAt: string | null): number {
  if (!trialEndsAt) return 0;
  const ends = Date.parse(trialEndsAt);
  if (Number.isNaN(ends)) return 0;
  const diffMs = ends - Date.now();
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (24 * 60 * 60 * 1000));
}
