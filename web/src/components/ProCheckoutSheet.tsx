"use client";

import { useCallback, useEffect, useState } from "react";
import {
  PRO_PRICE_USD,
  PRO_TRIAL_DAYS,
  activatePro,
} from "@/lib/pro-status";
import { trackEvent } from "@/lib/telemetry";
import type { Variant } from "@/lib/variant";

type Source = "coin_modal" | "settings";

type Props = {
  open: boolean;
  variant: Variant;
  source: Source;
  symbol?: string;
  onClose: () => void;
};

type Phase = "review" | "authorizing" | "success";

export function ProCheckoutSheet({
  open,
  variant,
  source,
  symbol,
  onClose,
}: Props) {
  const [phase, setPhase] = useState<Phase>("review");

  const close = useCallback(
    (canceled: boolean) => {
      if (canceled && phase === "review") {
        trackEvent({
          type: "pro_checkout_canceled",
          recordedAt: new Date().toISOString(),
          payload: { variant, source, ...(symbol ? { symbol } : {}) },
        });
      }
      setPhase("review");
      onClose();
    },
    [onClose, phase, source, symbol, variant],
  );

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase !== "authorizing") close(true);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [close, open, phase]);

  const handleAuthorize = useCallback(() => {
    setPhase("authorizing");
    window.setTimeout(() => {
      activatePro({ withTrial: true });
      setPhase("success");
      window.setTimeout(() => {
        onClose();
        setPhase("review");
      }, 1100);
    }, 1500);
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="apay-backdrop"
      onClick={(e) => {
        e.stopPropagation();
        if (phase !== "authorizing") close(true);
      }}
      role="presentation"
    >
      <div
        className={`apay-sheet phase-${phase}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="apay-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="apay-grabber" aria-hidden />

        <div className="apay-header">
          <div className="apay-logo">
            <span className="apay-logo-glyph" aria-hidden></span>
            <span className="apay-logo-text">Pay</span>
          </div>
          <button
            type="button"
            className="apay-cancel"
            onClick={() => close(true)}
            disabled={phase === "authorizing"}
          >
            Cancel
          </button>
        </div>

        <div className="apay-merchant-row">
          <div>
            <div className="apay-merchant-name" id="apay-title">
              CoinCanvas
            </div>
            <div className="apay-merchant-domain">coincanvas-app.vercel.app</div>
          </div>
          <div className="apay-amount">
            <span>${PRO_PRICE_USD}.00</span>
            <small>per month after trial</small>
          </div>
        </div>

        <div className="apay-row-stack">
          <div className="apay-row">
            <span>Pay</span>
            <strong>CoinCanvas Pro</strong>
          </div>
          <div className="apay-row">
            <span>Trial</span>
            <strong>{PRO_TRIAL_DAYS} days free</strong>
          </div>
          <div className="apay-row">
            <span>Then</span>
            <strong>${PRO_PRICE_USD}.00 / month</strong>
          </div>
          <div className="apay-row">
            <span>Card</span>
            <div className="apay-card-pill">
              <span className="apay-card-brand">VISA</span>
              <span className="apay-card-digits">···· 4242</span>
            </div>
          </div>
        </div>

        <p className="apay-disclosure">
          Prototype — no real charge. This sheet simulates an Apple Pay flow for
          a class demo. No card data is collected or stored.
        </p>

        {phase === "review" ? (
          <button
            type="button"
            className="apay-confirm"
            onClick={handleAuthorize}
          >
            <span className="apay-confirm-icon" aria-hidden>
              ●●
            </span>
            <span className="apay-confirm-label">
              Double-click to confirm trial
            </span>
          </button>
        ) : null}

        {phase === "authorizing" ? (
          <div className="apay-status">
            <span className="apay-spinner" aria-hidden />
            <span>Authorizing…</span>
          </div>
        ) : null}

        {phase === "success" ? (
          <div className="apay-status apay-status-success">
            <span className="apay-check" aria-hidden>
              ✓
            </span>
            <span>You&apos;re now on Pro · trial active</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
