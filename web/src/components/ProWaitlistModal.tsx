"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/telemetry";
import type { Variant } from "@/lib/variant";

type PremiumSource = "coin_modal" | "settings";

type Props = {
  open: boolean;
  variant: Variant;
  source: PremiumSource;
  symbol?: string;
  onClose: () => void;
};

export function ProWaitlistModal({
  open,
  variant,
  source,
  symbol,
  onClose,
}: Props) {
  const [email, setEmail] = useState("");

  const close = useCallback(() => {
    setEmail("");
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close, open]);

  if (!open) return null;

  const submit = (providedEmail: boolean) => {
    const trimmed = email.trim();
    trackEvent({
      type: "premium_waitlist_submitted",
      recordedAt: new Date().toISOString(),
      payload: {
        variant,
        source,
        providedEmail: providedEmail && trimmed.length > 0,
        ...(symbol ? { symbol } : {}),
        ...(providedEmail && trimmed ? { email: trimmed } : {}),
      },
    });
    close();
  };

  return (
    <div
      className="pro-modal-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        close();
      }}
    >
      <div
        className="pro-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pro-waitlist-title"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          className="survey-close pro-modal-close"
          type="button"
          aria-label="Close Pro waitlist"
          onClick={close}
        >
          X
        </button>

        <p className="section-label">CoinCanvas Pro</p>
        <h2 id="pro-waitlist-title">Pro is in beta</h2>
        <p className="pro-modal-copy">
          Pro features aren&apos;t built yet - your interest helps us prioritize.
          No payment is collected in this Sprint 5 prototype.
        </p>

        <div className="pro-beta-disclosure">
          Wizard-of-Oz disclosure: the deeper insight preview is locked to test
          demand for a future paid tier, not because the paid feature exists.
        </div>

        <label className="pro-email-field">
          <span>Email (optional)</span>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>

        <div className="pro-modal-actions">
          <button
            className="refresh-btn"
            type="button"
            onClick={() => submit(true)}
          >
            Join waitlist
          </button>
          <button
            className="refresh-btn secondary"
            type="button"
            onClick={() => submit(false)}
          >
            Skip email
          </button>
        </div>
      </div>
    </div>
  );
}
