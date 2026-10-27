import type { Market, NearbyMarketPlace } from "../../types";

const normalized = (name: string) => name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\b(supermercados?|mercados?|hipermercados?)\b/g, "").replace(/[^a-z0-9]/g, "");

export function matchNearbyMarket(markets: Market[], place: NearbyMarketPlace, selectedId: string, userId: string): Market | undefined {
  const identity = markets.find(market => market.placeId === place.placeId);
  if (identity) return identity;
  const sameName = (market: Market) => Boolean(normalized(place.name)) && normalized(market.name) === normalized(place.name);
  const located = markets.find(market => sameName(market) && !market.placeId && market.latitude != null && market.longitude != null
    && Math.abs(market.latitude - place.latitude) < 0.001 && Math.abs(market.longitude - place.longitude) < 0.001);
  if (located) return located;
  // An unlocated name is ambiguous: link only the explicitly selected, owned
  // record, after the user confirms the candidate. Never change another branch.
  return markets.find(market => market.id === selectedId && market.createdByUserId === userId && !market.placeId
    && market.latitude == null && market.longitude == null && sameName(market));
}

export function marketPlacePayload(place: NearbyMarketPlace) {
  const { name, placeId, latitude, longitude, address, city, state, neighborhood, country, postalCode } = place;
  return { name, placeId, latitude, longitude, address: address ?? undefined, city: city ?? undefined, state: state ?? undefined, neighborhood: neighborhood ?? undefined, country: country ?? "BR", postalCode: postalCode ?? undefined };
}
