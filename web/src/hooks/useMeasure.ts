"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";

export function useMeasure<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  const observer = useRef<ResizeObserver>();

  const setRef = useCallback((node: T | null) => {
    if (observer.current && ref.current) {
      observer.current.unobserve(ref.current);
    }
    ref.current = node;
    if (node) {
      observer.current = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          setSize({ width, height });
        }
      });
      observer.current.observe(node);
    }
  }, []);

  useLayoutEffect(() => {
    return () => {
      if (observer.current && ref.current) {
        observer.current.unobserve(ref.current);
      }
    };
  }, []);

  return { ref: setRef, width: size.width, height: size.height };
}
