import { useCallback, useEffect, useRef, useState } from "react";
import { calculateStepCalories, calculateStepDistanceMeters, formatStepDistance } from "@gondly/utils";

export type StepCounterStatus =
  | "idle"
  | "unsupported"
  | "permission_required"
  | "permission_denied"
  | "counting"
  | "paused";

export type StepCounterState = {
  steps: number;
  status: StepCounterStatus;
  distanceMeters: number;
  distanceLabel: string;
  calories: number;
  isAvailable: boolean;
  canRequestPermission: boolean;
};

const MIN_STEP_INTERVAL_MS = 280; // ~3.5 steps/sec max
const ACCEL_THRESHOLD_GRAVITY = 11.8; // m/s² for accelerationIncludingGravity
const ACCEL_THRESHOLD_LINEAR = 2.2; // m/s² for linear acceleration

export function getStoredPurchaseSteps(purchaseId: string): number {
  if (typeof window === "undefined" || !purchaseId) return 0;
  try {
    const raw = sessionStorage.getItem(`gondly.steps.${purchaseId}`);
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setStoredPurchaseSteps(purchaseId: string, steps: number): void {
  if (typeof window === "undefined" || !purchaseId) return;
  try {
    sessionStorage.setItem(`gondly.steps.${purchaseId}`, String(Math.max(0, Math.round(steps))));
  } catch {
    // Ignore storage quota errors
  }
}

export function clearStoredPurchaseSteps(purchaseId: string): void {
  if (typeof window === "undefined" || !purchaseId) return;
  try {
    sessionStorage.removeItem(`gondly.steps.${purchaseId}`);
  } catch {
    // Ignore
  }
}

export function usePurchaseStepCounter(purchaseId: string) {
  const [steps, setSteps] = useState<number>(() => getStoredPurchaseSteps(purchaseId));
  const [status, setStatus] = useState<StepCounterStatus>("idle");
  const lastStepTimeRef = useRef<number>(0);
  const wasAboveRef = useRef<boolean>(false);
  const isCountingRef = useRef<boolean>(false);

  // Sync steps with session storage
  useEffect(() => {
    if (purchaseId) {
      setStoredPurchaseSteps(purchaseId, steps);
    }
  }, [purchaseId, steps]);

  const hasMotionApi = typeof window !== "undefined" && "DeviceMotionEvent" in window;
  const isIosPermissionRequired =
    hasMotionApi &&
    typeof (window as unknown as { DeviceMotionEvent?: { requestPermission?: unknown } }).DeviceMotionEvent?.requestPermission === "function";

  const handleMotion = useCallback((event: DeviceMotionEvent) => {
    if (!isCountingRef.current) return;

    let magnitude = 0;
    let threshold = ACCEL_THRESHOLD_GRAVITY;

    if (event.acceleration && event.acceleration.x != null && event.acceleration.y != null && event.acceleration.z != null) {
      const { x, y, z } = event.acceleration;
      magnitude = Math.sqrt(x * x + y * y + z * z);
      threshold = ACCEL_THRESHOLD_LINEAR;
    } else if (event.accelerationIncludingGravity && event.accelerationIncludingGravity.x != null) {
      const { x, y, z } = event.accelerationIncludingGravity;
      magnitude = Math.sqrt((x || 0) * (x || 0) + (y || 0) * (y || 0) + (z || 0) * (z || 0));
      threshold = ACCEL_THRESHOLD_GRAVITY;
    } else {
      return;
    }

    const now = Date.now();
    const isAbove = magnitude > threshold;

    // Detect upward peak transition with refractory cooldown
    if (isAbove && !wasAboveRef.current) {
      if (now - lastStepTimeRef.current >= MIN_STEP_INTERVAL_MS) {
        lastStepTimeRef.current = now;
        setSteps((prev) => prev + 1);
      }
    }
    wasAboveRef.current = isAbove;
  }, []);

  const start = useCallback(async () => {
    if (!hasMotionApi) {
      setStatus("unsupported");
      return;
    }

    if (isIosPermissionRequired) {
      try {
        const reqPerm = (window as unknown as { DeviceMotionEvent: { requestPermission: () => Promise<string> } }).DeviceMotionEvent.requestPermission;
        const permissionState = await reqPerm();
        if (permissionState !== "granted") {
          setStatus("permission_denied");
          return;
        }
      } catch {
        setStatus("permission_denied");
        return;
      }
    }

    isCountingRef.current = true;
    setStatus("counting");
    window.addEventListener("devicemotion", handleMotion, true);
  }, [hasMotionApi, isIosPermissionRequired, handleMotion]);

  const pause = useCallback(() => {
    isCountingRef.current = false;
    setStatus("paused");
    window.removeEventListener("devicemotion", handleMotion, true);
  }, [handleMotion]);

  const resume = useCallback(() => {
    isCountingRef.current = true;
    setStatus("counting");
    window.addEventListener("devicemotion", handleMotion, true);
  }, [handleMotion]);

  const reset = useCallback(() => {
    isCountingRef.current = false;
    window.removeEventListener("devicemotion", handleMotion, true);
    setSteps(0);
    setStatus("idle");
    if (purchaseId) clearStoredPurchaseSteps(purchaseId);
  }, [handleMotion, purchaseId]);

  const setManualSteps = useCallback(
    (count: number) => {
      const safe = Math.max(0, Math.round(count));
      setSteps(safe);
    },
    [],
  );

  useEffect(() => {
    return () => {
      window.removeEventListener("devicemotion", handleMotion, true);
    };
  }, [handleMotion]);

  const distanceMeters = calculateStepDistanceMeters(steps);
  const distanceLabel = formatStepDistance(distanceMeters);
  const calories = calculateStepCalories(steps);

  return {
    steps,
    status,
    distanceMeters,
    distanceLabel,
    calories,
    isAvailable: hasMotionApi,
    canRequestPermission: isIosPermissionRequired,
    start,
    pause,
    resume,
    reset,
    setManualSteps,
  };
}

