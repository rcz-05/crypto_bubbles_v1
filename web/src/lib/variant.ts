"use client";

import { useEffect, useState } from "react";
import { getSessionId, trackEvent } from "@/lib/telemetry";

export type Variant = "a" | "b";

const VARIANT_KEY = "coincanvas-variant";
const ASSIGNED_KEY = "coincanvas-variant-assigned";
const OVERRIDE_KEY = "coincanvas-variant-override";

let cachedVariant: Variant | null = null;

function canUseSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
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
  const stored = window.sessionStorage.getItem(VARIANT_KEY);
  return isVariant(stored) ? stored : "a";
}

function persistVariant(variant: Variant) {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(VARIANT_KEY, variant);
}

export function getVariant(): Variant {
  if (!canUseSessionStorage()) return cachedVariant ?? "a";

  const override = readOverrideFromUrl();
  if (override) {
    const previousVariant = cachedVariant ?? window.sessionStorage.getItem(VARIANT_KEY);
    const previousOverride = window.sessionStorage.getItem(OVERRIDE_KEY);
    cachedVariant = override;
    persistVariant(override);
    window.sessionStorage.setItem(OVERRIDE_KEY, override);
    window.sessionStorage.setItem(ASSIGNED_KEY, "1");
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

  const stored = window.sessionStorage.getItem(VARIANT_KEY);
  const assignedAlready = window.sessionStorage.getItem(ASSIGNED_KEY) === "1";
  if (isVariant(stored)) {
    cachedVariant = stored;
    if (!assignedAlready) {
      window.sessionStorage.setItem(ASSIGNED_KEY, "1");
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
  window.sessionStorage.setItem(ASSIGNED_KEY, "1");
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
    const timer = window.setTimeout(() => setVariant(getVariant()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  return variant;
}
