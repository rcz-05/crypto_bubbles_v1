"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuthStore } from "@/store/auth";

type Tab = {
  href: string;
  label: string;
  icon: React.ReactNode;
  match: (pathname: string) => boolean;
};

const ICON_PROPS = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const TABS: Tab[] = [
  {
    href: "/",
    label: "Canvas",
    match: (p) => p === "/",
    icon: (
      <svg {...ICON_PROPS}>
        <circle cx="8" cy="9" r="4.2" />
        <circle cx="17" cy="7" r="2.6" />
        <circle cx="15.5" cy="16" r="3.4" />
      </svg>
    ),
  },
  {
    href: "/favorites",
    label: "Saved",
    match: (p) => p.startsWith("/favorites"),
    icon: (
      <svg {...ICON_PROPS}>
        <path d="M12 3.6l2.6 5.27 5.82.85-4.21 4.1.99 5.79L12 16.9l-5.2 2.71.99-5.79-4.21-4.1 5.82-.85z" />
      </svg>
    ),
  },
  {
    href: "/settings",
    label: "Settings",
    match: (p) => p.startsWith("/settings"),
    icon: (
      <svg {...ICON_PROPS}>
        <line x1="4" y1="7" x2="20" y2="7" />
        <circle cx="10" cy="7" r="2.4" fill="currentColor" stroke="none" />
        <line x1="4" y1="17" x2="20" y2="17" />
        <circle cx="15" cy="17" r="2.4" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

/**
 * Fixed bottom tab bar. Rendered once in the root layout; CSS hides it
 * above 760px so the topbar remains the desktop navigation.
 */
export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const status = useAuthStore((s) => s.status);
  const accountHref = status === "authenticated" ? "/settings" : "/login";
  const accountLabel = status === "authenticated" ? "Account" : "Sign in";
  const accountActive = status === "authenticated"
    ? pathname.startsWith("/settings")
    : pathname.startsWith("/login") || pathname.startsWith("/register");

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`bottom-nav-item${active ? " active" : ""}`}
            aria-current={active ? "page" : undefined}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </Link>
        );
      })}
      <Link
        href={accountHref}
        className={`bottom-nav-item${accountActive ? " active" : ""}`}
        aria-current={accountActive ? "page" : undefined}
      >
        <svg {...ICON_PROPS}>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20c1.4-4 4-6 7-6s5.6 2 7 6" />
        </svg>
        <span>{accountLabel}</span>
      </Link>
    </nav>
  );
}
