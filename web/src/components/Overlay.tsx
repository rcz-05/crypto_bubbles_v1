"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children into #overlay-root (declared in layout.tsx, OUTSIDE the
 * route-transition transform). This keeps position:fixed overlays anchored to
 * the viewport instead of .app-shell, and gives every blocking layer one
 * shared, predictable stacking parent.
 *
 * SSR-safe: renders nothing on the server / first client paint, then portals
 * one frame after mount. rAF (not a direct setState in the effect body) keeps
 * react-hooks/set-state-in-effect happy.
 */
export function Overlay({ children }: { children: React.ReactNode }) {
  const [root, setRoot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const id = window.requestAnimationFrame(() => {
      setRoot(document.getElementById("overlay-root"));
    });
    return () => window.cancelAnimationFrame(id);
  }, []);

  if (!root) return null;
  return createPortal(children, root);
}
