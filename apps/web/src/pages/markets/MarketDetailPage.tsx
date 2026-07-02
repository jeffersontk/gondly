import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Trash2 } from "lucide-react";
import { AppButton, ConfirmDialog, ErrorState, LoadingState, ScreenContainer, SummaryCard } from "../../components";
import { api } from "../../lib/api";
import type { Market } from "../../types";
import { formatBRL, removeById } from "../shared";

export function MarketDetailPage() {
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const summary = useQuery({ queryKey: ["market-summary", id], queryFn: () => api<{ market: Market; purchaseCount: number; totalSpent: number; averageTicket: number; topProduct: string | null }>(`/markets/${id}/summary`) });
  const remove = useMutation({
    mutationFn: () => api(`/markets/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["market-summary", id] });
      queryClient.setQueryData<Market[]>(["markets"], (current) => removeById(current, id));
      navigate("/app/markets");
    },
  });

  if (summary.isLoading) return <LoadingState />;
  if (!summary.data) return <ScreenContainer title="Mercado"><ErrorState /></ScreenContainer>;
  const location = [summary.data.market.neighborhood, summary.data.market.city, summary.data.market.state].filter(Boolean).join(" · ");

  return (
    <ScreenContainer title={summary.data.market.name} subtitle={location || undefined}>
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Total" value={formatBRL(summary.data.totalSpent)} />
        <SummaryCard label="Compras" value={summary.data.purchaseCount} tone="sky" />
        <SummaryCard label="Ticket" value={formatBRL(summary.data.averageTicket)} tone="leaf" />
        <SummaryCard label="Produto" value={summary.data.topProduct ?? "-"} tone="tomato" />
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <AppButton full variant="secondary" icon={<Edit className="h-4 w-4" />} onClick={() => navigate(`/app/markets/${id}/edit`)}>
          Editar
        </AppButton>
        <AppButton full variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
          Excluir
        </AppButton>
      </div>
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir mercado"
        description="O mercado sera removido da sua lista. Compras antigas continuam no historico."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        confirmLoading={remove.isPending}
      />
    </ScreenContainer>
  );
}
