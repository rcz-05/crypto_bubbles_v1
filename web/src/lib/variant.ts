"use client";

import { useEffect, useState } from "react";
import { getAdminFlags, peekAdminFlags } from "@/lib/admin-flags";
import { getSessionId, trackEvent } from "@/lib/telemetry";

export type Variant = "a" | "b";

const VARIANT_KEY = "coincanvas-variant";
const ASSIGNED_KEY = "coincanvas-variant-assigned";
const OVERRIDE_KEY = "coincanvas-variant-override";

let cachedVariant: Variant | null = null;

function canUseSessionStorage() {
  // Variant persists in localStorage so PWA cold launches don't reroll the
  // assignment (iOS Safari may reap the standalone window's sessionStorage
  // between launches). The function name is kept for callsite stability.
  return typeof window !== "undefined" && Boolean(window.localStorage);
}

function isVariant(value: string | null): value is Variant {
  return value === "a" || value === "b";
}

function hashSessionToVariant(sessionId: string): Variant {
  let hash = 2166136261;
  for (let i = 0; i < sessionId.length; i++) {
    hash ^= sessionId.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 2 === 0 ? "a" : "b";
}

function readOverrideFromUrl(): Variant | null {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const value = params.get("variant")?.toLowerCase() ?? null;
  return isVariant(value) ? value : null;
}

function peekVariant(): Variant {
  if (cachedVariant) return cachedVariant;
  if (!canUseSessionStorage()) return "a";
  const override = readOverrideFromUrl();
  if (override) return override;
  const adminFlag = peekAdminFlags().forceVariant;
  if (adminFlag) return adminFlag;
  const stored = window.localStorage.getItem(VARIANT_KEY);
  return isVariant(stored) ? stored : "a";
}

function persistVariant(variant: Variant) {
  if (!canUseSessionStorage()) return;
  window.localStorage.setItem(VARIANT_KEY, variant);
}

export function getVariant(): Variant {
  if (!canUseSessionStorage()) return cachedVariant ?? "a";

  const adminFlag = peekAdminFlags().forceVariant;
  if (adminFlag && cachedVariant !== adminFlag) {
    cachedVariant = adminFlag;
    persistVariant(adminFlag);
    window.localStorage.setItem(ASSIGNED_KEY, "1");
    return adminFlag;
  }

  const override = readOverrideFromUrl();
  if (override) {
    const previousVariant = cachedVariant ?? window.localStorage.getItem(VARIANT_KEY);
    const previousOverride = window.localStorage.getItem(OVERRIDE_KEY);
    cachedVariant = override;
    persistVariant(override);
    window.localStorage.setItem(OVERRIDE_KEY, override);
    window.localStorage.setItem(ASSIGNED_KEY, "1");
    if (previousOverride !== override) {
      trackEvent({
        type: "variant_overridden",
        recordedAt: new Date().toISOString(),
        payload: {
          variant: override,
          previousVariant: isVariant(previousVariant) ? previousVariant : null,
        },
      });
    }
    return override;
  }

  if (cachedVariant) return cachedVariant;

  const stored = window.localStorage.getItem(VARIANT_KEY);
  const assignedAlready = window.localStorage.getItem(ASSIGNED_KEY) === "1";
  if (isVariant(stored)) {
    cachedVariant = stored;
    if (!assignedAlready) {
      window.localStorage.setItem(ASSIGNED_KEY, "1");
      trackEvent({
        type: "variant_assigned",
        recordedAt: new Date().toISOString(),
        payload: { variant: stored, source: "stored" },
      });
    }
    return stored;
  }

  const variant = hashSessionToVariant(getSessionId());
  cachedVariant = variant;
  persistVariant(variant);
  window.localStorage.setItem(ASSIGNED_KEY, "1");
  trackEvent({
    type: "variant_assigned",
    recordedAt: new Date().toISOString(),
    payload: { variant, source: "hash" },
  });
  return variant;
}

export function useVariant(): Variant {
  const [variant, setVariant] = useState<Variant>(() => peekVariant());

  useEffect(() => {
    const timer = window.setTimeout(async () => {
      // Fetch admin flags first so forceVariant lands before the assignment fires.
      await getAdminFlags();
      setVariant(getVariant());
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return variant;
}
