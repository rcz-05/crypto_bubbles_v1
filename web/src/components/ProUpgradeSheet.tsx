"use client";

import { useState } from "react";
import Link from "next/link";
import { Overlay } from "@/components/Overlay";
import { PRO_PRICE_USD, PRO_TRIAL_DAYS } from "@/lib/pro-constants";

const FEATURES = [
  "Multi-factor BUY / HODL / SELL signal",
  "Weighted momentum, relative strength & liquidity",
  "Peer-cohort benchmark + volatility profile",
];

export function ProUpgradeSheet({
  open,
  authed,
  onClose,
  onSubscribe,
}: {
  open: boolean;
  authed: boolean;
  onClose: () => void;
  onSubscribe: () => Promise<{ ok: true } | { ok: false; error: string }>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function start() {
    if (busy) return;
    setError(null);
    setBusy(true);
    const r = await onSubscribe();
    setBusy(false);
    if (r.ok) onClose();
    else setError(r.error);
  }

  return (
    <Overlay>
      <div
        className="pro-sheet-backdrop"
        onClick={onClose}
        role="dialog"
        aria-label="CoinCanvas Pro"
      >
        <div
          className="pro-sheet"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="modal-close-x pro-sheet-x"
            aria-label="Close"
            onClick={onClose}
          >
            ✕
          </button>

          <p className="section-label pro-eyebrow">CoinCanvas Pro</p>
          <h2 className="pro-sheet-title">
            {authed
              ? "Unlock the multi-factor signal"
              : "Create an account to go Pro"}
          </h2>
          <p className="pro-sheet-price">
            ${PRO_PRICE_USD}/mo · {PRO_TRIAL_DAYS}-day free trial
          </p>

          <ul className="pro-sheet-features">
            {FEATURES.map((f) => (
              <li key={f}>
                <span className="pro-tick" aria-hidden>
                  ✓
                </span>
                {f}
              </li>
            ))}
          </ul>

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}

          {authed ? (
            <button
              type="button"
              className="refresh-btn pro-sheet-cta"
              onClick={start}
              disabled={busy}
            >
              {busy ? "Starting…" : `Start ${PRO_TRIAL_DAYS}-day free trial`}
            </button>
          ) : (
            <div className="pro-sheet-auth">
              <Link href="/register" className="refresh-btn pro-sheet-cta">
                Create free account
              </Link>
              <Link href="/login" className="refresh-btn secondary">
                Sign in
              </Link>
            </div>
          )}

          <p className="pro-disclaimer">
            A class-project simulation — no real payment is taken. Cancel
            anytime from Settings.
          </p>
        </div>
      </div>
    </Overlay>
  );
}
