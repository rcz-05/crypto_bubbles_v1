import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  constantTimeEquals,
  getAdminKey,
} from "@/lib/auth";

export const config = {
  // Run on everything except Next internals + static files.
  matcher: ["/((?!_next/|favicon.ico|api/health).*)"],
};

const PUBLIC_PATHS = ["/unauthorized"];

export function middleware(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const expected = getAdminKey();
  if (!expected) {
    // No key configured — block everything until env is set.
    return rewriteUnauthorized(req);
  }

  const cookieValue = req.cookies.get(ADMIN_COOKIE)?.value ?? null;
  const queryKey = searchParams.get("key");

  // Cookie path: already authed, allow.
  if (cookieValue && constantTimeEquals(cookieValue, expected)) {
    return NextResponse.next();
  }

  // Query path: check + set cookie + scrub key from URL.
  if (queryKey && constantTimeEquals(queryKey, expected)) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set({
      name: ADMIN_COOKIE,
      value: expected,
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      maxAge: ADMIN_COOKIE_MAX_AGE,
      path: "/",
    });
    return res;
  }

  return rewriteUnauthorized(req);
}

function rewriteUnauthorized(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = "/unauthorized";
  url.search = "";
  return NextResponse.rewrite(url);
}
