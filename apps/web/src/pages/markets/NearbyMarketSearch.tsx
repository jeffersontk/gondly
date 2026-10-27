import { useState } from "react";
import { AppButton } from "../../components";
import { api } from "../../lib/api";
import type { NearbyMarketPlace } from "../../types";

export function NearbyMarketSearch({ onSelect }: { onSelect: (place: NearbyMarketPlace) => void }) {
  const [pending, setPending] = useState(false);
  const [places, setPlaces] = useState<NearbyMarketPlace[]>([]);
  const [message, setMessage] = useState("");

  async function search() {
    setPending(true);
    setMessage("");
    setPlaces([]);
    try {
      if (!navigator.geolocation) throw new Error("GPS unavailable");
      const position = await new Promise<GeolocationPosition>((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 }));
      const query = new URLSearchParams({ latitude: String(position.coords.latitude), longitude: String(position.coords.longitude), radiusKm: "3" });
      const results = await api<NearbyMarketPlace[]>(`/markets/discover?${query}`, { timeoutMs: 10_000 });
      setPlaces(results);
      setMessage(results.length ? "Escolha a loja para preencher o cadastro. Confira a filial e revise os dados antes de salvar." : "Não encontramos lojas mapeadas em até 3 km. Você pode preencher o cadastro manualmente.");
    } catch {
      setMessage("Não foi possível buscar lojas próximas. Confira a permissão de localização e tente novamente, ou preencha manualmente.");
    } finally {
      setPending(false);
    }
  }

  return <section className="mb-4 rounded-xl border border-line bg-white p-3">
    <AppButton type="button" full variant="secondary" loading={pending} loadingLabel="Buscando mercados" onClick={search}>Encontrar mercados próximos</AppButton>
    <p className="mt-2 text-xs leading-5 text-ink/55">Ao buscar, uma posição aproximada é consultada no serviço de mapas. Dados © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="underline">OpenStreetMap</a>. A cobertura e os endereços podem estar incompletos.</p>
    {message ? <p role="status" className="mt-2 text-sm text-ink/65">{message}</p> : null}
    <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
      {places.map(place => <button key={place.placeId} type="button" onClick={() => { onSelect(place); setPlaces([]); setMessage("Dados da loja preenchidos. Revise e clique em Salvar para confirmar."); }} className="w-full rounded-xl border border-line p-3 text-left hover:border-mint">
        <span className="block text-sm font-bold text-ink">{place.name} · {place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`}</span>
        <span className="mt-1 block text-xs text-ink/60">{[place.address, place.neighborhood, place.city].filter(Boolean).join(" · ") || "Endereço não informado no mapa"}</span>
      </button>)}
    </div>
  </section>;
}
