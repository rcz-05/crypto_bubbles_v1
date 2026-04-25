import { NextResponse } from "next/server";
import { get, kvAvailable } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const FORCE_VARIANT_KEY = "admin:force_variant";
const PRO_OVERRIDE_KEY = "admin:pro_override";

export async function GET() {
  if (!kvAvailable()) {
    return NextResponse.json({
      forceVariant: null,
      proOverride: false,
    });
  }

  const [variant, pro] = await Promise.all([
    get(FORCE_VARIANT_KEY),
    get(PRO_OVERRIDE_KEY),
  ]);

  return NextResponse.json(
    {
      forceVariant: variant === "a" || variant === "b" ? variant : null,
      proOverride: pro === "1",
    },
    {
      headers: {
        "Cache-Control": "s-maxage=15, stale-while-revalidate=30",
      },
    },
  );
}
