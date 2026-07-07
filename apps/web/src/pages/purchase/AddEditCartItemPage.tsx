import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ShoppingCart, X } from "lucide-react";
import type { Unit } from "@gondly/types";
import { AppButton, AppInput, BrandSelect, MoneyInput, ProductSearchInput, QuantityInput, UnitSelect, unitLabels } from "../../components";
import { sanitizeAnalyticsCategory, trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import { isLocalId, queuePurchaseItemUpsert, syncOutbox, type PurchaseItemPayload } from "../../lib/offlineQueue";
import type { Purchase } from "../../types";
import {
  calculatePurchaseItemTotal,
  cartItemSchema,
  CartItemForm,
  decimalValue,
  formatBRL,
  isQueueableWriteError,
  isWeightUnit,
  optimisticCartItem,
  patchPurchaseItemCache,
  priceInputFromItem,
  reconcilePurchaseCache,
  roundMoney,
  toPurchaseItemPayload,
} from "../shared";

export function AddEditCartItemPage() {
  const routeParams = useParams();
  const [params] = useSearchParams();
  const purchaseId = routeParams.purchaseId ?? params.get("purchaseId") ?? "";
  const itemId = params.get("itemId");
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [productName, setProductName] = useState("");
  const [creatingCartSector, setCreatingCartSector] = useState(false);
  const previousCartUnitRef = useRef<Unit | undefined>(undefined);
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  const purchase = active.data?.find((entry) => entry.id === purchaseId);
  const editingItem = purchase?.items.find((item) => item.id === itemId);
  const form = useForm<CartItemForm>({
    resolver: zodResolver(cartItemSchema),
    defaultValues: { productName: "", brand: "", brandId: "", brandNameSnapshot: "", packageSize: undefined, packageUnit: "kg", quantity: 1, unit: "un", priceInputMode: "unit", pricePaid: 0 },
  });
  useEffect(() => {
    if (!editingItem) return;
    const priceInput = priceInputFromItem(editingItem);
    setProductName(editingItem.productName);
    setCreatingCartSector(false);
    form.reset({
      productId: editingItem.productId ?? undefined,
      productName: editingItem.productName,
      brand: editingItem.brand ?? "",
      brandId: editingItem.brandId ?? "",
      brandNameSnapshot: editingItem.brandNameSnapshot ?? editingItem.brand ?? "",
      category: editingItem.category ?? "",
      packageSize: editingItem.packageSize ?? undefined,
      packageUnit: editingItem.packageUnit ?? "kg",
      quantity: editingItem.quantity,
      unit: editingItem.unit,
      priceInputMode: priceInput.priceInputMode,
      pricePaid: priceInput.pricePaid,
      notes: editingItem.notes ?? "",
    });
  }, [editingItem, form]);
  const save = useMutation({
    mutationFn: (values: PurchaseItemPayload) => {
      if (isLocalId(itemId)) throw new Error("Item pendente de sincronização.");
      return itemId
        ? api<Purchase>(`/purchases/${purchaseId}/items/${itemId}`, { method: "PUT", body: values })
        : api<Purchase>(`/purchases/${purchaseId}/items`, { method: "POST", body: values });
    },
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ["active-purchases"] });
      const previousActivePurchases = queryClient.getQueryData<Purchase[]>(["active-purchases"]);
      const item = optimisticCartItem(values, itemId ?? undefined, editingItem);

      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => patchPurchaseItemCache(current, purchaseId, item, itemId ?? undefined));
      navigate(`/app/purchase/${purchaseId}`);
      return { previousActivePurchases, optimisticItemId: item.id.startsWith("local-") ? item.id : undefined };
    },
    onSuccess: (saved, values, context) => {
      queryClient.setQueryData<Purchase[]>(["active-purchases"], (current) => reconcilePurchaseCache(current, saved, context?.optimisticItemId));
      trackEvent(itemId ? "update_cart_item" : "add_to_cart", {
        purchase_id: saved.id,
        source: "cart_item_form",
        unit: values.unit,
        category: sanitizeAnalyticsCategory(values.category),
        quantity: values.quantity,
        price_paid: values.pricePaid,
      });
    },
    onError: async (error, values, context) => {
      if (isQueueableWriteError(error) || isLocalId(itemId)) {
        await queuePurchaseItemUpsert({
          purchaseId,
          itemId,
          localItemId: context?.optimisticItemId,
          body: values,
        });
        void syncOutbox();
        return;
      }

      if (context?.previousActivePurchases) {
        queryClient.setQueryData(["active-purchases"], context.previousActivePurchases);
      }
    },
  });
  const sheetTitle = itemId ? "Editar item" : "Adicionar item";
  const submitLabel = itemId ? "Atualizar item" : "Adicionar ao carrinho";
  const closeSheet = () => navigate(purchaseId ? `/app/purchase/${purchaseId}` : "/app/purchase/start");
  const watchedQuantity = decimalValue(form.watch("quantity"), 0);
  const watchedUnitPrice = decimalValue(form.watch("pricePaid"), 0);
  const watchedUnit = form.watch("unit");
  const watchedPriceInputMode = form.watch("priceInputMode");
  const supportsKgPrice = isWeightUnit(watchedUnit);
  const selectedCartSector = form.watch("category") ?? "";
  const cartBrandName = form.watch("brandNameSnapshot") ?? form.watch("brand") ?? "";
  const cartBrandId = form.watch("brandId") ?? "";
  const cartSectors = useMemo(() => {
    const sectors = new Set(
      purchase?.items
        .map((item) => item.category?.trim())
        .filter((category): category is string => Boolean(category)) ?? [],
    );
    if (selectedCartSector.trim()) sectors.add(selectedCartSector.trim());
    return [...sectors].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [purchase?.items, selectedCartSector]);
  useEffect(() => {
    if (previousCartUnitRef.current === watchedUnit) return;
    previousCartUnitRef.current = watchedUnit;

    if (supportsKgPrice && form.getValues("priceInputMode") === "unit") {
      form.setValue("priceInputMode", "kg");
      return;
    }

    if (!supportsKgPrice && form.getValues("priceInputMode") === "kg") {
      form.setValue("priceInputMode", "unit");
    }
  }, [form, supportsKgPrice, watchedUnit]);

  const estimatedItemTotal = calculatePurchaseItemTotal(watchedQuantity, watchedUnit, watchedUnitPrice, watchedPriceInputMode);
  const quantityInKg = watchedUnit === "g" ? watchedQuantity / 1000 : watchedUnit === "kg" ? watchedQuantity : null;
  const estimatedPricePerKg = quantityInKg && quantityInKg > 0 ? roundMoney(estimatedItemTotal / quantityInKg) : null;
  const priceInputLabel =
    watchedPriceInputMode === "kg"
      ? "Preço por kg"
      : watchedPriceInputMode === "total"
        ? "Total pago no item"
        : `Preço por ${unitLabels[watchedUnit]}`;
  const priceFormula =
    watchedPriceInputMode === "total"
      ? "Usando o total pago informado."
      : watchedPriceInputMode === "kg"
        ? `${watchedQuantity || 0} ${unitLabels[watchedUnit]} com ${formatBRL(watchedUnitPrice || 0)}/kg`
        : `${watchedQuantity || 0} ${unitLabels[watchedUnit]} × ${formatBRL(watchedUnitPrice || 0)}`;

  return (
    <main className="fixed inset-0 z-50 flex items-end bg-ink/35 px-3 pb-0 pt-8 backdrop-blur-sm sm:items-center sm:p-4">
      <section className="mx-auto max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-[32px] border border-line bg-paper p-4 shadow-[0_-24px_60px_rgba(15,23,42,0.18)] sm:rounded-[32px]">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" aria-hidden="true" />
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.1em] text-mint">Carrinho</p>
            <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-ink">{sheetTitle}</h1>
          </div>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-ink/70 shadow-sm transition hover:border-mint/30 hover:text-mint"
            onClick={closeSheet}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        <form
          className="space-y-3"
          onSubmit={form.handleSubmit((values) => {
            const trimmedProductName = productName.trim() || values.productName.trim();
            save.mutate(toPurchaseItemPayload({ ...values, category: values.category?.trim() }, trimmedProductName));
          })}
        >
          <input type="hidden" {...form.register("brand")} />
          <input type="hidden" {...form.register("brandId")} />
          <input type="hidden" {...form.register("brandNameSnapshot")} />
          <ProductSearchInput
            value={productName}
            onChange={(value) => {
              setProductName(value);
              form.setValue("productName", value);
            }}
            onSelect={(product) => {
              form.setValue("productId", product.id);
              form.setValue("brandId", product.brandId ?? "");
              form.setValue("brand", product.brandRef?.name ?? product.brand ?? "");
              form.setValue("brandNameSnapshot", product.brandRef?.name ?? product.brand ?? "");
              form.setValue("category", product.category ?? "");
              form.setValue("unit", product.defaultUnit);
              form.setValue("packageSize", product.packageSize ?? undefined);
              form.setValue("packageUnit", product.packageUnit ?? "kg");
            }}
          />
          <BrandSelect
            brandId={cartBrandId}
            brandName={cartBrandName}
            disabled={save.isPending}
            onChange={(brand) => {
              form.setValue("brandId", brand.id ?? "");
              form.setValue("brand", brand.name);
              form.setValue("brandNameSnapshot", brand.name);
            }}
          />
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Setor</span>
            <select
              className="h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10"
              value={creatingCartSector ? "__new__" : selectedCartSector}
              disabled={save.isPending}
              onChange={(event) => {
                if (event.target.value === "__new__") {
                  setCreatingCartSector(true);
                  form.setValue("category", "");
                  return;
                }
                setCreatingCartSector(false);
                form.setValue("category", event.target.value);
              }}
            >
              <option value="__new__">+ Criar novo setor</option>
              <option value="">Sem setor</option>
              {cartSectors.map((sector) => (
                <option key={sector} value={sector}>{sector}</option>
              ))}
            </select>
          </label>
          {creatingCartSector ? (
            <AppInput
              label="Nome do novo setor"
              placeholder="Ex.: Bebidas"
              autoFocus
              disabled={save.isPending}
              {...form.register("category")}
            />
          ) : null}
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <QuantityInput label="Embalagem" placeholder="Ex.: 5" {...form.register("packageSize")} />
            <UnitSelect label="Un." {...form.register("packageUnit")} />
          </div>
          <div className="grid grid-cols-[1fr_120px] gap-2">
            <QuantityInput label="Quantidade" error={form.formState.errors.quantity?.message} {...form.register("quantity")} />
            <UnitSelect label="Unidade" {...form.register("unit")} />
          </div>
          <label className="block">
            <span className="mb-1.5 block text-sm font-semibold text-ink">Tipo de preço</span>
            <select
              className="h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10"
              {...form.register("priceInputMode")}
            >
              <option value="unit">Preço unitário</option>
              {supportsKgPrice ? <option value="kg">Preço por kg</option> : null}
              <option value="total">Total pago</option>
            </select>
          </label>
          <MoneyInput label={priceInputLabel} error={form.formState.errors.pricePaid?.message} {...form.register("pricePaid")} />
          <div className="rounded-2xl border border-line bg-white p-3 text-sm shadow-sm">
            <p className="font-semibold text-ink/60">Total deste item</p>
            <p className="mt-1 text-xl font-black tracking-[-0.03em] text-ink">{formatBRL(estimatedItemTotal)}</p>
            <p className="mt-1 text-xs text-ink/50">
              {priceFormula}
            </p>
            {estimatedPricePerKg != null ? (
              <p className="mt-2 rounded-xl bg-mint/10 px-3 py-2 text-xs font-black text-mint">
                Preço por kg: {formatBRL(estimatedPricePerKg)}
              </p>
            ) : null}
          </div>
          <AppInput label="Observação opcional" {...form.register("notes")} />
          <AppButton
            type="submit"
            full
            icon={<ShoppingCart className="h-4 w-4" />}
            loading={save.isPending}
            loadingLabel={itemId ? "Atualizando item" : "Adicionando ao carrinho"}
          >
            {submitLabel}
          </AppButton>
        </form>
      </section>
    </main>
  );
}
