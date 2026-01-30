import { NextResponse } from "next/server";
import { sql } from "@vercel/postgres";
import { FavoriteCoin } from "@/lib/favorites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const hasDb =
  Boolean(process.env.POSTGRES_URL) ||
  Boolean(process.env.POSTGRES_PRISMA_URL) ||
  Boolean(process.env.POSTGRES_USER);

const memory = new Map<string, FavoriteCoin>();

async function ensureTable() {
  if (!hasDb) return;
  await sql`CREATE TABLE IF NOT EXISTS favorite_coins (
    id serial PRIMARY KEY,
    symbol text UNIQUE NOT NULL,
    name text NOT NULL,
    added_at timestamptz DEFAULT now()
  );`;
}

export async function GET() {
  if (hasDb) {
    try {
      await ensureTable();
      const { rows } =
        await sql<FavoriteCoin>`SELECT symbol, name, added_at FROM favorite_coins ORDER BY added_at DESC`;
      return NextResponse.json(rows);
    } catch (error) {
      console.error("Favorites GET error", error);
      // fall through to memory
    }
  }
  return NextResponse.json(Array.from(memory.values()));
}

export async function POST(req: Request) {
  const body = (await req.json()) as Partial<FavoriteCoin>;
  if (!body.symbol || !body.name) {
    return NextResponse.json({ error: "symbol and name required" }, { status: 400 });
  }

  if (hasDb) {
    try {
      await ensureTable();
      await sql`INSERT INTO favorite_coins(symbol, name) VALUES(${body.symbol}, ${body.name}) ON CONFLICT (symbol) DO NOTHING;`;
      return NextResponse.json({ ok: true }, { status: 201 });
    } catch (error) {
      console.error("Favorites POST error", error);
      // fall back to memory
    }
  }

  memory.set(body.symbol, { symbol: body.symbol, name: body.name, added_at: new Date().toISOString() });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }

  if (hasDb) {
    try {
      await ensureTable();
      await sql`DELETE FROM favorite_coins WHERE symbol = ${symbol};`;
      return NextResponse.json({ ok: true });
    } catch (error) {
      console.error("Favorites DELETE error", error);
      // fall back to memory
    }
  }

  memory.delete(symbol);
  return NextResponse.json({ ok: true });
}
