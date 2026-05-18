"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const CanvasIcon = (
  <svg {...ICON_PROPS}>
    <circle cx="8" cy="9" r="4.2" />
    <circle cx="17" cy="7" r="2.6" />
    <circle cx="15.5" cy="16" r="3.4" />
  </svg>
);
const SavedIcon = (
  <svg {...ICON_PROPS}>
    <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.9l-5.2 2.71.99-5.79-4.21-4.1 5.82-.85z" />
  </svg>
);
const SettingsIcon = (
  <svg {...ICON_PROPS}>
    <line x1="4" y1="7" x2="20" y2="7" />
    <circle cx="10" cy="7" r="2.4" fill="currentColor" stroke="none" />
    <line x1="4" y1="17" x2="20" y2="17" />
    <circle cx="15" cy="17" r="2.4" fill="currentColor" stroke="none" />
  </svg>
);
const AccountIcon = (
  <svg {...ICON_PROPS}>
    <circle cx="12" cy="8" r="3.5" />
    <path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
  </svg>
);

/**
 * Glass dock bottom nav with a gliding active capsule.
 * CSS hides it above 760px so the topbar remains desktop navigation.
 */
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const status = useAuthStore((s) => s.status);

  // Stable account tab: never disappears. Unknown shows a neutral label so
  // there's no Sign in -> Account flicker after the session resolves.
  const authed = status === "authenticated";
  const accountHref = authed ? "/settings" : "/login";
  const accountLabel =
    status === "unknown" ? "Account" : authed ? "Account" : "Sign in";

  const tabs = [
    { href: "/", label: "Canvas", icon: CanvasIcon, active: pathname === "/" },
    {
      href: "/favorites",
      label: "Saved",
      icon: SavedIcon,
      active: pathname.startsWith("/favorites"),
    },
    {
      href: "/settings",
      label: "Settings",
      icon: SettingsIcon,
      active: authed
        ? false // Settings == Account when signed in; let Account own it
        : pathname.startsWith("/settings"),
    },
    {
      href: accountHref,
      label: accountLabel,
      icon: AccountIcon,
      active: authed
        ? pathname.startsWith("/settings")
        : pathname.startsWith("/login") || pathname.startsWith("/register"),
    },
  ];

  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.active),
  );

  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(
    null,
  );

  useEffect(() => {
    const measure = () => {
      const nav = navRef.current;
      if (!nav) return;
      const items = nav.querySelectorAll<HTMLElement>(".bottom-nav-item");
      const el = items[activeIndex];
      if (!el) return;
      setPill({ left: el.offsetLeft, width: el.offsetWidth });
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [activeIndex, pathname, status]);

  return (
    <nav className="bottom-nav" aria-label="Primary" ref={navRef}>
      <span
        className="bottom-nav-indicator"
        aria-hidden
        style={
          pill
            ? {
                transform: `translateX(${pill.left}px)`,
                width: pill.width,
                opacity: 1,
              }
            : { opacity: 0 }
        }
      />
      {tabs.map((tab, i) => (
        <Link
          key={`${tab.href}-${i}`}
          href={tab.href}
          className={`bottom-nav-item${tab.active ? " active" : ""}`}
          aria-current={tab.active ? "page" : undefined}
        >
          {tab.icon}
          <span>{tab.label}</span>
        </Link>
      ))}
    </nav>
  );
}
