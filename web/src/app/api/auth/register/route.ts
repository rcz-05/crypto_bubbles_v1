import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import { sessionCookie, createSessionToken } from "@/lib/auth/session";
import {
  addUserFavorite,
  createUser,
  toPublicUser,
} from "@/lib/auth/store";
import type { FavoriteCoin } from "@/lib/favorites";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  let body: {
    email?: string;
    password?: string;
    displayName?: string;
    guestFavorites?: FavoriteCoin[];
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";

  if (!EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "Enter a valid email address." },
      { status: 400 },
    );
  }
  if (password.length < 8 || password.length > 200) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 },
    );
  }

  const user = await createUser({
    email,
    passwordHash: hashPassword(password),
    displayName: body.displayName ?? null,
  });

  if (!user) {
    return NextResponse.json(
      { error: "An account with that email already exists." },
      { status: 409 },
    );
  }

  // Seed any favorites the visitor built up as a guest.
  if (Array.isArray(body.guestFavorites)) {
    for (const f of body.guestFavorites.slice(0, 200)) {
      if (f && typeof f.symbol === "string" && typeof f.name === "string") {
        await addUserFavorite(user.id, {
          symbol: f.symbol,
          name: f.name,
          added_at: f.added_at,
        });
      }
    }
  }

  const jar = await cookies();
  jar.set(sessionCookie(createSessionToken(user.id, user.email)));

  return NextResponse.json({ user: toPublicUser(user) }, { status: 201 });
}
