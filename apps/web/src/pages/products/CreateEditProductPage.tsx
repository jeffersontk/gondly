import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Trash2 } from "lucide-react";
import { AppButton, AppInput, ConfirmDialog, ScreenContainer, UnitSelect } from "../../components";
import { api } from "../../lib/api";
import type { Product } from "../../types";
import { ProductForm, productSchema, removeById, upsertById } from "../shared";

export function CreateEditProductPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [deleteOpen, setDeleteOpen] = useState(false);
  const product = useQuery({ queryKey: ["product", id], queryFn: () => api<Product>(`/products/${id}`), enabled: isEdit });
  const form = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: { name: "", brand: "", category: "", defaultUnit: "un", barcode: "" } });

  useEffect(() => {
    if (product.data) {
      form.reset({
        name: product.data.name,
        brand: product.data.brand ?? "",
        category: product.data.category ?? "",
        defaultUnit: product.data.defaultUnit,
        barcode: product.data.barcode ?? "",
      });
    }
  }, [product.data, form]);

  const save = useMutation({
    mutationFn: (values: ProductForm) => (isEdit ? api<Product>(`/products/${id}`, { method: "PUT", body: values }) : api<Product>("/products", { method: "POST", body: values })),
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

  return (
    <ScreenContainer title={isEdit ? "Editar produto" : "Novo produto"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Marca" {...form.register("brand")} />
        <AppInput label="Categoria" {...form.register("category")} />
        <UnitSelect label="Unidade padrão" {...form.register("defaultUnit")} />
        <AppInput label="Código de barras" {...form.register("barcode")} />
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
