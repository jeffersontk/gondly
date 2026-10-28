import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { AppButton, AppInput } from "../../components";
import { api } from "../../lib/api";
import { formatBRL } from "../shared";

type BudgetReport = {
  budgetAmount: number | null; confirmedAmount: number; estimatedRemaining: number; estimatedTotal: number;
  remainingAfterConfirmed: number | null; estimatedBalance: number | null; exceeded: boolean; canEdit: boolean;
  unknownItemsCount: number; knownItemsCount: number; remainingItemsCount: number;
  references: { itemId: string; productName: string; quantity: number; unit: string; estimate: number | null; referenceAt: string | null; marketName: string | null }[];
};

export function PurchaseBudgetCard({ purchaseId, revision, socket }: { purchaseId: string; revision: string; socket?: Socket }) {
  const client = useQueryClient();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const report = useQuery({ queryKey: ["purchase-budget", purchaseId, revision], queryFn: () => api<BudgetReport>(`/purchases/${purchaseId}/budget`, { cacheFallback: false }), staleTime: 0, refetchOnMount: "always", refetchOnWindowFocus: true });
  const data = report.data;
  useEffect(() => { setDraft(data?.budgetAmount == null ? "" : data.budgetAmount.toFixed(2).replace(".", ",")); }, [data?.budgetAmount, purchaseId]);
  useEffect(() => {
    const refresh = () => { void client.invalidateQueries({ queryKey: ["purchase-budget", purchaseId] }); };
    socket?.on("purchaseBudgetChanged", refresh);
    socket?.on("connect", refresh);
    return () => { socket?.off("purchaseBudgetChanged", refresh); socket?.off("connect", refresh); };
  }, [client, purchaseId, socket]);
  const save = useMutation({
    mutationFn: (budgetAmount: number | null) => api(`/purchases/${purchaseId}/budget`, { method: "PUT", body: { budgetAmount } }),
    onSuccess: () => { setError(""); void client.invalidateQueries({ queryKey: ["purchase-budget", purchaseId] }); },
    onError: () => setError("Não foi possível salvar o orçamento. Confira a conexão e sua permissão de edição."),
  });

  return <section className="mt-3 rounded-2xl border border-line bg-white p-4 shadow-sm">
    <h2 className="text-sm font-black text-ink">Orçamento e planejamento</h2>
    {report.isLoading ? <p className="mt-2 text-sm text-ink/60">Calculando referências…</p> : null}
    {report.fetchStatus === "paused" ? <p role="status" className="mt-2 text-sm text-amber-900">Sem conexão. Os valores exibidos são da última consulta; reconecte para confirmar o orçamento.</p> : report.isFetching && data ? <p className="mt-2 text-xs text-ink/60">Atualizando valores…</p> : null}
    {report.isError ? <p role="alert" className="mt-2 text-sm text-tomato">Não foi possível carregar o planejamento. <button type="button" className="underline" onClick={() => report.refetch()}>Tentar novamente</button></p> : null}
    {data && !report.isError ? <>
      {data.canEdit ? <form className="mt-3 space-y-2" onSubmit={event => {
        event.preventDefault();
        const value = draft.trim();
        if (value && !/^\d+(?:[.,]\d{1,2})?$/.test(value)) { setError("Informe um valor como 500,00, com até duas casas decimais."); return; }
        const amount = value ? Number(value.replace(",", ".")) : null;
        if (amount !== null && amount > 9999999999.99) { setError("O orçamento informado é muito alto."); return; }
        save.mutate(amount);
      }}>
        <AppInput label="Limite da compra (opcional)" inputMode="decimal" value={draft} placeholder="Ex.: 500,00" onChange={event => setDraft(event.target.value)} />
        <div className="flex gap-2"><AppButton type="submit" variant="secondary" loading={save.isPending} loadingLabel="Salvando">Salvar orçamento</AppButton>{data.budgetAmount !== null ? <AppButton type="button" variant="secondary" disabled={save.isPending} onClick={() => save.mutate(null)}>Remover limite</AppButton> : null}</div>
      </form> : <p className="mt-2 text-xs text-ink/60">O responsável e os editores da compra podem alterar o orçamento.</p>}
      {error ? <p role="alert" className="mt-2 text-sm text-tomato">{error}</p> : null}
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <BudgetStat label="Lançado no carrinho" value={formatBRL(data.confirmedAmount)} />
        <BudgetStat label="Estimativa do restante" value={data.knownItemsCount || !data.remainingItemsCount ? formatBRL(data.estimatedRemaining) : "Sem referência"} />
        <BudgetStat label={data.unknownItemsCount ? "Total estimado parcial" : "Total estimado"} value={formatBRL(data.estimatedTotal)} />
        <BudgetStat label="Saldo após o carrinho" value={data.remainingAfterConfirmed === null ? "Sem limite" : formatBRL(data.remainingAfterConfirmed)} />
      </dl>
      {data.budgetAmount !== null ? <p className="mt-2 text-xs text-ink/65">Limite: {formatBRL(data.budgetAmount)}{data.estimatedBalance === null ? "" : ` · Saldo previsto: ${formatBRL(data.estimatedBalance)}`}</p> : null}
      {data.unknownItemsCount ? <p className="mt-2 rounded-xl bg-amber-50 p-2 text-xs text-amber-900">Estimativa parcial: {data.unknownItemsCount} item(ns) sem preço compatível. Eles não foram tratados como gratuitos.</p> : null}
      {data.exceeded ? <p role="alert" className="mt-2 rounded-xl bg-red-50 p-2 text-sm font-bold text-tomato">O gasto lançado ou a estimativa já ultrapassa o orçamento. Você pode continuar e finalizar a compra.</p> : null}
      {data.references.length ? <details className="mt-3 text-xs text-ink/65"><summary className="cursor-pointer font-bold">Referências dos itens restantes</summary>
        <p className="mt-2">Últimos preços lançados em compras dos últimos 365 dias, com produto, marca, unidade e embalagem compatíveis. Compras compartilhadas usam referências acessíveis ao grupo.</p>
        {data.references.map(reference => <p className="mt-2 border-t border-line pt-2" key={reference.itemId}><span className="font-bold">{reference.productName}</span>: {reference.estimate === null ? "sem referência compatível" : `${formatBRL(reference.estimate)} para ${reference.quantity} ${reference.unit} · ${reference.marketName ?? "Mercado não informado"} · ${reference.referenceAt ? new Date(reference.referenceAt).toLocaleDateString("pt-BR") : ""}`}</p>)}
      </details> : null}
      <p className="mt-2 text-xs text-ink/50">Estimativas são referências, não o valor pago no caixa. O total final e os descontos são registrados ao finalizar.</p>
    </> : null}
  </section>;
}

function BudgetStat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl bg-paper p-2"><dt className="text-xs text-ink/60">{label}</dt><dd className="mt-1 font-bold text-ink">{value}</dd></div>;
}
