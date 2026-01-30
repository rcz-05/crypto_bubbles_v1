"use client";

import { useEffect } from "react";

const SHAKE_THRESHOLD = 22; // magnitude
const COOLDOWN_MS = 1500;

export function useShakeRefresh(onShake: () => void) {
  useEffect(() => {
    let last = 0;
    function handler(event: DeviceMotionEvent) {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;
      const x = acc.x ?? 0;
      const y = acc.y ?? 0;
      const z = acc.z ?? 0;
      const magnitude = Math.sqrt(x * x + y * y + z * z);
      const now = Date.now();
      if (magnitude > SHAKE_THRESHOLD && now - last > COOLDOWN_MS) {
        last = now;
        onShake();
      }
    }

    window.addEventListener("devicemotion", handler);
    return () => window.removeEventListener("devicemotion", handler);
  }, [onShake]);
}

export async function requestMotionPermission(): Promise<boolean> {
  const anyWindow = window as typeof window & {
    DeviceMotionEvent?: {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
  };
  if (
    anyWindow.DeviceMotionEvent &&
    typeof anyWindow.DeviceMotionEvent.requestPermission === "function"
  ) {
    try {
      const result = await anyWindow.DeviceMotionEvent.requestPermission();
      return result === "granted";
    } catch {
      return false;
    }
  }
  return true; // permission model not required
}
