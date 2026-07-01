import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton, AppInput, LoadingState, MarketSelect, MoneyInput, ScreenContainer } from "../../components";
import { ItemFeedback } from "../../components/ItemFeedback";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import { useOutboxStatus } from "../../lib/offlineQueue";
import type { Market, Purchase } from "../../types";
import { decimalValue, finishSchema, FinishForm, formatBRL, MarketForm, marketSchema, removeActivePurchaseCache } from "../shared";

export function FinishPurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0];
  const outbox = useOutboxStatus(purchase?.id);
  const form = useForm<FinishForm>({
    resolver: zodResolver(finishSchema),
    defaultValues: { marketId: "", finalPaidAmount: 0, notes: "" },
  });
  const marketForm = useForm<MarketForm>({ resolver: zodResolver(marketSchema), defaultValues: { name: "", address: "", city: "", notes: "" } });
  const finish = useMutation({
    mutationFn: (values: FinishForm) => api<Purchase>(`/purchases/${purchase?.id}/finish`, { method: "POST", body: values }),
    onSuccess: (saved) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeActivePurchaseCache(current, saved.id));
      queryClient.setQueryData(["purchase", saved.id], saved);
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => (current ? [saved, ...current.filter((purchase) => purchase.id !== saved.id)] : current));
      trackEvent("finish_purchase", {
        purchase_id: saved.id,
        market_id: saved.marketId,
        items_count: saved.items.length,
        cart_items_count: saved.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length,
        subtotal_calculated: saved.subtotalCalculated,
        final_paid_amount: saved.finalPaidAmount,
        discount_amount: saved.discountAmount,
      });
      navigate(`/app/history/${saved.id}`);
    },
  });
  const createMarket = useMutation({
    mutationFn: (values: MarketForm) => api<Market>("/markets", { method: "POST", body: values }),
    onSuccess: (market) => {
      queryClient.setQueryData<Market[]>(["markets"], (current) => (current ? [market, ...current.filter((entry) => entry.id !== market.id)] : current));
      form.setValue("marketId", market.id, { shouldValidate: true });
      marketForm.reset({ name: "", address: "", city: "", notes: "" });
      setShowCreateMarket(false);
    },
  });

  useEffect(() => {
    if (purchase) form.setValue("finalPaidAmount", purchase.subtotalCalculated, { shouldDirty: false });
  }, [form, purchase?.id, purchase?.subtotalCalculated]);

  if (!purchase) return <LoadingState />;
  const finalPaidAmount = decimalValue(form.watch("finalPaidAmount"));
  const difference = purchase.subtotalCalculated - finalPaidAmount;

  return (
    <ScreenContainer title="Finalizar">
      <div className="mb-4 rounded-xl bg-ink p-4 text-white shadow-soft">
        <p className="text-xs text-white/60">Subtotal calculado</p>
        <p className="text-3xl font-black">{formatBRL(purchase.subtotalCalculated)}</p>
      </div>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => finish.mutate(values))}>
        {outbox.pendingCount > 0 ? (
          <ItemFeedback
            tone="info"
            message={
              outbox.isSyncing
                ? "Sincronizando itens do carrinho antes de finalizar."
                : "Finalize depois que os itens pendentes forem enviados. O app tenta sincronizar automaticamente quando o sinal voltar."
            }
          />
        ) : null}
        <MarketSelect
          value={form.watch("marketId")}
          onChange={(value) => form.setValue("marketId", value, { shouldValidate: true })}
          onCreate={() => setShowCreateMarket(true)}
        />
        {showCreateMarket ? (
          <div className="grid gap-3 rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm font-black text-ink">Cadastrar mercado</p>
            <AppInput label="Nome" error={marketForm.formState.errors.name?.message} {...marketForm.register("name")} />
            <AppInput label="Endereço" {...marketForm.register("address")} />
            <AppInput label="Cidade" {...marketForm.register("city")} />
            <div className="grid grid-cols-2 gap-2">
              <AppButton type="button" variant="secondary" onClick={() => setShowCreateMarket(false)} disabled={createMarket.isPending}>
                Cancelar
              </AppButton>
              <AppButton
                type="button"
                onClick={marketForm.handleSubmit((values) => createMarket.mutate(values))}
                loading={createMarket.isPending}
                loadingLabel="Cadastrando"
              >
                Cadastrar
              </AppButton>
            </div>
          </div>
        ) : null}
        <MoneyInput label="Valor pago no caixa" error={form.formState.errors.finalPaidAmount?.message} {...form.register("finalPaidAmount")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <div className="rounded-xl bg-white p-3 shadow-soft">
          <p className="text-xs font-semibold text-ink/50">Desconto/diferenca</p>
          <p className={difference >= 0 ? "text-lg font-black text-mint" : "text-lg font-black text-tomato"}>{formatBRL(difference)}</p>
          {difference < 0 ? <p className="mt-1 text-xs text-tomato">Diferenca positiva, talvez algum item nao tenha sido lancado.</p> : null}
        </div>
        <AppButton type="submit" full loading={finish.isPending} loadingLabel="Salvando" disabled={outbox.pendingCount > 0}>
          Salvar compra
        </AppButton>
      </form>
    </ScreenContainer>
  );
}
