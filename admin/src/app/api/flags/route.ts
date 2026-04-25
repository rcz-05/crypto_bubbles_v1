import { NextResponse } from "next/server";
import { del, get, kvAvailable, set } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORCE_VARIANT_KEY = "admin:force_variant";
const PRO_OVERRIDE_KEY = "admin:pro_override";

export type AdminFlags = {
  forceVariant: "a" | "b" | null;
  proOverride: boolean;
};

async function readFlags(): Promise<AdminFlags> {
  const [variant, pro] = await Promise.all([
    get(FORCE_VARIANT_KEY),
    get(PRO_OVERRIDE_KEY),
  ]);
  const forceVariant = variant === "a" || variant === "b" ? variant : null;
  return { forceVariant, proOverride: pro === "1" };
}

export async function GET() {
  if (!kvAvailable()) {
    return NextResponse.json({ error: "kv_unavailable" }, { status: 503 });
  }
  return NextResponse.json(await readFlags(), {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(req: Request) {
  if (!kvAvailable()) {
    return NextResponse.json({ error: "kv_unavailable" }, { status: 503 });
  }

  let body: { forceVariant?: unknown; proOverride?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (body.forceVariant === "a" || body.forceVariant === "b") {
    await set(FORCE_VARIANT_KEY, body.forceVariant);
  } else if (body.forceVariant === null || body.forceVariant === "clear") {
    await del(FORCE_VARIANT_KEY);
  }

  if (body.proOverride === true) {
    await set(PRO_OVERRIDE_KEY, "1");
  } else if (body.proOverride === false) {
    await del(PRO_OVERRIDE_KEY);
  }

  return NextResponse.json(await readFlags());
}
