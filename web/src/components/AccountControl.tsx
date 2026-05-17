"use client";

import Link from "next/link";
import { useAuthStore } from "@/store/auth";

/**
 * Compact topbar account affordance.
 * - guest  -> "Sign in"
 * - authed -> display name / email, links to Settings (account management)
 * - unknown (session not yet resolved) -> render nothing to avoid a flash
 */
export function AccountControl() {
  const status = useAuthStore((s) => s.status);
  const user = useAuthStore((s) => s.user);

  if (status === "authenticated" && user) {
    const label = user.displayName?.trim() || user.email;
    return (
      <Link href="/settings" className="nav-link account-chip" title="Account">
        {label}
      </Link>
    );
  }
  if (status === "guest") {
    return (
      <Link href="/login" className="nav-link">
        Sign in
      </Link>
    );
  }
  return null;
}
