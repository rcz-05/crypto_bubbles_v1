/**
 * Resolve the authenticated user from the session cookie.
 * Server-only (uses next/headers). Safe to call in route handlers and
 * server components.
 */

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth/session";
import { getUserById, toPublicUser, type PublicUser } from "@/lib/auth/store";

export async function getSessionPayload() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

export async function getCurrentUser(): Promise<PublicUser | null> {
  const payload = await getSessionPayload();
  if (!payload) return null;
  const user = await getUserById(payload.sub);
  return user ? toPublicUser(user) : null;
}
