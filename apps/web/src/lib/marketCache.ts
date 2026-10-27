import type { QueryClient } from "@tanstack/react-query";
import type { Market } from "../types";

export function marketLocationLabel(market: Pick<Market, "address" | "neighborhood" | "city" | "state">) {
  return [market.address, market.neighborhood, market.city, market.state].filter(Boolean).join(" · ");
}

export function updateMarketCaches(client: QueryClient, saved: Market) {
  client.setQueryData(["market", saved.id], saved);
  client.setQueryData<Market[]>(["markets"], current => {
    if (!current) return [saved];
    return current.some(market => market.id === saved.id) ? current.map(market => market.id === saved.id ? saved : market) : [saved, ...current];
  });
  client.setQueryData<{ market: Market }>(["market-summary", saved.id], current => current ? { ...current, market: saved } : undefined);
  return client.invalidateQueries({ queryKey: ["market-summary", saved.id] });
}
