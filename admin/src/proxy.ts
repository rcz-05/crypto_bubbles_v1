import { NextRequest, NextResponse } from "next/server";
import {
  ADMIN_COOKIE,
  ADMIN_COOKIE_MAX_AGE,
  constantTimeEquals,
  getAdminKey,
} from "@/lib/auth";

export const config = {
  matcher: ["/((?!_next/|favicon.ico|api/health).*)"],
};

const PUBLIC_PATHS = ["/unauthorized"];

export function proxy(req: NextRequest) {
  const { pathname, searchParams } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  const expected = getAdminKey();
  if (!expected) {
    return rewriteUnauthorized(req);
  }

  const cookieValue = req.cookies.get(ADMIN_COOKIE)?.value ?? null;
  const queryKey = searchParams.get("key");

  if (cookieValue && constantTimeEquals(cookieValue, expected)) {
    return NextResponse.next();
  }

  if (queryKey && constantTimeEquals(queryKey, expected)) {
    const url = req.nextUrl.clone();
    url.searchParams.delete("key");
    const res = NextResponse.redirect(url);
    res.cookies.set({
      name: ADMIN_COOKIE,
      value: expected,
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
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
