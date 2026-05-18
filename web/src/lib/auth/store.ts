/**
 * Auth + per-user favorites persistence.
 *
 * Persists in the project's Upstash KV/Redis (same store used for telemetry)
 * when KV REST credentials are present, and falls back to an in-memory store
 * otherwise so the app still runs without KV.
 *
 * KV key layout:
 *   auth:email:<normalizedEmail>  -> userId          (also the uniqueness lock)
 *   auth:user:<userId>            -> JSON UserRecord
 *   auth:favs:<userId>            -> JSON FavoriteCoin[]
 *
 * Server-only: never import from a "use client" file.
 */

import { randomUUID } from "crypto";
import { kvConfigured } from "@/lib/auth/config";
import { del, get, set, setnx } from "@/lib/kv";
import type { FavoriteCoin } from "@/lib/favorites";
import { PRO_PRICE_USD, PRO_TRIAL_DAYS } from "@/lib/pro-constants";

export type UserRecord = {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string | null;
  createdAt: string;
};

export type PublicUser = {
  id: string;
  email: string;
  displayName: string | null;
  createdAt: string;
};

/** Account-level Pro entitlement (replaces the old localStorage flag). */
export { PRO_PRICE_USD, PRO_TRIAL_DAYS };

export type ProState = "none" | "trial" | "active";

export type ProStatus = {
  isPro: boolean;
  state: ProState;
  since: string | null;
  trialEndsAt: string | null;
};

const NO_PRO: ProStatus = {
  isPro: false,
  state: "none",
  since: null,
  trialEndsAt: null,
};

const usingKv = kvConfigured();

const emailKey = (email: string) => `auth:email:${email}`;
const userKey = (id: string) => `auth:user:${id}`;
const favsKey = (id: string) => `auth:favs:${id}`;
const proKey = (id: string) => `auth:pro:${id}`;

// ---- In-memory fallback (per server process) -------------------------------
const memUsersById = new Map<string, UserRecord>();
const memUsersByEmail = new Map<string, UserRecord>();
const memFavorites = new Map<string, Map<string, FavoriteCoin>>();
const memPro = new Map<string, ProStatus>();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function toPublicUser(u: UserRecord): PublicUser {
  return {
    id: u.id,
    email: u.email,
    displayName: u.displayName,
    createdAt: u.createdAt,
  };
}

function parseUser(raw: string | null): UserRecord | null {
  if (!raw) return null;
  try {
    const u = JSON.parse(raw) as UserRecord;
    if (typeof u?.id === "string" && typeof u?.email === "string") return u;
    return null;
  } catch {
    return null;
  }
}

function parseFavorites(raw: string | null): FavoriteCoin[] {
  if (!raw) return [];
  try {
    const list = JSON.parse(raw);
    return Array.isArray(list) ? (list as FavoriteCoin[]) : [];
  } catch {
    return [];
  }
}

/** Create a user. Returns null if the email is already registered. */
export async function createUser(params: {
  email: string;
  passwordHash: string;
  displayName?: string | null;
}): Promise<UserRecord | null> {
  const email = normalizeEmail(params.email);
  const id = randomUUID();
  const record: UserRecord = {
    id,
    email,
    passwordHash: params.passwordHash,
    displayName: params.displayName?.trim() || null,
    createdAt: new Date().toISOString(),
  };

  if (usingKv) {
    try {
      // Atomic email reservation — fails if the email already exists.
      const reserved = await setnx(emailKey(email), id);
      if (!reserved) return null;
      try {
        await set(userKey(id), JSON.stringify(record));
      } catch (error) {
        // Roll back the reservation so the email isn't permanently stuck.
        await del(emailKey(email)).catch(() => {});
        throw error;
      }
      return record;
    } catch (error) {
      console.error("createUser KV error", error);
      return null;
    }
  }

  if (memUsersByEmail.has(email)) return null;
  memUsersById.set(id, record);
  memUsersByEmail.set(email, record);
  return record;
}

export async function findUserByEmail(
  email: string,
): Promise<UserRecord | null> {
  const key = normalizeEmail(email);
  if (usingKv) {
    try {
      const id = await get(emailKey(key));
      if (!id) return null;
      return parseUser(await get(userKey(id)));
    } catch (error) {
      console.error("findUserByEmail KV error", error);
      return null;
    }
  }
  return memUsersByEmail.get(key) ?? null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  if (usingKv) {
    try {
      return parseUser(await get(userKey(id)));
    } catch (error) {
      console.error("getUserById KV error", error);
      return null;
    }
  }
  return memUsersById.get(id) ?? null;
}

export async function listUserFavorites(
  userId: string,
): Promise<FavoriteCoin[]> {
  if (usingKv) {
    try {
      return parseFavorites(await get(favsKey(userId)));
    } catch (error) {
      console.error("listUserFavorites KV error", error);
      return [];
    }
  }
  const map = memFavorites.get(userId);
  return map ? Array.from(map.values()) : [];
}

export async function addUserFavorite(
  userId: string,
  fav: FavoriteCoin,
): Promise<void> {
  const entry: FavoriteCoin = {
    symbol: fav.symbol,
    name: fav.name,
    added_at: fav.added_at ?? new Date().toISOString(),
  };

  if (usingKv) {
    try {
      const list = parseFavorites(await get(favsKey(userId)));
      if (list.some((f) => f.symbol === entry.symbol)) return;
      list.push(entry);
      await set(favsKey(userId), JSON.stringify(list));
    } catch (error) {
      console.error("addUserFavorite KV error", error);
    }
    return;
  }

  if (!memFavorites.has(userId)) memFavorites.set(userId, new Map());
  const map = memFavorites.get(userId)!;
  if (!map.has(entry.symbol)) map.set(entry.symbol, entry);
}

export async function removeUserFavorite(
  userId: string,
  symbol: string,
): Promise<void> {
  if (usingKv) {
    try {
      const list = parseFavorites(await get(favsKey(userId)));
      const next = list.filter((f) => f.symbol !== symbol);
      if (next.length !== list.length) {
        await set(favsKey(userId), JSON.stringify(next));
      }
    } catch (error) {
      console.error("removeUserFavorite KV error", error);
    }
    return;
  }
  memFavorites.get(userId)?.delete(symbol);
}

// ---- Pro entitlement -------------------------------------------------------

/** A stored trial auto-converts to "active" once the trial window passes
 *  (mirrors the old model — for a class demo, no real billing). */
function normalizePro(raw: ProStatus | null): ProStatus {
  if (!raw || raw.state === "none") return NO_PRO;
  if (
    raw.state === "trial" &&
    raw.trialEndsAt &&
    Date.parse(raw.trialEndsAt) <= Date.now()
  ) {
    return { ...raw, state: "active", isPro: true };
  }
  // raw.state is "trial" | "active" here → always entitled.
  return { ...raw, isPro: true };
}

export async function getProStatus(userId: string): Promise<ProStatus> {
  if (usingKv) {
    try {
      const raw = await get(proKey(userId));
      return normalizePro(raw ? (JSON.parse(raw) as ProStatus) : null);
    } catch (error) {
      console.error("getProStatus KV error", error);
      return NO_PRO;
    }
  }
  return normalizePro(memPro.get(userId) ?? null);
}

/** Start the free trial (idempotent: keeps an existing active subscription). */
export async function startPro(userId: string): Promise<ProStatus> {
  const existing = await getProStatus(userId);
  if (existing.isPro) return existing;
  const now = new Date();
  const status: ProStatus = {
    isPro: true,
    state: "trial",
    since: now.toISOString(),
    trialEndsAt: new Date(
      now.getTime() + PRO_TRIAL_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString(),
  };
  if (usingKv) {
    try {
      await set(proKey(userId), JSON.stringify(status));
    } catch (error) {
      console.error("startPro KV error", error);
    }
  } else {
    memPro.set(userId, status);
  }
  return status;
}

export async function cancelPro(userId: string): Promise<void> {
  if (usingKv) {
    try {
      await del(proKey(userId));
    } catch (error) {
      console.error("cancelPro KV error", error);
    }
    return;
  }
  memPro.delete(userId);
}
