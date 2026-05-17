/**
 * Auth + per-user favorites persistence.
 *
 * Uses Vercel Postgres when POSTGRES_* env vars are present, and falls back
 * to an in-memory store otherwise (mirrors the pattern in
 * src/app/api/favorites/route.ts so the app runs locally without a DB).
 *
 * Server-only: never import from a "use client" file.
 */

import { randomUUID } from "crypto";
import { sql } from "@vercel/postgres";
import { postgresConfigured } from "@/lib/auth/config";
import type { FavoriteCoin } from "@/lib/favorites";

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

export const hasDb =
  postgresConfigured();

// ---- In-memory fallback (per server process) -------------------------------
const memUsersById = new Map<string, UserRecord>();
const memUsersByEmail = new Map<string, UserRecord>();
const memFavorites = new Map<string, Map<string, FavoriteCoin>>();

let tablesReady = false;

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

async function ensureTables(): Promise<void> {
  if (!hasDb || tablesReady) return;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id text PRIMARY KEY,
    email text UNIQUE NOT NULL,
    password_hash text NOT NULL,
    display_name text,
    created_at timestamptz NOT NULL DEFAULT now()
  );`;
  await sql`CREATE TABLE IF NOT EXISTS user_favorites (
    user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    symbol text NOT NULL,
    name text NOT NULL,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, symbol)
  );`;
  tablesReady = true;
}

type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string | null;
  created_at: string;
};

function rowToUser(r: UserRow): UserRecord {
  return {
    id: r.id,
    email: r.email,
    passwordHash: r.password_hash,
    displayName: r.display_name,
    createdAt:
      typeof r.created_at === "string"
        ? r.created_at
        : new Date(r.created_at).toISOString(),
  };
}

/** Create a user. Returns null if the email is already registered. */
export async function createUser(params: {
  email: string;
  passwordHash: string;
  displayName?: string | null;
}): Promise<UserRecord | null> {
  const email = normalizeEmail(params.email);
  const id = randomUUID();
  const displayName = params.displayName?.trim() || null;
  const createdAt = new Date().toISOString();

  if (hasDb) {
    try {
      await ensureTables();
      const { rows } = await sql<UserRow>`
        INSERT INTO users (id, email, password_hash, display_name, created_at)
        VALUES (${id}, ${email}, ${params.passwordHash}, ${displayName}, ${createdAt})
        ON CONFLICT (email) DO NOTHING
        RETURNING id, email, password_hash, display_name, created_at;`;
      if (rows.length === 0) return null; // email taken
      return rowToUser(rows[0]);
    } catch (error) {
      console.error("createUser DB error", error);
      return null;
    }
  }

  if (memUsersByEmail.has(email)) return null;
  const rec: UserRecord = {
    id,
    email,
    passwordHash: params.passwordHash,
    displayName,
    createdAt,
  };
  memUsersById.set(id, rec);
  memUsersByEmail.set(email, rec);
  return rec;
}

export async function findUserByEmail(
  email: string,
): Promise<UserRecord | null> {
  const key = normalizeEmail(email);
  if (hasDb) {
    try {
      await ensureTables();
      const { rows } = await sql<UserRow>`
        SELECT id, email, password_hash, display_name, created_at
        FROM users WHERE email = ${key} LIMIT 1;`;
      return rows[0] ? rowToUser(rows[0]) : null;
    } catch (error) {
      console.error("findUserByEmail DB error", error);
      return null;
    }
  }
  return memUsersByEmail.get(key) ?? null;
}

export async function getUserById(id: string): Promise<UserRecord | null> {
  if (hasDb) {
    try {
      await ensureTables();
      const { rows } = await sql<UserRow>`
        SELECT id, email, password_hash, display_name, created_at
        FROM users WHERE id = ${id} LIMIT 1;`;
      return rows[0] ? rowToUser(rows[0]) : null;
    } catch (error) {
      console.error("getUserById DB error", error);
      return null;
    }
  }
  return memUsersById.get(id) ?? null;
}

export async function listUserFavorites(
  userId: string,
): Promise<FavoriteCoin[]> {
  if (hasDb) {
    try {
      await ensureTables();
      const { rows } = await sql<{
        symbol: string;
        name: string;
        added_at: string;
      }>`SELECT symbol, name, added_at FROM user_favorites
         WHERE user_id = ${userId} ORDER BY added_at DESC;`;
      return rows.map((r) => ({
        symbol: r.symbol,
        name: r.name,
        added_at:
          typeof r.added_at === "string"
            ? r.added_at
            : new Date(r.added_at).toISOString(),
      }));
    } catch (error) {
      console.error("listUserFavorites DB error", error);
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
  const addedAt = fav.added_at ?? new Date().toISOString();
  if (hasDb) {
    try {
      await ensureTables();
      await sql`INSERT INTO user_favorites (user_id, symbol, name, added_at)
        VALUES (${userId}, ${fav.symbol}, ${fav.name}, ${addedAt})
        ON CONFLICT (user_id, symbol) DO NOTHING;`;
      return;
    } catch (error) {
      console.error("addUserFavorite DB error", error);
      return;
    }
  }
  if (!memFavorites.has(userId)) memFavorites.set(userId, new Map());
  const map = memFavorites.get(userId)!;
  if (!map.has(fav.symbol)) {
    map.set(fav.symbol, { ...fav, added_at: addedAt });
  }
}

export async function removeUserFavorite(
  userId: string,
  symbol: string,
): Promise<void> {
  if (hasDb) {
    try {
      await ensureTables();
      await sql`DELETE FROM user_favorites
        WHERE user_id = ${userId} AND symbol = ${symbol};`;
      return;
    } catch (error) {
      console.error("removeUserFavorite DB error", error);
      return;
    }
  }
  memFavorites.get(userId)?.delete(symbol);
}
