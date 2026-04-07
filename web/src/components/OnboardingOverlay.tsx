"use client";

import { useCallback, useEffect, useState } from "react";
import { trackEvent } from "@/lib/telemetry";

const STORAGE_KEY = "coincanvas-onboarding-seen";

const steps = [
  {
    title: "Welcome to CoinCanvas",
    body: "This is a live market scanner that shows the top 100 cryptocurrencies as bubbles. No prior crypto knowledge required.",
  },
  {
    title: "Reading the board",
    body: "Each bubble is a cryptocurrency. Green means the price went up, red means it went down. Bigger bubbles are the top movers for the selected timeframe. Gold, silver, and bronze outlines mark the #1, #2, and #3 biggest gainers and losers. An orange dashed outline flags volatile low-cap coins.",
  },
  {
    title: "Understanding a mover",
    body: "Tap any bubble to open its context card. You'll see a plain-language explanation of why it's moving, risk indicators, and links to verified sources. The explanation is clearly separated from the raw market data.",
  },
  {
    title: "Time-frame toggles",
    body: "Use the 1H / 24H / 7D / 30D / Market Cap buttons above the board to change what drives bubble size. This lets you spot fast movers that might be hidden when sizing by market cap alone.",
  },
  {
    title: "You're ready",
    body: "Start scanning the board. Tap a bubble when you're curious. The context layer will do the explaining. You can always revisit this guide from Settings.",
  },
];

export function OnboardingOverlay() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  const dismiss = useCallback(() => {
    trackEvent({
      type: "onboarding_completed",
      recordedAt: new Date().toISOString(),
      payload: { stepsViewed: step + 1 },
    });
    setVisible(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, "true");
    }
  }, [step]);

  const next = useCallback(() => {
    if (step < steps.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  if (!visible) return null;

  const current = steps[step];
  const isLast = step === steps.length - 1;

  return (
    <div className="onboarding-backdrop" onClick={dismiss}>
      <div className="onboarding-card" onClick={(e) => e.stopPropagation()}>
        <div className="onboarding-progress">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`onboarding-dot ${i === step ? "active" : ""} ${i < step ? "done" : ""}`}
            />
          ))}
        </div>

        <h2 className="onboarding-title">{current.title}</h2>
        <p className="onboarding-body">{current.body}</p>

        <div className="onboarding-actions">
          {step > 0 ? (
            <button className="refresh-btn secondary" onClick={prev} type="button">
              Back
            </button>
          ) : (
            <button className="refresh-btn secondary" onClick={dismiss} type="button">
              Skip
            </button>
          )}
          <button className="refresh-btn" onClick={next} type="button">
            {isLast ? "Start scanning" : "Next"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function resetOnboarding() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}
