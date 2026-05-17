import { NextResponse } from "next/server";
import { authEnvironmentStatus } from "@/lib/auth/config";
import { kvAvailable } from "@/lib/kv";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const auth = authEnvironmentStatus();
  const status = {
    ok: auth.ready,
    app: "web",
    checkedAt: new Date().toISOString(),
    commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
    environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "unknown",
    auth,
    telemetry: {
      kvReady: kvAvailable(),
    },
  };

  return NextResponse.json(status, {
    status: status.ok ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
