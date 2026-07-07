import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Plus } from "lucide-react";
import type { Unit } from "@gondly/types";
import { AppButton, AppInput, BrandSelect, ProductSearchInput, QuantityInput, ScreenContainer, SectionHeader, UnitSelect, formatPackageSize, unitLabels } from "../../components";
import { sanitizeAnalyticsCategory, trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { MarketList, MarketListItem } from "../../types";
import { ItemFeedback } from "../../components/ItemFeedback";
import { addListCache, addListItemCache, ListForm, listSchema, mergeMarketList, updateListsCache } from "../shared";

type ListItemForm = {
  productId?: string;
  productName: string;
  brand?: string;
  brandId?: string;
  brandNameSnapshot?: string;
  category: string;
  packageSize?: number;
  packageUnit?: Unit;
  expectedQuantity: number;
  unit: Unit;
};

export function CreateEditListPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ["list", id], queryFn: () => api<MarketList>(`/lists/${id}`), enabled: isEdit });
  const form = useForm<ListForm>({ resolver: zodResolver(listSchema), defaultValues: { name: "", description: "" } });
  const itemForm = useForm<ListItemForm>({
    defaultValues: { productId: "", productName: "", brand: "", brandId: "", brandNameSnapshot: "", category: "", packageSize: undefined, packageUnit: "kg", expectedQuantity: 1, unit: "un" },
  });
  const [creatingSector, setCreatingSector] = useState(false);
  const [itemFeedback, setItemFeedback] = useState<{ tone: "info" | "success" | "error"; message: string } | null>(null);
  const [recentlyAddedItems, setRecentlyAddedItems] = useState<MarketListItem[]>([]);
  const selectedSector = itemForm.watch("category");
  const itemProductName = itemForm.watch("productName") ?? "";
  const itemBrandName = itemForm.watch("brandNameSnapshot") ?? itemForm.watch("brand") ?? "";
  const itemBrandId = itemForm.watch("brandId") ?? "";
  const availableSectors = useMemo(() => {
    const sectors = new Set(
      list.data?.items
        .map((item) => item.category?.trim())
        .filter((category): category is string => Boolean(category)) ?? [],
    );
    if (selectedSector.trim()) sectors.add(selectedSector.trim());
    return [...sectors].sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [list.data?.items, selectedSector]);

  useEffect(() => {
    if (list.data) form.reset({ name: list.data.name, description: list.data.description ?? "" });
  }, [list.data, form]);

  const save = useMutation({
    mutationFn: (values: ListForm) =>
      isEdit ? api<MarketList>(`/lists/${id}`, { method: "PUT", body: values }) : api<MarketList>("/lists", { method: "POST", body: values }),
    onSuccess: (saved) => {
      queryClient.setQueryData<MarketList>(["list", saved.id], (current) => mergeMarketList(current, saved));
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => (isEdit ? updateListsCache(current, saved) : addListCache(current, saved)));
      if (!isEdit) {
        trackEvent("create_list", { list_id: saved.id, source: "lists", items_count: saved.items.length });
      }
      navigate(`/app/lists/${saved.id}`);
    },
  });
  const addItem = useMutation({
    mutationFn: (values: ListItemForm) =>
      api<MarketListItem>(`/lists/${id}/items`, { method: "POST", body: sanitizeListItemForm(values) }),
    onMutate: (values) => {
      setItemFeedback({ tone: "info", message: `Adicionando ${values.productName} à lista...` });
    },
    onSuccess: (item) => {
      setRecentlyAddedItems((current) => [item, ...current.filter((entry) => entry.id !== item.id)].slice(0, 5));
      setItemFeedback({ tone: "success", message: `${item.productName} foi adicionado à lista.` });
      itemForm.reset({ productId: "", productName: "", brand: "", brandId: "", brandNameSnapshot: "", category: item.category ?? "", packageSize: undefined, packageUnit: "kg", expectedQuantity: 1, unit: "un" });
      setCreatingSector(false);
      queryClient.setQueryData<MarketList>(["list", id], (current) => addListItemCache(current, item));
      trackEvent("add_item_to_list", {
        list_id: id,
        source: "list_edit",
        category: sanitizeAnalyticsCategory(item.category),
        unit: item.unit,
        quantity: item.expectedQuantity ?? 1,
      });
    },
    onError: () => {
      setItemFeedback({ tone: "error", message: "Não foi possível adicionar o item. Tente novamente." });
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar lista" : "Nova lista"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Descrição" {...form.register("description")} />
        <AppButton type="submit" full loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>

      {isEdit ? (
        <>
          <SectionHeader title="Adicionar item" />
          <form className="grid gap-3 rounded-xl bg-white p-4 shadow-soft" onSubmit={itemForm.handleSubmit((values) => addItem.mutate(values))}>
            <input type="hidden" {...itemForm.register("productId")} />
            <input type="hidden" {...itemForm.register("brand")} />
            <input type="hidden" {...itemForm.register("brandId")} />
            <input type="hidden" {...itemForm.register("brandNameSnapshot")} />
            <ProductSearchInput
              value={itemProductName}
              onChange={(value) => itemForm.setValue("productName", value)}
              onSelect={(product) => {
                itemForm.setValue("productId", product.id);
                itemForm.setValue("brandId", product.brandId ?? "");
                itemForm.setValue("brand", product.brandRef?.name ?? product.brand ?? "");
                itemForm.setValue("brandNameSnapshot", product.brandRef?.name ?? product.brand ?? "");
                itemForm.setValue("category", product.category ?? "");
                itemForm.setValue("unit", product.defaultUnit);
                itemForm.setValue("packageSize", product.packageSize ?? undefined);
                itemForm.setValue("packageUnit", product.packageUnit ?? "kg");
              }}
            />
            <BrandSelect
              brandId={itemBrandId}
              brandName={itemBrandName}
              disabled={addItem.isPending}
              onChange={(brand) => {
                itemForm.setValue("brandId", brand.id ?? "");
                itemForm.setValue("brand", brand.name);
                itemForm.setValue("brandNameSnapshot", brand.name);
              }}
            />
            <label className="block">
              <span className="mb-1 block text-sm font-semibold text-ink/80">Setor</span>
              <select
                className="h-12 w-full rounded-xl border border-line bg-white px-3 text-base text-ink outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10"
                value={creatingSector ? "__new__" : selectedSector}
                disabled={addItem.isPending}
                onChange={(event) => {
                  if (event.target.value === "__new__") {
                    setCreatingSector(true);
                    itemForm.setValue("category", "");
                    return;
                  }
                  setCreatingSector(false);
                  itemForm.setValue("category", event.target.value);
                }}
              >
                <option value="__new__">+ Criar novo setor</option>
                <option value="">Sem setor</option>
                {availableSectors.map((sector) => (
                  <option key={sector} value={sector}>{sector}</option>
                ))}
              </select>
            </label>
            {creatingSector ? (
              <AppInput
                label="Nome do novo setor"
                placeholder="Ex.: Bebidas"
                autoFocus
                disabled={addItem.isPending}
                {...itemForm.register("category", { required: creatingSector })}
              />
            ) : null}
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <QuantityInput label="Embalagem" placeholder="Ex.: 5" disabled={addItem.isPending} {...itemForm.register("packageSize", { valueAsNumber: true })} />
              <UnitSelect label="Un." disabled={addItem.isPending} {...itemForm.register("packageUnit")} />
            </div>
            <div className="grid grid-cols-[1fr_120px] gap-2">
              <QuantityInput label="Qtd." disabled={addItem.isPending} {...itemForm.register("expectedQuantity", { valueAsNumber: true })} />
              <UnitSelect label="Un." disabled={addItem.isPending} {...itemForm.register("unit")} />
            </div>
            <AppButton type="submit" full icon={<Plus className="h-4 w-4" />} loading={addItem.isPending} loadingLabel="Adicionando">
              Adicionar
            </AppButton>
            {itemFeedback ? <ItemFeedback tone={itemFeedback.tone} message={itemFeedback.message} /> : null}
          </form>
          {recentlyAddedItems.length ? (
            <>
              <SectionHeader title="Adicionados recentemente" />
              <div className="space-y-2">
                {recentlyAddedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-soft">
                    <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-mint/12 text-mint">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-black text-ink">{item.productName}</span>
                      <span className="block text-xs font-semibold text-ink/50">
                        {[item.brandNameSnapshot ?? item.brand, formatPackageSize(item.packageSize, item.packageUnit), `${item.expectedQuantity ?? 1} ${unitLabels[item.unit]}`, item.category || "Sem setor"].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <span className="rounded-full bg-mint/12 px-2 py-1 text-xs font-black text-mint">Novo</span>
                  </div>
                ))}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </ScreenContainer>
  );
}

function sanitizeListItemForm(values: ListItemForm) {
  const packageSize = typeof values.packageSize === "number" && Number.isFinite(values.packageSize) && values.packageSize > 0 ? values.packageSize : null;

  return {
    ...values,
    productId: values.productId?.trim() || undefined,
    productName: values.productName.trim(),
    brand: values.brandNameSnapshot?.trim() || values.brand?.trim() || null,
    brandId: values.brandId?.trim() || null,
    brandNameSnapshot: values.brandNameSnapshot?.trim() || values.brand?.trim() || null,
    category: values.category.trim() || null,
    packageSize,
    packageUnit: packageSize ? values.packageUnit : null,
  };
}
