"use client";

export type AdminFlags = {
  forceVariant: "a" | "b" | null;
  proOverride: boolean;
};

const CACHE_KEY = "coincanvas-admin-flags";
const FETCHED_AT_KEY = "coincanvas-admin-flags-fetched-at";
const CACHE_TTL_MS = 60_000;

let inMemory: AdminFlags | null = null;
let inflight: Promise<AdminFlags> | null = null;

function readSessionCache(): AdminFlags | null {
  if (typeof window === "undefined") return null;
  try {
    const fetchedAt = Number(window.sessionStorage.getItem(FETCHED_AT_KEY));
    if (!fetchedAt || Date.now() - fetchedAt > CACHE_TTL_MS) return null;
    const raw = window.sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminFlags;
    if (typeof parsed === "object" && parsed != null) return parsed;
  } catch {
    // ignore
  }
  return null;
}

function writeSessionCache(flags: AdminFlags) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify(flags));
    window.sessionStorage.setItem(FETCHED_AT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

export function peekAdminFlags(): AdminFlags {
  if (inMemory) return inMemory;
  const cached = readSessionCache();
  if (cached) {
    inMemory = cached;
    return cached;
  }
  return { forceVariant: null, proOverride: false };
}

export async function getAdminFlags(): Promise<AdminFlags> {
  const cached = readSessionCache();
  if (cached) {
    inMemory = cached;
    return cached;
  }
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const res = await fetch("/api/admin-flags", { cache: "no-store" });
      if (!res.ok) throw new Error("admin-flags fetch failed");
      const flags = (await res.json()) as AdminFlags;
      const sane: AdminFlags = {
        forceVariant: flags.forceVariant === "a" || flags.forceVariant === "b" ? flags.forceVariant : null,
        proOverride: flags.proOverride === true,
      };
      writeSessionCache(sane);
      inMemory = sane;
      return sane;
    } catch {
      const fallback: AdminFlags = { forceVariant: null, proOverride: false };
      inMemory = fallback;
      return fallback;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}
