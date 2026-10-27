import { useEffect, useId, useState } from "react";
import type { Market } from "../../types";

const normalized = (value: string) => value.trim().normalize("NFD").replace(/\p{Diacritic}/gu, "").toLocaleLowerCase("pt-BR");
const OTHER = "__inform_another_neighborhood__";

export function neighborhoodOptions(markets: Pick<Market, "city" | "state" | "neighborhood">[], city: string, state: string, selected: string): string[] {
  const names = new Map<string, string>();
  for (const market of markets) {
    if (!city.trim() || normalized(market.city ?? "") !== normalized(city)) continue;
    if (state.trim() && normalized(market.state ?? "") !== normalized(state)) continue;
    const name = market.neighborhood?.trim();
    if (name && !names.has(normalized(name))) names.set(normalized(name), name);
  }
  if (selected.trim()) names.set(normalized(selected), selected.trim());
  return [...names.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function NeighborhoodSelect({ markets, city, state, value, onChange, usingGps = false }: {
  markets: Market[];
  city: string;
  state: string;
  value: string;
  onChange: (value: string) => void;
  usingGps?: boolean;
}) {
  const id = useId();
  const [manual, setManual] = useState(false);
  const options = neighborhoodOptions(markets, city, state, value);
  useEffect(() => { if (usingGps) setManual(false); }, [usingGps]);

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-semibold text-ink">Bairro</label>
      <select
        id={id}
        value={manual ? OTHER : value}
        disabled={!city.trim()}
        onChange={event => {
          const next = event.target.value;
          setManual(next === OTHER);
          onChange(next === OTHER ? "" : next);
        }}
        className="h-12 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint disabled:opacity-50"
      >
        <option value="">Todos os bairros</option>
        {options.map(name => <option key={name} value={name}>{name}</option>)}
        <option value={OTHER}>Informar outro bairro</option>
      </select>
      {manual ? <label className="block text-sm font-semibold text-ink">Nome do bairro<input autoFocus value={value} onChange={event => onChange(event.target.value)} placeholder="Digite o bairro" className="mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-3 text-sm outline-none focus:border-mint" /></label> : null}
      <p className="text-xs text-ink/55">{!city.trim() ? "Informe a cidade ou use sua localização para escolher um bairro." : "Opções dos mercados cadastrados nesta cidade e da sua localização. Se faltar um bairro, escolha Informar outro bairro."}</p>
    </div>
  );
}
