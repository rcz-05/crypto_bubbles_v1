import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useMeasure } from "../../web/src/hooks/useMeasure";

const resizeObserverState = vi.hoisted(() => ({
  callback: null as
    | ((
        entries: Array<{
          contentRect: { width: number; height: number };
        }>,
      ) => void)
    | null,
  unobserve: vi.fn(),
}));

beforeEach(() => {
  resizeObserverState.callback = null;
  resizeObserverState.unobserve.mockReset();

  Object.defineProperty(window, "ResizeObserver", {
    writable: true,
    value: class {
      constructor(
        callback: (
          entries: Array<{
            contentRect: { width: number; height: number };
          }>,
        ) => void,
      ) {
        resizeObserverState.callback = callback;
      }
      observe() {}
      unobserve = resizeObserverState.unobserve;
      disconnect() {}
    },
  });
});

describe("useMeasure", () => {
  it("tracks element size updates from ResizeObserver", () => {
    const { result } = renderHook(() => useMeasure<HTMLDivElement>());
    const node = document.createElement("div");

    act(() => {
      result.current.ref(node);
    });

    act(() => {
      resizeObserverState.callback?.([
        {
          contentRect: { width: 720, height: 480 },
        },
      ]);
    });

    expect(result.current.width).toBe(720);
    expect(result.current.height).toBe(480);
  });
});
