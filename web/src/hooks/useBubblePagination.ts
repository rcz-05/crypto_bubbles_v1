"use client";

import { useEffect, useMemo, useState } from "react";
import { Coin, TimeFrame, getChangeForTimeFrame } from "@/lib/coingecko";

const MOBILE_QUERY = "(max-width: 760px)";
const PAGE_SIZE = 25;
const MAX_PAGES = 4;

function sortForTimeframe(coins: Coin[], timeFrame: TimeFrame): Coin[] {
  if (timeFrame === "market_cap") {
    return [...coins].sort((a, b) => (b.market_cap ?? 0) - (a.market_cap ?? 0));
  }
  return [...coins].sort(
    (a, b) =>
      Math.abs(getChangeForTimeFrame(b, timeFrame)) -
      Math.abs(getChangeForTimeFrame(a, timeFrame)),
  );
}

export type BubblePagination = {
  pagedCoins: Coin[];
  page: number;
  totalPages: number;
  isMobile: boolean;
  setPage: (next: number) => void;
};

export function useBubblePagination(
  coins: Coin[],
  timeFrame: TimeFrame,
): BubblePagination {
  const [isMobile, setIsMobile] = useState(false);
  const [page, setPageState] = useState(0);

  // Track viewport width so we render full board on desktop, paged on mobile.
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(MOBILE_QUERY);
    const apply = () => setIsMobile(mql.matches);
    apply();
    mql.addEventListener?.("change", apply);
    return () => mql.removeEventListener?.("change", apply);
  }, []);

  // Snap back to page 0 whenever timeframe or input set changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPageState(0);
  }, [timeFrame, coins.length]);

  const sorted = useMemo(
    () => sortForTimeframe(coins, timeFrame),
    [coins, timeFrame],
  );

  const totalPages = useMemo(() => {
    if (!isMobile) return 1;
    if (sorted.length === 0) return 1;
    return Math.min(MAX_PAGES, Math.ceil(sorted.length / PAGE_SIZE));
  }, [isMobile, sorted.length]);

  const pagedCoins = useMemo(() => {
    if (!isMobile) return sorted;
    const safePage = Math.min(page, totalPages - 1);
    const start = safePage * PAGE_SIZE;
    return sorted.slice(start, start + PAGE_SIZE);
  }, [isMobile, page, sorted, totalPages]);

  const setPage = (next: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, next));
    setPageState(clamped);
  };

  return { pagedCoins, page, totalPages, isMobile, setPage };
}
