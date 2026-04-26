"use client";

import { useVariant } from "@/lib/variant";

export function VariantBadge() {
  const variant = useVariant();
  return (
    <span
      className={`variant-badge variant-${variant}`}
      aria-label={`Active variant: ${variant === "a" ? "A — Standard" : "B — ELI5"}`}
      title={
        variant === "a"
          ? "Variant A · Standard analyst voice"
          : "Variant B · Plain-English (ELI5) voice"
      }
    >
      {variant.toUpperCase()}
    </span>
  );
}
