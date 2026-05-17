import { NextResponse } from "next/server";
import { getAdminKey } from "@/lib/auth";
import { kvAvailable } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const adminAuthReady = Boolean(getAdminKey());
  const kvReady = kvAvailable();
  const ok = adminAuthReady && kvReady;

  return NextResponse.json(
    {
      ok,
      app: "admin",
      checkedAt: new Date().toISOString(),
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
      adminAuth: { ready: adminAuthReady },
      telemetry: { kvReady },
    },
    {
      status: ok ? 200 : 503,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
