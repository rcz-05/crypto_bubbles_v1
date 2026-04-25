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
        ◀
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
        ▶
      </button>
    </div>
  );
}
