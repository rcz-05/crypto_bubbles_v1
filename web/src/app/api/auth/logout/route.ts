import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearedSessionCookie } from "@/lib/auth/session";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST() {
  const jar = await cookies();
  jar.set(clearedSessionCookie());
  return NextResponse.json({ ok: true });
}
