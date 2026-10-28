export function calculateStepDistanceMeters(steps: number, strideLengthMeters = 0.75): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.round(steps * strideLengthMeters);
}

export function calculateStepCalories(steps: number, caloriesPerStep = 0.04): number {
  if (!Number.isFinite(steps) || steps <= 0) return 0;
  return Math.round(steps * caloriesPerStep);
}

export function formatStepDistance(meters: number): string {
  if (!Number.isFinite(meters) || meters <= 0) return "0 m";
  if (meters < 1000) return `${Math.round(meters)} m`;
  const km = (meters / 1000).toFixed(2).replace(".", ",");
  return `${km} km`;
}

/**
 * Basic peak detection helper for accelerometer magnitude.
 * Evaluates whether an acceleration magnitude peak crosses dynamic threshold
 * after normal gravity component baseline subtraction.
 */
export function isStepPeak(
  currentMagnitude: number,
  previousMagnitude: number,
  peakThresholdG = 1.15,
  gravityBaseline = 9.80665,
): boolean {
  const thresholdMps2 = peakThresholdG * gravityBaseline;
  return currentMagnitude > thresholdMps2 && previousMagnitude <= thresholdMps2;
}

