import { renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  requestMotionPermission,
  useShakeRefresh,
} from "../../web/src/hooks/useShakeRefresh";

function dispatchMotion(x: number, y: number, z: number) {
  const event = new Event("devicemotion") as Event & {
    accelerationIncludingGravity?: { x: number; y: number; z: number };
  };
  event.accelerationIncludingGravity = { x, y, z };
  window.dispatchEvent(event);
}

describe("useShakeRefresh", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fires the shake callback only when the threshold is crossed outside the cooldown window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-16T12:00:00.000Z"));
    const onShake = vi.fn();

    renderHook(() => useShakeRefresh(onShake));

    dispatchMotion(5, 5, 5);
    expect(onShake).not.toHaveBeenCalled();

    dispatchMotion(16, 16, 16);
    expect(onShake).toHaveBeenCalledTimes(1);

    dispatchMotion(16, 16, 16);
    expect(onShake).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_501);
    dispatchMotion(16, 16, 16);
    expect(onShake).toHaveBeenCalledTimes(2);
  });

  it("requests motion permission when the browser requires it", async () => {
    const requestPermission = vi.fn().mockResolvedValue("granted");
    Object.defineProperty(window, "DeviceMotionEvent", {
      writable: true,
      value: { requestPermission },
    });

    await expect(requestMotionPermission()).resolves.toBe(true);
    expect(requestPermission).toHaveBeenCalledTimes(1);
  });

  it("returns false when the browser denies motion permission", async () => {
    const requestPermission = vi.fn().mockResolvedValue("denied");
    Object.defineProperty(window, "DeviceMotionEvent", {
      writable: true,
      value: { requestPermission },
    });

    await expect(requestMotionPermission()).resolves.toBe(false);
  });

  it("defaults to true when no explicit permission model is required", async () => {
    Object.defineProperty(window, "DeviceMotionEvent", {
      writable: true,
      value: undefined,
    });

    await expect(requestMotionPermission()).resolves.toBe(true);
  });
});
