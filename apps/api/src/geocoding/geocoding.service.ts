import { Injectable, Logger, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

type GoogleAddressComponent = {
  long_name: string;
  short_name: string;
  types: string[];
};

type GoogleGeocodeResult = {
  address_components: GoogleAddressComponent[];
};

type GoogleGeocodeResponse = {
  status: string;
  error_message?: string;
  results: GoogleGeocodeResult[];
};

export type ReverseGeocodeResult = {
  city: string | null;
  state: string | null;
  neighborhood: string | null;
  country: string | null;
};

@Injectable()
export class GeocodingService {
  private readonly logger = new Logger(GeocodingService.name);

  constructor(private readonly config: ConfigService) {}

  async reverseGeocode(latitude: number, longitude: number): Promise<ReverseGeocodeResult> {
    const apiKey = this.config.get<string>("GOOGLE_MAPPS_KEY");
    if (!apiKey) {
      throw new ServiceUnavailableException("GOOGLE_MAPPS_KEY nao configurado.");
    }

    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
    url.searchParams.set("latlng", `${latitude},${longitude}`);
    url.searchParams.set("language", "pt-BR");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new ServiceUnavailableException("Nao foi possivel identificar a regiao.");
    }

    const data = (await response.json()) as GoogleGeocodeResponse;
    if (data.status !== "OK" || !data.results.length) {
      this.logger.warn(`Reverse geocode failed: status=${data.status} message=${data.error_message ?? "-"}`);
      return { city: null, state: null, neighborhood: null, country: null };
    }

    return this.extractRegion(data.results[0].address_components);
  }

  private extractRegion(components: GoogleAddressComponent[]): ReverseGeocodeResult {
    const findComponent = (type: string) => components.find((component) => component.types.includes(type));

    const city = findComponent("locality") ?? findComponent("administrative_area_level_2");
    const state = findComponent("administrative_area_level_1");
    const neighborhood = findComponent("sublocality") ?? findComponent("sublocality_level_1") ?? findComponent("neighborhood");
    const country = findComponent("country");

    return {
      city: city?.long_name ?? null,
      state: state?.short_name ?? null,
      neighborhood: neighborhood?.long_name ?? null,
      country: country?.short_name ?? null,
    };
  }
}
