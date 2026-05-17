"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth";

/**
 * Resolves the session once on app start (GET /api/auth/me) and routes the
 * favorites store into guest vs account mode. Renders nothing.
 */
export function AuthBootstrap() {
  const loadSession = useAuthStore((s) => s.loadSession);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    if (status === "unknown") void loadSession();
  }, [status, loadSession]);

  return null;
}
