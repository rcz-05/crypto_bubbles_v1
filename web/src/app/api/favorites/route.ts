import { NextResponse } from "next/server";
import { kv } from "@vercel/kv";
import { sql } from "@vercel/postgres";
import { FavoriteCoin } from "@/lib/favorites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// --- Configuration Checks ---
const hasKv = Boolean(process.env.KV_REST_API_URL) && Boolean(process.env.KV_REST_API_TOKEN);
const hasDb =
  Boolean(process.env.POSTGRES_URL) ||
  Boolean(process.env.POSTGRES_PRISMA_URL) ||
  Boolean(process.env.POSTGRES_USER);

// --- In-Memory Fallback ---
const memory = new Map<string, FavoriteCoin>();
const MEMORY_KEY = "favs"; // simplified memory storage for demo if needed, but Map is better per-instance

// --- Postgres Helpers (Legacy / Secondary) ---
async function ensureTable() {
  if (!hasDb) return;
  await sql`CREATE TABLE IF NOT EXISTS favorite_coins (
    id serial PRIMARY KEY,
    symbol text UNIQUE NOT NULL,
    name text NOT NULL,
    added_at timestamptz DEFAULT now()
  );`;
}

// --- Route Handlers ---

export async function GET() {
  // 1. Try Vercel KV
  if (hasKv) {
    try {
      // We store favorites as a Hash for easy lookups or a Set? 
      // User request: "Store favorites as a set/list (e.g., key: 'favorites' -> JSON array, or a Redis set)"
      // Let's use a Redis Set of strings for symbols, and maybe a separate hash for metadata if needed?
      // Simpler: Just a JSON list at key "favorites". 
      // But concurrent edits might be tricky. 
      // Let's use a HASH where key=symbol, value=JSON-stringified metadata.
      const favoritesHash = await kv.hgetall<Record<string, FavoriteCoin>>("favorites");
      if (favoritesHash) {
        // hgetall returns object { symbol: { ...data } }
        const list = Object.values(favoritesHash).sort((a, b) => 
           (b.added_at ?? "").localeCompare(a.added_at ?? "")
        );
        return NextResponse.json(list);
      }
      return NextResponse.json([]); 
    } catch (e) {
      console.error("KV GET Error:", e);
      // Fall through to DB
    }
  }

  // 2. Try Postgres
  if (hasDb) {
    try {
      await ensureTable();
      const { rows } = await sql<FavoriteCoin>`SELECT symbol, name, added_at FROM favorite_coins ORDER BY added_at DESC`;
      return NextResponse.json(rows);
    } catch (error) {
      console.error("Favorites DB GET error", error);
      // Fall through to memory
    }
  }

  // 3. Memory
  return NextResponse.json(Array.from(memory.values()));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<FavoriteCoin>;
  if (!body.symbol || !body.name) {
    return NextResponse.json({ error: "symbol and name required" }, { status: 400 });
  }

  const newFav: FavoriteCoin = {
    symbol: body.symbol,
    name: body.name,
    added_at: new Date().toISOString(),
  };

  // 1. Vercel KV
  if (hasKv) {
    try {
      await kv.hset("favorites", { [body.symbol]: newFav });
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (e) {
      console.error("KV POST Error:", e);
      // Fall through
    }
  }

  // 2. Postgres
  if (hasDb) {
    try {
      await ensureTable();
      await sql`INSERT INTO favorite_coins(symbol, name, added_at) VALUES(${body.symbol}, ${body.name}, ${newFav.added_at}) ON CONFLICT (symbol) DO NOTHING;`;
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (error) {
      console.error("Favorites POST error", error);
      // Fall through
    }
  }

  // 3. Memory
  memory.set(body.symbol, newFav);
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  // 1. Vercel KV
  if (hasKv) {
    try {
      await kv.hdel("favorites", symbol);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("KV DELETE Error:", e);
      // Fall through
    }
  }

  // 2. Postgres
  if (hasDb) {
    try {
      await ensureTable();
      await sql`DELETE FROM favorite_coins WHERE symbol = ${symbol};`;
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("Favorites DELETE error", error);
      // Fall through
    }
  }

  // 3. Memory
  memory.delete(symbol);
  return NextResponse.json({ ok: true });
}
