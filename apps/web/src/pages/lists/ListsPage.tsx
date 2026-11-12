import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Sparkles } from "lucide-react";
import { EmptyState, FloatingActionButton, LoadingState, MarketListCard, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../ads/AdSlot";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import { getListLastViewedAt, hasNewItemsSince } from "../../lib/listActivity";
import type { MarketList } from "../../types";
import { useDebouncedValue } from "../shared";

export function ListsPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const navigate = useNavigate();
  const { data = [], isLoading, isError } = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const filtered = data.filter((list) => list.name.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    trackSafeSearch("lists", debouncedQ);
  }, [debouncedQ]);

  return (
    <ScreenContainer>
      <h1 className="mb-5 text-3xl font-black tracking-[-0.04em] text-ink">Listas</h1>
      <SearchBar placeholder="Buscar lista" value={q} onChange={(event) => setQ(event.target.value)} />
      <button type="button" onClick={() => navigate("/app/recipes")} className="mt-3 min-h-12 w-full rounded-xl border border-mint/25 bg-white px-4 text-left text-sm font-bold text-mint">Montar lista a partir de receitas →</button>
      <button
        type="button"
        onClick={() => {
          trackEvent("click_diet_plan_shortcut", { source: "lists_page" });
          navigate("/app/lists/diet-plan");
        }}
        className="mt-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-mint/20 bg-mint/5 p-3.5 text-left transition hover:bg-mint/10 active:scale-[0.99]"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint text-white shadow-soft">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-mint">Planejador inteligente</span>
            <p className="text-sm font-black text-ink">Gerar lista para minha rotina</p>
          </div>
        </div>
        <span className="text-xs font-bold text-mint">Começar →</span>
      </button>
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !filtered.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
        {filtered.map((list) => (
          <div key={list.id} className="space-y-3">
            <MarketListCard
              list={list}
              onClick={() => navigate(`/app/lists/${list.id}`)}
              hasNewItems={hasNewItemsSince(list, getListLastViewedAt(list.id))}
            />
          </div>
        ))}
        <AdSlot slot="lists_inline" hasContent={filtered.length > 0} disabled={isLoading || isError} />
      </div>
      <FloatingActionButton
        label="Lista"
        onClick={() => {
          trackEvent("click_create_list_shortcut", { source: "lists_fab" });
          navigate("/app/lists/new");
        }}
      />
    </ScreenContainer>
  );
}
