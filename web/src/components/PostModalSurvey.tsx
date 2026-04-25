"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/telemetry";
import type { Variant } from "@/lib/variant";

export type SurveyRequest = {
  id: string;
  symbol: string;
  variant: Variant;
};

type Props = {
  request: SurveyRequest | null;
  onDone: () => void;
};

const LAST_SHOWN_KEY = "coincanvas-survey-last-shown";
const SURVEY_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_DISMISS_MS = 30 * 1000;

function canUseSessionStorage() {
  return typeof window !== "undefined" && Boolean(window.sessionStorage);
}

function canShowSurvey() {
  if (!canUseSessionStorage()) return false;
  const raw = window.sessionStorage.getItem(LAST_SHOWN_KEY);
  const lastShown = raw ? Number(raw) : 0;
  return !Number.isFinite(lastShown) || Date.now() - lastShown >= SURVEY_INTERVAL_MS;
}

function markSurveyShown() {
  if (!canUseSessionStorage()) return;
  window.sessionStorage.setItem(LAST_SHOWN_KEY, String(Date.now()));
}

export function PostModalSurvey({ request, onDone }: Props) {
  const [active, setActive] = useState<SurveyRequest | null>(null);
  const [clarity, setClarity] = useState<0 | 1 | 2 | null>(null);
  const [trust, setTrust] = useState<1 | 2 | 3 | 4 | 5 | null>(null);

  useEffect(() => {
    if (!request) return;
    if (!canShowSurvey()) {
      onDone();
      return;
    }

    const timer = window.setTimeout(() => {
      markSurveyShown();
      setActive(request);
      setClarity(null);
      setTrust(null);
      trackEvent({
        type: "survey_shown",
        recordedAt: new Date().toISOString(),
        payload: { variant: request.variant, symbol: request.symbol },
      });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [onDone, request]);

  const close = useCallback(
    (reason: "skip" | "timeout") => {
      if (!active) return;
      trackEvent({
        type: "survey_dismissed",
        recordedAt: new Date().toISOString(),
        payload: {
          variant: active.variant,
          symbol: active.symbol,
          reason,
        },
      });
      setActive(null);
      onDone();
    },
    [active, onDone],
  );

  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => close("timeout"), AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [active, close]);

  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close("skip");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, close]);

  useEffect(() => {
    if (!active || clarity == null || trust == null) return;
    const timer = window.setTimeout(() => {
      setActive(null);
      onDone();
    }, 650);
    return () => window.clearTimeout(timer);
  }, [active, clarity, onDone, trust]);

  if (!active) return null;

  const handleClarity = (value: 0 | 1 | 2) => {
    if (clarity != null) return;
    setClarity(value);
    trackEvent({
      type: "comprehension_rated",
      recordedAt: new Date().toISOString(),
      payload: { variant: active.variant, symbol: active.symbol, value },
    });
  };

  const handleTrust = (value: 1 | 2 | 3 | 4 | 5) => {
    if (trust != null) return;
    setTrust(value);
    trackEvent({
      type: "trust_rated",
      recordedAt: new Date().toISOString(),
      payload: { variant: active.variant, symbol: active.symbol, value },
    });
  };

  return (
    <div className="survey-toast" role="dialog" aria-modal="false" aria-labelledby="survey-title">
      <button
        className="survey-close"
        type="button"
        aria-label="Skip survey"
        onClick={() => close("skip")}
      >
        X
      </button>

      <div className="survey-head">
        <p className="section-label">Quick read check</p>
        <h3 id="survey-title">{active.symbol.toUpperCase()} explanation</h3>
      </div>

      <div className="survey-question">
        <span>How clear was that explanation?</span>
        <div className="survey-options clear-options">
          {[
            { label: "Vague", value: 0 as const },
            { label: "OK", value: 1 as const },
            { label: "Clear", value: 2 as const },
          ].map((option) => (
            <button
              key={option.value}
              type="button"
              className={clarity === option.value ? "is-selected" : ""}
              onClick={() => handleClarity(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="survey-question">
        <span>How much do you trust it?</span>
        <div className="survey-options star-options" aria-label="Trust rating">
          {([1, 2, 3, 4, 5] as const).map((value) => (
            <button
              key={value}
              type="button"
              className={trust != null && value <= trust ? "is-selected" : ""}
              onClick={() => handleTrust(value)}
              aria-label={`${value} star${value === 1 ? "" : "s"}`}
            >
              ★
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
