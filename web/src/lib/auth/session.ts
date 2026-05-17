/**
 * Stateless session token: base64url(JSON payload).base64url(HMAC-SHA256).
 * No external dependency. Server-only.
 *
 * Set AUTH_SECRET in the environment for production. Without it, a built-in
 * dev-only secret is used (sessions won't survive a secret change / new
 * deploy, and are NOT secure for real users) and a warning is logged.
 */

import { createHmac, timingSafeEqual } from "crypto";
import {
  AUTH_SECRET_MIN_LENGTH,
  authSecretConfigured,
  isProductionRuntime,
} from "@/lib/auth/config";

export const SESSION_COOKIE = "cc_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (seconds)

const DEV_FALLBACK_SECRET = "coincanvas-dev-insecure-secret-change-me";
let warnedAboutSecret = false;

export type SessionPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

function getSecret(): string {
  const s = process.env.AUTH_SECRET;
  if (authSecretConfigured() && s) return s;
  if (isProductionRuntime()) {
    throw new Error(
      `AUTH_SECRET must be set to at least ${AUTH_SECRET_MIN_LENGTH} characters in production.`,
    );
  }
  if (!warnedAboutSecret) {
    warnedAboutSecret = true;
    console.warn(
      `[auth] AUTH_SECRET is missing or too short — using an insecure built-in fallback. Set AUTH_SECRET (>=${AUTH_SECRET_MIN_LENGTH} chars) in the environment.`,
    );
  }
  return DEV_FALLBACK_SECRET;
}

function sign(data: string): string {
  return createHmac("sha256", getSecret()).update(data).digest("base64url");
}

export function createSessionToken(sub: string, email: string): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    sub,
    email,
    iat: now,
    exp: now + SESSION_MAX_AGE,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
): SessionPayload | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let expected: string;
  try {
    expected = sign(body);
  } catch {
    return null;
  }
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString(),
    ) as SessionPayload;
    if (
      typeof payload.sub !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

type CookieOptions = {
  httpOnly: true;
  secure: boolean;
  sameSite: "lax";
  path: "/";
  maxAge: number;
};

function baseCookieOptions(maxAge: number): CookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge,
  };
}

/** Args for cookies().set(...) — establishes the session. */
export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    ...baseCookieOptions(SESSION_MAX_AGE),
  };
}

/** Args for cookies().set(...) — clears the session. */
export function clearedSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: "",
    ...baseCookieOptions(0),
  };
}
