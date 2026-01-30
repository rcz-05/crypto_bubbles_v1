"use client";

type Props = {
  options: string[];
  active: string;
  onChange: (value: string) => void;
};

export function HeaderTabs({ options, active, onChange }: Props) {
  return (
    <div className="tab-row">
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
