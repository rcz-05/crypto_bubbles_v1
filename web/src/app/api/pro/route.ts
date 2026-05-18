import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { cancelPro, getProStatus, startPro } from "@/lib/auth/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function guest() {
  return NextResponse.json(
    { error: "Create an account to start CoinCanvas Pro." },
    { status: 401 },
  );
}

/** Start the Pro free trial for the signed-in account. */
export async function POST() {
  const user = await getCurrentUser();
  if (!user) return guest();
  const pro = await startPro(user.id);
  return NextResponse.json({ pro }, { status: 201 });
}

/** Cancel Pro for the signed-in account. */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return guest();
  await cancelPro(user.id);
  return NextResponse.json({ pro: await getProStatus(user.id) });
}
