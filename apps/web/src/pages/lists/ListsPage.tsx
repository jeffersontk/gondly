import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, FloatingActionButton, LoadingState, MarketListCard, ScreenContainer, SearchBar } from "../../components";
import { AdSlot } from "../../lib/ads";
import { api } from "../../lib/api";
import type { MarketList } from "../../types";

export function ListsPage() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["lists"], queryFn: () => api<MarketList[]>("/lists") });
  const filtered = data.filter((list) => list.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <ScreenContainer title="Listas">
      <SearchBar placeholder="Buscar lista" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="mt-4 space-y-3">
        {isLoading ? <LoadingState /> : null}
        {!isLoading && !filtered.length ? <EmptyState title="Você ainda não tem listas. Crie sua primeira lista de mercado." /> : null}
        {filtered.map((list, index) => (
          <div key={list.id} className="space-y-3">
            <MarketListCard list={list} onClick={() => navigate(`/app/lists/${list.id}`)} />
            {(index + 1) % 3 === 0 ? <AdSlot /> : null}
          </div>
        ))}
      </div>
      <FloatingActionButton label="Lista" onClick={() => navigate("/app/lists/new")} />
    </ScreenContainer>
  );
}
