import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, FloatingActionButton, LoadingState, MarketListCard, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../ads/AdSlot";
import { trackEvent, trackSafeSearch } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { MarketList } from "../../types";
import { useDebouncedValue } from "../shared";

export function ListsPage() {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q);
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const filtered = data.filter((list) => list.name.toLowerCase().includes(q.toLowerCase()));

  useEffect(() => {
    trackSafeSearch("lists", debouncedQ);
  }, [debouncedQ]);

  return (
    <ScreenContainer title="Listas">
      <SearchBar placeholder="Buscar lista" value={q} onChange={(event) => setQ(event.target.value)} />
      <AdSlot slot="lists_inline" className="mt-4" />
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !filtered.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
        {filtered.map((list) => (
          <div key={list.id} className="space-y-3">
            <MarketListCard list={list} onClick={() => navigate(`/app/lists/${list.id}`)} />
          </div>
        ))}
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
