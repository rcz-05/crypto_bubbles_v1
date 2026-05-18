import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getProStatus } from "@/lib/auth/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  const pro = user ? await getProStatus(user.id) : null;
  return NextResponse.json({ user: user ?? null, pro });
}
