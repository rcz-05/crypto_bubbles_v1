"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  options: string[];
  active: string;
  onChange: (value: string) => void;
};

export function HeaderTabs({ options, active, onChange }: Props) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState({ left: 0, width: 0 });

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const idx = options.indexOf(active);
    const btn = row.children[idx + 1] as HTMLElement | undefined; // +1 for the pill span
    if (!btn) return;
    setPill({ left: btn.offsetLeft, width: btn.offsetWidth });
  }, [active, options]);

  return (
    <div className="tab-row" ref={rowRef}>
      <span
        className="tab-pill"
        style={{
          transform: `translateX(${pill.left}px)`,
          width: pill.width,
        }}
      />
      {options.map((opt) => (
        <button
          key={opt}
          className={`tab-chip ${opt === active ? "active" : ""}`}
          onClick={() => onChange(opt)}
          type="button"
        >
          {opt}
        </button>
      ))}
    </div>
  );
}
