"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Coin } from "@/lib/coingecko";
import {
  buildPeerBenchmark,
  buildVolatilityProfile,
} from "@/lib/peer-benchmark";
import { computeProSignal } from "@/lib/pro-signal";
import { useMarketStore } from "@/store/market";
import { useAuthStore } from "@/store/auth";
import { trackEvent } from "@/lib/telemetry";
import { ProInsightsCard } from "@/components/ProInsightsCard";
import { ProUpgradeSheet } from "@/components/ProUpgradeSheet";

/**
 * Renders the Pro signal (account holders) or an upsell (everyone else).
 * The signal is computed client-side from the already-loaded market
 * universe — no extra API, fully deterministic.
 */
export function ProSection({ coin }: { coin: Coin }) {
  const coins = useMarketStore((s) => s.coins);
  const pro = useAuthStore((s) => s.pro);
  const status = useAuthStore((s) => s.status);
  const subscribePro = useAuthStore((s) => s.subscribePro);
  const [sheetOpen, setSheetOpen] = useState(false);

  const data = useMemo(() => {
    if (coins.length < 3) return null;
    const benchmark = buildPeerBenchmark(coin, coins);
    const volatility = buildVolatilityProfile(coin, benchmark);
    const signal = computeProSignal({
      coin,
      benchmark,
      volatility,
      sentimentUpPct: null,
    });
    return { benchmark, volatility, signal };
  }, [coin, coins]);

  const isPro = Boolean(pro?.isPro);

  const viewedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isPro || !data) return;
    const key = `${coin.symbol}:${data.signal.verdict}`;
    if (viewedRef.current === key) return;
    viewedRef.current = key;
    trackEvent({
      type: "pro_signal_viewed",
      recordedAt: new Date().toISOString(),
      payload: { symbol: coin.symbol, verdict: data.signal.verdict },
    });
  }, [isPro, data, coin.symbol]);

  if (!data) return null;

  if (isPro) {
    return (
      <ProInsightsCard
        signal={data.signal}
        benchmark={data.benchmark}
        volatility={data.volatility}
      />
    );
  }

  return (
    <>
      <section className="context-card pro-upsell">
        <div className="pro-upsell-glow" aria-hidden />
        <p className="section-label pro-eyebrow">CoinCanvas Pro</p>
        <h3>Unlock the multi-factor signal</h3>
        <p className="pro-upsell-copy">
          A weighted BUY / HODL / SELL read across momentum, relative
          strength, liquidity, peer benchmark and volatility — built from the
          same verified market data.
        </p>
        <button
          type="button"
          className="refresh-btn pro-upsell-cta"
          onClick={() => setSheetOpen(true)}
        >
          {status === "authenticated"
            ? "Start free trial"
            : "Get CoinCanvas Pro"}
        </button>
      </section>

      <ProUpgradeSheet
        open={sheetOpen}
        authed={status === "authenticated"}
        onClose={() => setSheetOpen(false)}
        onSubscribe={subscribePro}
      />
    </>
  );
}
