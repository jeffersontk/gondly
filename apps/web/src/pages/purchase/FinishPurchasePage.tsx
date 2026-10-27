import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ListPlus, MapPin, Users } from "lucide-react";
import { AppButton, AppInput, LoadingState, MarketSelect, MoneyInput, ScreenContainer } from "../../components";
import { ItemFeedback } from "../../components/ItemFeedback";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useOutboxStatus } from "../../lib/offlineQueue";
import { invalidatePurchaseReports } from "../../lib/purchaseReportCache";
import { updateMarketCaches } from "../../lib/marketCache";
import { marketPlacePayload, matchNearbyMarket } from "../markets/nearbyMarketMatching";
import type { Market, MarketList, NearbyMarketPlace, PriceSharingPreference, Purchase } from "../../types";
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
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyMarketPlace[]>([]);
  const [createMissingList, setCreateMissingList] = useState(false);
  const { user } = useAuth();
  const markets = useQuery({ queryKey: ["markets"], queryFn: () => api<Market[]>("/markets") });
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
    onSuccess: async (saved, values) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => removeActivePurchaseCache(current, saved.id));
      if (createMissingList && saved.items.some((item) => Number(item.pricePaid ?? 0) <= 0)) {
        // Best effort: the purchase is already saved even if the list cannot be created.
        await api<MarketList>(`/purchases/${saved.id}/missing-as-list`, { method: "POST" })
          .then(() => queryClient.invalidateQueries({ queryKey: ["lists"] }))
          .catch(() => undefined);
      }
      queryClient.setQueryData(["purchase", saved.id], saved);
      queryClient.setQueryData<Purchase[]>(["purchases"], (current) => (current ? [saved, ...current.filter((purchase) => purchase.id !== saved.id)] : current));
      void invalidatePurchaseReports(queryClient);
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
  const chooseNearbyMarket = useMutation({
    mutationFn: async (place: NearbyMarketPlace) => {
      const existing = matchNearbyMarket(markets.data ?? [], place, form.getValues("marketId"), user?.id ?? "");
      if (existing?.placeId === place.placeId) return existing;
      if (existing && existing.createdByUserId !== user?.id) return existing;
      return api<Market>(existing ? `/markets/${existing.id}` : "/markets", { method: existing ? "PATCH" : "POST", body: marketPlacePayload(place) });
    },
    onSuccess: market => {
      void updateMarketCaches(queryClient, market);
      form.setValue("marketId", market.id, { shouldValidate: true });
      setNearbyPlaces([]);
      setShowCreateMarket(false);
      setGeoFeedback({ tone: "success", message: `Mercado confirmado: ${market.name}. A localização salva é a da loja.` });
    },
    onError: () => setGeoFeedback({ tone: "error", message: "Não foi possível selecionar o mercado. Tente novamente ou cadastre manualmente." }),
  });

  async function handleUseCurrentLocation() {
    if (!navigator.geolocation) {
      setGeoFeedback({ tone: "error", message: "Seu navegador nao permite capturar localizacao." });
      return;
    }

    setGeoPending(true);
    setGeoFeedback(null);
    setNearbyPlaces([]);
    try {
      const coords = await getCurrentCoordinates();
      const places = await api<NearbyMarketPlace[]>(`/markets/discover?${new URLSearchParams({ latitude: String(coords.latitude), longitude: String(coords.longitude), radiusKm: "3" })}`, { timeoutMs: 10_000 });
      setNearbyPlaces(places);
      setGeoFeedback({ tone: "info", message: places.length ? "Confirme em qual loja você comprou. A proximidade não seleciona o mercado automaticamente." : "Não encontramos lojas mapeadas em até 3 km. Você pode escolher ou cadastrar um mercado manualmente." });
    } catch {
      setGeoFeedback({ tone: "info", message: "Não foi possível buscar lojas próximas. Confira a permissão de localização e tente novamente, ou escolha/cadastre o mercado manualmente." });
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
  const cartItems = purchase.items.filter((item) => Number(item.pricePaid ?? 0) > 0);
  const missingItems = purchase.items.filter((item) => Number(item.pricePaid ?? 0) <= 0);
  const participantNames = new Map((purchase.participants ?? []).flatMap((participant) => (participant.user ? [[participant.userId, participant.user.name.split(/s+/)[0]] as const] : [])));
  const totalsByPerson =
    participantNames.size > 1
      ? [...cartItems.reduce((totals, item) => {
          const personId = item.updatedByUserId ?? item.addedByUserId ?? "";
          return totals.set(personId, (totals.get(personId) ?? 0) + Number(item.pricePaid ?? 0));
        }, new Map<string, number>())].map(([personId, total]) => ({
          name: personId === user?.id ? "Você" : participantNames.get(personId) ?? "Outro participante",
          total,
        }))
      : [];

  return (
    <ScreenContainer title="Finalizar">
      <div className="mb-4 rounded-xl bg-ink p-4 text-white shadow-soft">
        <p className="text-xs text-white/60">Subtotal calculado</p>
        <p className="text-3xl font-black">{formatBRL(purchase.subtotalCalculated)}</p>
      </div>
      <div className="mb-4 space-y-3">
        <div className="rounded-xl border border-line bg-white p-3 shadow-sm">
          <p className="text-sm font-black text-ink">
            {cartItems.length} {cartItems.length === 1 ? "item" : "itens"} no carrinho
          </p>
          {totalsByPerson.length ? (
            <div className="mt-2 space-y-1">
              <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.08em] text-ink/50">
                <Users className="h-3.5 w-3.5" /> Quem pegou o quê
              </p>
              {totalsByPerson.map((entry) => (
                <p key={entry.name} className="flex justify-between text-sm text-ink/70">
                  <span>{entry.name}</span>
                  <span className="font-black text-ink">{formatBRL(entry.total)}</span>
                </p>
              ))}
            </div>
          ) : null}
        </div>
        {missingItems.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 shadow-sm">
            <p className="text-sm font-black text-amber-800">
              Ficaram de fora ({missingItems.length}): esqueceu algo?
            </p>
            <p className="mt-1 text-sm leading-5 text-amber-900/80">
              {missingItems.slice(0, 6).map((item) => item.productName).join(", ")}
              {missingItems.length > 6 ? ` e mais ${missingItems.length - 6}` : ""}
            </p>
            <label className="mt-3 flex items-center gap-2 text-sm font-bold text-amber-900">
              <input type="checkbox" className="h-4 w-4 accent-amber-600" checked={createMissingList} onChange={(event) => setCreateMissingList(event.target.checked)} />
              <ListPlus className="h-4 w-4" />
              Criar uma lista com o que faltou
            </label>
          </div>
        ) : null}
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
            Encontre mercados em até 3 km e confirme a loja onde comprou, sem precisar digitar o endereço.
          </p>
          <AppButton
            className="mt-3"
            type="button"
            full
            variant="secondary"
            icon={<MapPin className="h-4 w-4" />}
            onClick={handleUseCurrentLocation}
            loading={geoPending}
            disabled={chooseNearbyMarket.isPending}
            loadingLabel="Buscando mercados"
          >
            Encontrar mercados próximos
          </AppButton>
          <p className="mt-2 text-xs leading-5 text-ink/55">Ao buscar, uma posição aproximada é consultada no serviço de mapas. Dados © <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>. A cobertura e os endereços podem estar incompletos.</p>
          {nearbyPlaces.length ? <div className="mt-3 space-y-2">
            {nearbyPlaces.map(place => {
              const existing = matchNearbyMarket(markets.data ?? [], place, form.watch("marketId"), user?.id ?? "");
              return <div key={place.placeId} className="rounded-xl border border-line p-3">
                <p className="text-sm font-bold text-ink">{place.name} · {place.distanceKm < 1 ? `${Math.round(place.distanceKm * 1000)} m` : `${place.distanceKm.toFixed(1)} km`}</p>
                <p className="mt-1 text-xs text-ink/60">{[place.address, place.neighborhood, place.city].filter(Boolean).join(" · ") || "Endereço não informado no mapa"}</p>
                <AppButton type="button" variant="secondary" full className="mt-2" disabled={chooseNearbyMarket.isPending} onClick={() => chooseNearbyMarket.mutate(place)}>
                  {existing && existing.placeId !== place.placeId && existing.createdByUserId === user?.id ? `Vincular a ${existing.name}` : "Confirmar esta loja"}
                </AppButton>
              </div>;
            })}
          </div> : null}
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
        <AppButton type="submit" full loading={finish.isPending} loadingLabel="Salvando" disabled={outbox.pendingCount > 0 || geoPending || chooseNearbyMarket.isPending}>
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
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  });
}
