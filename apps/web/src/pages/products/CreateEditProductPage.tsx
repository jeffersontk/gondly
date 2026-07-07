import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Barcode, Search, Trash2 } from "lucide-react";
import { AppButton, AppInput, BrandSelect, ConfirmDialog, QuantityInput, ScreenContainer, UnitSelect } from "../../components";
import { ApiError, api } from "../../lib/api";
import type { Product, ProductBarcodeLookup } from "../../types";
import { ProductForm, formatBRL, productSchema, removeById, upsertById } from "../shared";

export function CreateEditProductPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [barcodeMessage, setBarcodeMessage] = useState<string | null>(null);
  const product = useQuery({ queryKey: ["product", id], queryFn: () => api<Product>(`/products/${id}`), enabled: isEdit });
  const form = useForm<ProductForm>({
    resolver: zodResolver(productSchema),
    defaultValues: { name: "", brand: "", brandId: "", category: "", defaultUnit: "un", barcode: "", packageSize: undefined, packageUnit: "kg" },
  });
  const brandName = form.watch("brand") ?? "";
  const brandId = form.watch("brandId") ?? "";

  function applyProductSuggestion(suggestion: ProductBarcodeLookup) {
    const found = suggestion.product;
    if (isEdit && found.id !== id) {
      setBarcodeMessage(`Código já cadastrado em ${found.name}.`);
      return;
    }

    form.setValue("name", found.name, { shouldDirty: true });
    form.setValue("brand", found.brandRef?.name ?? found.brand ?? "", { shouldDirty: true });
    form.setValue("brandId", found.brandId ?? "", { shouldDirty: true });
    form.setValue("category", found.category ?? "", { shouldDirty: true });
    form.setValue("categoryId", found.categoryId ?? "", { shouldDirty: true });
    form.setValue("defaultUnit", found.defaultUnit, { shouldDirty: true });
    form.setValue("packageSize", found.packageSize ?? undefined, { shouldDirty: true });
    form.setValue("packageUnit", found.packageUnit ?? "kg", { shouldDirty: true });
    form.setValue("barcode", found.barcode ?? form.getValues("barcode") ?? "", { shouldDirty: true });

    const price = suggestion.lastKnownPrice?.pricePaid;
    setBarcodeMessage(price ? `Produto encontrado. Último preço conhecido: ${formatBRL(price)}.` : "Produto encontrado e preenchido.");
  }

  useEffect(() => {
    if (product.data) {
      form.reset({
        name: product.data.name,
        brand: product.data.brandRef?.name ?? product.data.brand ?? "",
        brandId: product.data.brandId ?? "",
        category: product.data.category ?? "",
        defaultUnit: product.data.defaultUnit,
        barcode: product.data.barcode ?? "",
        packageSize: product.data.packageSize ?? undefined,
        packageUnit: product.data.packageUnit ?? "kg",
      });
    }
  }, [product.data, form]);

  const save = useMutation({
    mutationFn: (values: ProductForm) =>
      isEdit
        ? api<Product>(`/products/${id}`, { method: "PUT", body: sanitizeProductForm(values) })
        : api<Product>("/products", { method: "POST", body: sanitizeProductForm(values) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["product", saved.id], saved);
      queryClient.setQueryData<Product[]>(["products", ""], (current) => upsertById(current, saved));
      navigate("/app/products");
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/products/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ["product", id] });
      queryClient.setQueryData<Product[]>(["products", ""], (current) => removeById(current, id ?? ""));
      navigate("/app/products");
    },
  });
  const barcodeLookup = useMutation({
    mutationFn: (barcode: string) => api<ProductBarcodeLookup>(`/products/barcode/${encodeURIComponent(barcode)}`),
    onMutate: () => setBarcodeMessage(null),
    onSuccess: applyProductSuggestion,
    onError: (error) => {
      if (error instanceof ApiError && error.status === 404) {
        setBarcodeMessage("Código não encontrado. Você pode continuar o cadastro normalmente.");
        return;
      }
      setBarcodeMessage("Não foi possível buscar este código agora.");
    },
  });

  function lookupBarcode() {
    const barcode = form.getValues("barcode")?.trim();
    if (!barcode || barcodeLookup.isPending) return;
    barcodeLookup.mutate(barcode);
  }

  return (
    <ScreenContainer title={isEdit ? "Editar produto" : "Novo produto"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <input type="hidden" {...form.register("brand")} />
        <input type="hidden" {...form.register("brandId")} />
        <BrandSelect
          brandId={brandId}
          brandName={brandName}
          disabled={save.isPending}
          onChange={(brand) => {
            form.setValue("brandId", brand.id ?? "");
            form.setValue("brand", brand.name);
          }}
        />
        <AppInput label="Categoria" {...form.register("category")} />
        <div className="grid grid-cols-[1fr_120px] gap-2">
          <QuantityInput label="Embalagem" placeholder="Ex.: 5" {...form.register("packageSize")} />
          <UnitSelect label="Un." {...form.register("packageUnit")} />
        </div>
        <UnitSelect label="Unidade padrão" {...form.register("defaultUnit")} />
        <div>
          <div className="grid grid-cols-[1fr_48px_48px] items-end gap-2">
            <AppInput
              label="Código de barras"
              inputMode="numeric"
              autoComplete="off"
              {...form.register("barcode", { onBlur: lookupBarcode })}
            />
            <AppButton
              type="button"
              variant="secondary"
              className="h-12 w-12 px-0"
              icon={<Search className="h-4 w-4" />}
              aria-label="Buscar código de barras"
              title="Buscar código de barras"
              loading={barcodeLookup.isPending}
              onClick={lookupBarcode}
            />
            <AppButton
              type="button"
              variant="secondary"
              className="h-12 w-12 px-0"
              icon={<Barcode className="h-4 w-4" />}
              aria-label="Escanear código de barras"
              title="Scanner preparado para um próximo MVP"
              disabled
            />
          </div>
          {barcodeMessage ? <p className="mt-1.5 text-xs font-semibold text-ink/60">{barcodeMessage}</p> : null}
        </div>
        <AppButton full type="submit" loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>
      {isEdit ? (
        <AppButton className="mt-3" full variant="danger" icon={<Trash2 className="h-4 w-4" />} onClick={() => setDeleteOpen(true)}>
          Excluir produto
        </AppButton>
      ) : null}
      <ConfirmDialog
        open={deleteOpen}
        title="Excluir produto"
        description="O produto sera removido da sua base. Historico de compras permanece preservado."
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.mutate()}
        confirmLoading={remove.isPending}
      />
    </ScreenContainer>
  );
}

function sanitizeProductForm(values: ProductForm) {
  const packageSize = typeof values.packageSize === "number" && Number.isFinite(values.packageSize) && values.packageSize > 0 ? values.packageSize : null;

  return {
    ...values,
    brand: values.brand?.trim() || null,
    brandId: values.brandId?.trim() || null,
    category: values.category?.trim() || null,
    categoryId: values.categoryId?.trim() || null,
    barcode: values.barcode?.trim() || null,
    packageSize,
    packageUnit: packageSize ? values.packageUnit : null,
  };
}
