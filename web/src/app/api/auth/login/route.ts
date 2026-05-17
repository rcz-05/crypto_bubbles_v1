import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { authEnvironmentStatus } from "@/lib/auth/config";
import { verifyPassword } from "@/lib/auth/password";
import { sessionCookie, createSessionToken } from "@/lib/auth/session";
import { findUserByEmail, toPublicUser } from "@/lib/auth/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function unavailable() {
  return NextResponse.json(
    {
      error: "Accounts are temporarily unavailable because production auth storage is not configured.",
      code: "auth_not_configured",
    },
    { status: 503 },
  );
}

export async function POST(req: Request) {
  if (!authEnvironmentStatus().ready) return unavailable();

  let body: { email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();
  const password = body.password ?? "";
  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required." },
      { status: 400 },
    );
  }

  const user = await findUserByEmail(email);
  // Generic message + always run a verify to avoid leaking which emails exist.
  const ok = user
    ? verifyPassword(password, user.passwordHash)
    : verifyPassword(password, "scrypt$16384$8$1$AAAA$AAAA");

  if (!user || !ok) {
    return NextResponse.json(
      { error: "Incorrect email or password." },
      { status: 401 },
    );
  }

  const jar = await cookies();
  jar.set(sessionCookie(createSessionToken(user.id, user.email)));

  return NextResponse.json({ user: toPublicUser(user) });
}
