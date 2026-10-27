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
  const city = text(data.city) ?? text(data.locality);
  const state = text(data.principalSubdivisionCode)?.replace(/^[A-Z]{2}-/, "") ?? null;
  const locality = text(data.locality);
  const neighborhood = locality && locality.toLocaleLowerCase("pt-BR") !== city?.toLocaleLowerCase("pt-BR") ? locality : null;
  if (!city || !state) throw new Error("Não foi possível identificar a região.");
  return { city, state, neighborhood };
}
