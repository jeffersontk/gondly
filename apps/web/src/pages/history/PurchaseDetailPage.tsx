import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { RefreshCcw } from "lucide-react";
import { AppButton, ErrorState, LoadingState, PurchaseItemCard, ScreenContainer, SectionHeader, SummaryCard } from "../../components";
import { api } from "../../lib/api";
import type { MarketList, Purchase } from "../../types";
import { formatBRL } from "../shared";

export function PurchaseDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const purchase = useQuery({ queryKey: ["purchase", id], queryFn: () => api<Purchase>(`/purchases/${id}`), enabled: Boolean(id) });
  const duplicate = useMutation({
    mutationFn: () => api<MarketList>(`/purchases/${id}/duplicate-as-list`, { method: "POST" }),
    onSuccess: (list) => navigate(`/app/lists/${list.id}`),
  });

  if (purchase.isLoading) return <LoadingState />;
  if (!purchase.data) return <ScreenContainer title="Compra"><ErrorState /></ScreenContainer>;

  return (
    <ScreenContainer title={purchase.data.market?.name ?? "Compra"} subtitle={new Date(purchase.data.startedAt).toLocaleDateString("pt-BR")}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(purchase.data.finalPaidAmount ?? purchase.data.subtotalCalculated)} />
        <SummaryCard label="Desconto" value={formatBRL(purchase.data.discountAmount ?? 0)} tone="tomato" />
      </div>
      <SectionHeader
        title="Itens"
        action={
          <AppButton variant="secondary" icon={<RefreshCcw className="h-4 w-4" />} onClick={() => duplicate.mutate()} loading={duplicate.isPending} loadingLabel="Criando lista">
            Virar lista
          </AppButton>
        }
      />
      <div className="space-y-3">
        {purchase.data.items.map((item) => (
          <PurchaseItemCard key={item.id} item={item} />
        ))}
      </div>
    </ScreenContainer>
  );
}
