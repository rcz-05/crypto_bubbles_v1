"use client";

import { useEffect } from "react";

/**
 * Registers /sw.js once per session in production builds. Skipped in dev so
 * Next.js HMR isn't fighting cached app-shell responses.
 */
export function ServiceWorkerProvider() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .catch(() => {
          // Registration failed — fall through to non-PWA behaviour silently.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }
  }, []);

  return null;
}
