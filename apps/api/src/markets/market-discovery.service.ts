import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { NearbyMarketQueryDto } from "./dto";

type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
export type DiscoveredMarket = {
  placeId: string; name: string; latitude: number; longitude: number; distanceKm: number;
  address?: string; neighborhood?: string; city?: string; state?: string; country?: string; postalCode?: string;
};

@Injectable()
export class MarketDiscoveryService {
  private readonly cache = new Map<string, { expires: number; value: Promise<Element[]> }>();
  private activeRequest = false;

  constructor(private readonly config: ConfigService) {}

  async discover(query: NearbyMarketQueryDto): Promise<DiscoveredMarket[]> {
    const radiusKm = query.radiusKm ?? 3;
    // Approximate only the lookup center, never the coordinates of the shops.
    const latitude = Number(query.latitude.toFixed(3));
    const longitude = Number(query.longitude.toFixed(3));
    const key = `${latitude}:${longitude}:${radiusKm}`;
    let cached = this.cache.get(key);
    if (!cached || cached.expires < Date.now()) {
      if (this.activeRequest) throw new ServiceUnavailableException("A busca de mercados está ocupada. Aguarde alguns segundos e tente novamente.");
      this.activeRequest = true;
      const value = (async () => {
        try {
          const endpoint = this.config.get<string>("OVERPASS_API_URL") ?? "https://overpass.private.coffee/api/interpreter";
          const queryText = `[out:json][timeout:6][maxsize:1048576];nwr(around:${Math.ceil((radiusKm + 0.15) * 1000)},${latitude},${longitude})[shop~"^(supermarket|convenience|grocery|wholesale)$"];out center tags 100;`;
          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Gondly/1.0 (+https://gondly.com.br)" },
            body: new URLSearchParams({ data: queryText }).toString(),
            signal: AbortSignal.timeout(8_000),
          });
          if (!response.ok) throw new Error("Map provider unavailable");
          const data = await response.json() as { elements?: Element[]; remark?: string };
          if (!Array.isArray(data.elements) || data.remark) throw new Error("Incomplete map response");
          return data.elements;
        } finally { this.activeRequest = false; }
      })();
      cached = { expires: Date.now() + 10 * 60_000, value };
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, cached);
      void value.catch(() => { if (this.cache.get(key)?.value === value) this.cache.delete(key); });
    }
    try {
      const elements = await cached.value;
      return elements.flatMap(element => {
        const tags = element.tags ?? {};
        const name = tags.name?.trim();
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (!name || !Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat!) > 90 || Math.abs(lon!) > 180) return [];
        const distanceKm = distance(query.latitude, query.longitude, lat!, lon!);
        if (distanceKm > radiusKm) return [];
        const state = tags["addr:state"] ?? tags["ISO3166-2"]?.replace(/^BR-/, "");
        return [{
          placeId: `osm:${element.type}:${element.id}`, name: name.slice(0, 120), latitude: lat!, longitude: lon!,
          distanceKm: Math.round(distanceKm * 100) / 100,
          address: [tags["addr:street"], tags["addr:housenumber"]].filter(Boolean).join(", ").slice(0, 180) || undefined,
          neighborhood: (tags["addr:suburb"] ?? tags["addr:neighbourhood"])?.slice(0, 80),
          city: tags["addr:city"]?.slice(0, 80), state: state?.length === 2 ? state.toUpperCase() : undefined,
          country: tags["addr:country"]?.slice(0, 2).toUpperCase(), postalCode: tags["addr:postcode"]?.slice(0, 16),
        }];
      }).sort((a, b) => a.distanceKm - b.distanceKm).slice(0, 20);
    } catch {
      throw new ServiceUnavailableException("Não foi possível buscar mercados próximos. Tente novamente ou cadastre manualmente.");
    }
  }
}

function distance(lat: number, lon: number, otherLat: number, otherLon: number) {
  const radians = (value: number) => value * Math.PI / 180;
  const a = Math.sin(radians(otherLat - lat) / 2) ** 2 + Math.cos(radians(lat)) * Math.cos(radians(otherLat)) * Math.sin(radians(otherLon - lon) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0, 1 - a)));
}
