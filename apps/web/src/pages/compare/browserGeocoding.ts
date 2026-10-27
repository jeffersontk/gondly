import type { ReverseGeocodeResult } from "../../types";
import type { ComparisonLocation } from "./comparisonLocation";

type Region = Pick<ReverseGeocodeResult, "city" | "state" | "neighborhood">;

// This free endpoint is client-only and must only receive fresh, consented GPS
// coordinates. Never call it from the backend, on page load, or for arbitrary places.
export async function reverseGeocodeForComparison(
  location: ComparisonLocation,
  preferred: (location: ComparisonLocation) => Promise<Region>,
  fetcher: typeof fetch = fetch,
): Promise<Region> {
  try {
    const result = await preferred(location);
    if (result.city && result.state) return result;
  } catch {
    // Missing Google key/billing must not prevent identifying the current region.
  }

  const query = new URLSearchParams({ latitude: String(location.latitude), longitude: String(location.longitude), localityLanguage: "pt" });
  const response = await fetcher(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query}`, {
    credentials: "omit",
    signal: AbortSignal.timeout(8_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Não foi possível identificar a região.");
  const data = await response.json();
  const text = (value: unknown): string | null => typeof value === "string" && value.trim() ? value.trim() : null;
  const normalized = (value: string | null) => (value ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
  const isRegionalArea = (value: string | null) => /^regiao (metropolitana|geografica|integrada)/.test(normalized(value));
  const administrative: Array<{ name?: unknown; adminLevel?: unknown }> = Array.isArray(data.localityInfo?.administrative)
    ? data.localityInfo.administrative.filter((entry: unknown) => entry !== null && typeof entry === "object")
    : [];
  const isBrazil = data.countryCode === "BR" || text(data.principalSubdivisionCode)?.startsWith("BR-");
  // In Brazil level 8 is the municipality; metropolitan areas can appear in
  // the provider's top-level city field, while locality can be the municipality.
  const municipality = isBrazil ? text(administrative.find(entry => entry.adminLevel === 8)?.name) : null;
  const reportedCity = text(data.city);
  const locality = text(data.locality);
  const city = municipality ?? (isBrazil && isRegionalArea(reportedCity) ? locality : reportedCity) ?? locality;
  const state = text(data.principalSubdivisionCode)?.replace(/^[A-Z]{2}-/, "") ?? null;
  const detailedNeighborhood = isBrazil ? text(administrative.find(entry => entry.adminLevel === 10)?.name) : null;
  const localityIsBroaderArea = administrative.some(entry => normalized(text(entry.name)) === normalized(locality) && typeof entry.adminLevel === "number" && entry.adminLevel <= 8);
  const candidate = detailedNeighborhood ?? (!localityIsBroaderArea ? locality : null);
  const neighborhood = candidate && normalized(candidate) !== normalized(city) && !isRegionalArea(candidate) ? candidate : null;
  if (!city || !state) throw new Error("Não foi possível identificar a região.");
  return { city, state, neighborhood };
}
