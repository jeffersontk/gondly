import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, FloatingActionButton, LoadingState, MarketCard, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import type { Market } from "../../types";

export function MarketsPage() {
  const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });

  return (
    <ScreenContainer title="Mercados">
      {isLoading ? <LoadingState /> : null}
      {!isLoading && !data.length ? <EmptyState title="Cadastre seus mercados para comparar preços." /> : null}
      <div className="space-y-3">
        {data.map((market) => (
          <MarketCard key={market.id} market={market} onClick={() => navigate(`/app/markets/${market.id}`)} />
        ))}
      </div>
      <FloatingActionButton label="Mercado" onClick={() => navigate("/app/markets/new")} />
    </ScreenContainer>
  );
}
