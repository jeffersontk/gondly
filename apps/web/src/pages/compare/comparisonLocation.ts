export type ComparisonLocation = { latitude: number; longitude: number; accuracy: number };
export type LocatedComparisonRegion = {
  location: ComparisonLocation;
  region: { city: string; state: string; neighborhood: string };
  regionResolved: boolean;
};

export async function locateComparisonRegion(
  geolocation: Pick<Geolocation, "getCurrentPosition">,
  reverseGeocode: (location: ComparisonLocation) => Promise<{ city: string | null; state: string | null; neighborhood: string | null }>,
): Promise<LocatedComparisonRegion> {
  const location = await requestComparisonLocation(geolocation);
  try {
    const result = await reverseGeocode(location);
    const region = { city: result.city ?? "", state: result.state ?? "", neighborhood: result.neighborhood ?? "" };
    return { location, region, regionResolved: Boolean(region.city && region.state) };
  } catch {
    return { location, region: { city: "", state: "", neighborhood: "" }, regionResolved: false };
  }
}

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
