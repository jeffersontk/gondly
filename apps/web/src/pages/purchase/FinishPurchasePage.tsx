import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { MapPin } from "lucide-react";
import { AppButton, AppInput, LoadingState, MarketSelect, MoneyInput, ScreenContainer } from "../../components";
import { ItemFeedback } from "../../components/ItemFeedback";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import { useOutboxStatus } from "../../lib/offlineQueue";
import type { Market, PriceSharingPreference, Purchase } from "../../types";
import { decimalValue, finishSchema, FinishForm, formatBRL, MarketForm, marketSchema, removeActivePurchaseCache } from "../shared";

type GeoFeedback = {
  tone: "info" | "success" | "error";
  message: string;
};

export function FinishPurchasePage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreateMarket, setShowCreateMarket] = useState(false);
  const [geoPending, setGeoPending] = useState(false);
  const [geoFeedback, setGeoFeedback] = useState<GeoFeedback | null>(null);
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const priceSharingPreference = useQuery({
    queryKey: ["price-sharing-preference"],
    queryFn: () => api<PriceSharingPreference>("/me/price-sharing-preference"),
  });
  const purchase = active.data?.find((entry) => entry.id === purchaseId) ?? active.data?.[0];
  const outbox = useOutboxStatus(purchase?.id);
  const form = useForm<FinishForm>({
    resolver: zodResolver(finishSchema),
    defaultValues: { marketId: "", finalPaidAmount: 0, sharePrices: false, notes: "" },
  });
  const marketForm = useForm<MarketForm>({
    resolver: zodResolver(marketSchema),
    defaultValues: { name: "", address: "", neighborhood: "", city: "", state: "", country: "BR", postalCode: "", notes: "" },
  });
  const finish = useMutation({
    mutationFn: (values: FinishForm) => api<Purchase>(`/purchases/${purchase?.id}/finish`, { method: "POST", body: values }),
    onSuccess: (saved, values) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeActivePurchaseCache(current, saved.id));
      queryClient.setQueryData(["purchase", saved.id], saved);
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => (current ? [saved, ...current.filter((purchase) => purchase.id !== saved.id)] : current));
      queryClient.setQueryData<PriceSharingPreference>(["price-sharing-preference"], (current) =>
        current ? { ...current, sharePrices: values.sharePrices } : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["price-sharing-preference"] });
      trackEvent("finish_purchase", {
        purchase_id: saved.id,
        market_id: saved.marketId,
        items_count: saved.items.length,
        cart_items_count: saved.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length,
        subtotal_calculated: saved.subtotalCalculated,
        final_paid_amount: saved.finalPaidAmount,
        discount_amount: saved.discountAmount,
        share_prices: values.sharePrices,
      });
      navigate(`/app/history/${saved.id}`);
    },
  });
  const createMarket = useMutation({
    mutationFn: (values: MarketForm) => api<Market>("/markets", { method: "POST", body: values }),
    onSuccess: (market) => {
      queryClient.setQueryData<Market[]>(["markets"], (current) => (current ? [market, ...current.filter((entry) => entry.id !== market.id)] : [market]));
      form.setValue("marketId", market.id, { shouldValidate: true });
      marketForm.reset({ name: "", address: "", neighborhood: "", city: "", state: "", country: "BR", postalCode: "", notes: "" });
      setShowCreateMarket(false);
    },
  });
  const updateMarketLocation = useMutation({
    mutationFn: ({ marketId, latitude, longitude }: { marketId: string; latitude: number; longitude: number }) =>
      api<Market>(`/markets/${marketId}`, { method: "PATCH", body: { latitude, longitude } }),
    onSuccess: (market) => {
      queryClient.setQueryData<Market[]>(["markets"], (current) => (current ? [market, ...current.filter((entry) => entry.id !== market.id)] : [market]));
      queryClient.setQueryData<Market>(["market", market.id], market);
    },
  });

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoFeedback({ tone: "error", message: "Seu navegador nao permite capturar localizacao." });
      return;
    }

    setGeoPending(true);
    setGeoFeedback(null);
    try {
      const coords = await getCurrentCoordinates();
      marketForm.setValue("latitude", coords.latitude, { shouldDirty: true });
      marketForm.setValue("longitude", coords.longitude, { shouldDirty: true });

      const marketId = form.getValues("marketId");
      if (marketId) {
        await updateMarketLocation.mutateAsync({ marketId, latitude: coords.latitude, longitude: coords.longitude });
        setGeoFeedback({ tone: "success", message: "Localizacao adicionada ao mercado selecionado." });
      } else {
        setShowCreateMarket(true);
        setGeoFeedback({ tone: "success", message: "Localizacao capturada. Cadastre o mercado para salvar esses dados." });
      }
    } catch {
      setGeoFeedback({ tone: "info", message: "Localizacao nao autorizada. Voce pode finalizar a compra normalmente." });
    } finally {
      setGeoPending(false);
    }
  }

  useEffect(() => {
    if (purchase) form.setValue("finalPaidAmount", purchase.subtotalCalculated, { shouldDirty: false });
  }, [form, purchase?.id, purchase?.subtotalCalculated]);

  useEffect(() => {
    if (priceSharingPreference.data) {
      form.setValue("sharePrices", priceSharingPreference.data.sharePrices, { shouldDirty: false });
    }
  }, [form, priceSharingPreference.data?.sharePrices]);

  if (!purchase) return <LoadingState />;
  const finalPaidAmount = decimalValue(form.watch("finalPaidAmount"));
  const difference = purchase.subtotalCalculated - finalPaidAmount;
  const sharePrices = Boolean(form.watch("sharePrices"));

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
        <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
          <p className="text-sm font-semibold leading-5 text-ink/65">
            Usar sua localização ajuda o Gondly a comparar preços da sua região.
          </p>
          <AppButton
            className="mt-3"
            type="button"
            full
            variant="secondary"
            icon={<MapPin className="h-4 w-4" />}
            onClick={handleUseCurrentLocation}
            loading={geoPending || updateMarketLocation.isPending}
            loadingLabel="Capturando"
          >
            Usar minha localização atual
          </AppButton>
        </div>
        {geoFeedback ? <ItemFeedback tone={geoFeedback.tone} message={geoFeedback.message} /> : null}
        {showCreateMarket ? (
          <div className="grid gap-3 rounded-xl bg-white p-4 shadow-soft">
            <p className="text-sm font-black text-ink">Cadastrar mercado</p>
            <AppInput label="Nome" error={marketForm.formState.errors.name?.message} {...marketForm.register("name")} />
            <AppInput label="Cidade" {...marketForm.register("city")} />
            <AppInput label="Bairro" {...marketForm.register("neighborhood")} />
            <AppInput label="Estado" maxLength={2} {...marketForm.register("state")} />
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
        <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
          <button
            type="button"
            role="switch"
            aria-checked={sharePrices}
            className="flex w-full items-center justify-between gap-3 text-left"
            onClick={() => form.setValue("sharePrices", !sharePrices, { shouldDirty: true })}
          >
            <span className="min-w-0">
              <span className="block text-sm font-black text-ink">Contribuir com a base de preços da região</span>
              <span className="mt-1 block text-sm leading-5 text-ink/60">
                Ao ativar, os preços desta compra ajudam outros usuários a comparar mercados. Seus dados pessoais não serão exibidos.
              </span>
            </span>
            <span
              className={[
                "relative h-7 w-12 flex-none rounded-full transition",
                sharePrices ? "bg-mint" : "bg-ink/15",
              ].join(" ")}
            >
              <span
                className={[
                  "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
                  sharePrices ? "left-6" : "left-1",
                ].join(" ")}
              />
            </span>
          </button>
        </div>
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

function getCurrentCoordinates() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ latitude: position.coords.latitude, longitude: position.coords.longitude }),
      reject,
      { enableHighAccuracy: false, maximumAge: 5 * 60_000, timeout: 10_000 },
    );
  });
}
