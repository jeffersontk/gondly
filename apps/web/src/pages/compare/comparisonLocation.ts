export type ComparisonLocation = { latitude: number; longitude: number; accuracy: number };

export function comparisonRegionParams(region: { city: string; state: string; neighborhood: string }, location: ComparisonLocation | null, radiusKm: number): Record<string, string> {
  return location
    ? { latitude: String(location.latitude), longitude: String(location.longitude), radiusKm: String(radiusKm) }
    : region;
}

export function requestComparisonLocation(geolocation: Pick<Geolocation, "getCurrentPosition">): Promise<ComparisonLocation> {
  return new Promise((resolve, reject) => geolocation.getCurrentPosition(
    ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy }),
    reject,
    { enableHighAccuracy: true, timeout: 15_000, maximumAge: 0 },
  ));
}
