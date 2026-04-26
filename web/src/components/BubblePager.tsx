"use client";

import type { TimeFrame } from "@/lib/coingecko";

type Props = {
  page: number;
  totalPages: number;
  timeFrame: TimeFrame;
  onChange: (next: number) => void;
};

const PAGE_LABELS = ["Top movers", "Next 25", "Next 25", "Smallest"] as const;
const PAGE_LABELS_MARKETCAP = [
  "Largest caps",
  "Mid caps",
  "Lower mid caps",
  "Small caps",
] as const;

function pageLabel(page: number, timeFrame: TimeFrame): string {
  const labels =
    timeFrame === "market_cap" ? PAGE_LABELS_MARKETCAP : PAGE_LABELS;
  return labels[Math.min(page, labels.length - 1)];
}

export function BubblePager({ page, totalPages, timeFrame, onChange }: Props) {
  if (totalPages <= 1) return null;

  return (
    <div className="bubble-pager" role="group" aria-label="Bubble board pages">
      <button
        type="button"
        className="bubble-pager-chev"
        onClick={() => onChange(page - 1)}
        disabled={page === 0}
        aria-label="Previous page"
      >
        <ChevronIcon direction="left" />
      </button>

      <div className="bubble-pager-center">
        <span className="bubble-pager-label">{pageLabel(page, timeFrame)}</span>
        <div className="bubble-pager-dots" aria-hidden>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`bubble-pager-dot${i === page ? " active" : ""}`}
              onClick={() => onChange(i)}
              aria-label={`Go to page ${i + 1}`}
            />
          ))}
        </div>
        <span className="bubble-pager-count">
          {page + 1} / {totalPages}
        </span>
      </div>

      <button
        type="button"
        className="bubble-pager-chev"
        onClick={() => onChange(page + 1)}
        disabled={page === totalPages - 1}
        aria-label="Next page"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {direction === "left" ? (
        <polyline points="14 6 8 12 14 18" />
      ) : (
        <polyline points="10 6 16 12 10 18" />
      )}
    </svg>
  );
}
