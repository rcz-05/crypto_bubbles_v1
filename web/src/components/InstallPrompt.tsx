"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/telemetry";
import { Overlay } from "@/components/Overlay";

const DISMISS_KEY = "cc_install_dismissed_at";
const ONBOARDING_KEY = "coincanvas-onboarding-seen";
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000; // re-ask after 14 days

/** Don't compete with the first-run onboarding for the screen. */
function onboardingPending(): boolean {
  try {
    return !localStorage.getItem(ONBOARDING_KEY);
  } catch {
    return false;
  }
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches === true ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function recentlyDismissed(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Number.isFinite(at) && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function isIos(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const iOS = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ reports as Mac; detect touch + Safari.
  const iPadOS =
    navigator.platform === "MacIntel" &&
    (navigator as unknown as { maxTouchPoints?: number }).maxTouchPoints !== undefined &&
    (navigator as unknown as { maxTouchPoints: number }).maxTouchPoints > 1;
  return iOS || iPadOS;
}

/**
 * Low-friction install affordance:
 *  - Chromium/Android: captures beforeinstallprompt and offers a one-tap
 *    custom "Install" button (native UI is suppressed otherwise).
 *  - iOS Safari: a one-time, dismissible "Add to Home Screen" hint (Apple
 *    exposes no install API).
 * Hidden when already installed, recently dismissed, or on auth pages.
 */
export function InstallPrompt() {
  const pathname = usePathname() ?? "/";
  const [platform, setPlatform] = useState<"android" | "ios" | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  const close = useCallback((action: "accepted" | "dismissed") => {
    setPlatform((p) => {
      if (p) {
        trackEvent({
          type: "pwa_install",
          recordedAt: new Date().toISOString(),
          payload: { platform: p, action },
        });
      }
      return null;
    });
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (isStandalone() || recentlyDismissed() || onboardingPending()) return;
    if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
      return;
    }

    const onBip = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setPlatform("android");
    };
    const onInstalled = () => close("accepted");

    window.addEventListener("beforeinstallprompt", onBip);
    window.addEventListener("appinstalled", onInstalled);

    // iOS has no beforeinstallprompt — show the manual hint instead.
    let iosTimer: number | undefined;
    if (isIos()) {
      iosTimer = window.setTimeout(() => setPlatform("ios"), 1200);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBip);
      window.removeEventListener("appinstalled", onInstalled);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, [pathname, close]);

  // Fire a single "shown" event when a banner first appears.
  useEffect(() => {
    if (!platform) return;
    trackEvent({
      type: "pwa_install",
      recordedAt: new Date().toISOString(),
      payload: { platform, action: "shown" },
    });
  }, [platform]);

  const onAndroidInstall = useCallback(async () => {
    if (!deferred) return;
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      close(choice.outcome === "accepted" ? "accepted" : "dismissed");
    } catch {
      close("dismissed");
    } finally {
      setDeferred(null);
    }
  }, [deferred, close]);

  if (!platform) return null;

  return (
    <Overlay>
    <div className="install-prompt" role="dialog" aria-label="Install CoinCanvas">
      <span className="install-prompt-dot" aria-hidden />
      <div className="install-prompt-copy">
        <strong>Install CoinCanvas</strong>
        {platform === "android" ? (
          <span>Add it to your phone for a full-screen, app-like experience.</span>
        ) : (
          <span>
            Tap the Share icon, then <em>Add to Home Screen</em> to install.
          </span>
        )}
      </div>
      {platform === "android" ? (
        <button
          type="button"
          className="refresh-btn install-prompt-cta"
          onClick={onAndroidInstall}
        >
          Install
        </button>
      ) : null}
      <button
        type="button"
        className="install-prompt-x"
        aria-label="Dismiss"
        onClick={() => close("dismissed")}
      >
        ✕
      </button>
    </div>
    </Overlay>
  );
}
