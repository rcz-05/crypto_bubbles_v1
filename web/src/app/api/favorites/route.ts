import { NextResponse } from "next/server";
import { authEnvironmentStatus } from "@/lib/auth/config";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  addUserFavorite,
  listUserFavorites,
  removeUserFavorite,
} from "@/lib/auth/store";
import { FavoriteCoin } from "@/lib/favorites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Favorites are now scoped to the signed-in user. Guests get a 401 and the
// client keeps their list in localStorage only (no more shared global list).
function guest() {
  return NextResponse.json(
    { error: "Sign in to sync favorites." },
    { status: 401 },
  );
}

function unavailable() {
  return NextResponse.json(
    {
      error: "Account favorites are temporarily unavailable because production auth storage is not configured.",
      code: "auth_not_configured",
    },
    { status: 503 },
  );
}

export async function GET() {
  if (!authEnvironmentStatus().ready) return unavailable();
  const user = await getCurrentUser();
  if (!user) return guest();
  return NextResponse.json(await listUserFavorites(user.id));
}

export async function POST(req: Request) {
  if (!authEnvironmentStatus().ready) return unavailable();
  const user = await getCurrentUser();
  if (!user) return guest();

  const body = (await req.json().catch(() => null)) as Partial<FavoriteCoin> | null;
  if (!body || !body.symbol || !body.name) {
    return NextResponse.json(
      { error: "symbol and name required" },
      { status: 400 },
    );
  }

  await addUserFavorite(user.id, {
    symbol: body.symbol,
    name: body.name,
    added_at: body.added_at ?? new Date().toISOString(),
  });
  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  if (!authEnvironmentStatus().ready) return unavailable();
  const user = await getCurrentUser();
  if (!user) return guest();

  const symbol = new URL(req.url).searchParams.get("symbol");
  if (!symbol) {
    return NextResponse.json({ error: "symbol required" }, { status: 400 });
  }
  await removeUserFavorite(user.id, symbol);
  return NextResponse.json({ ok: true });
}
