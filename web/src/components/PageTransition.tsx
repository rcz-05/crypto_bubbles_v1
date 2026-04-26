"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const PREV_PATH_KEY = "coincanvas-prev-path";

const ROUTE_ORDER: Record<string, number> = {
  "/": 0,
  "/favorites": 1,
  "/settings": 2,
};

type Direction = "fade" | "left" | "right";

function computeDirection(currentPath: string): Direction {
  if (typeof window === "undefined") return "fade";
  const prev = window.sessionStorage.getItem(PREV_PATH_KEY);
  if (!prev || prev === currentPath) return "fade";
  const cur = ROUTE_ORDER[currentPath];
  const old = ROUTE_ORDER[prev];
  if (cur == null || old == null) return "fade";
  if (cur > old) return "right";
  if (cur < old) return "left";
  return "fade";
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Compute direction synchronously on every mount so the first paint
  // already has the correct slide class. With key={pathname} this hook
  // re-runs on each navigation.
  const [direction] = useState<Direction>(() => computeDirection(pathname));

  // Persist current path so the NEXT navigation knows where we came from.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem(PREV_PATH_KEY, pathname);
  }, [pathname]);

  return (
    <div
      key={pathname}
      className={`page-transition slide-${direction}`}
      suppressHydrationWarning
    >
      {children}
    </div>
  );
}
