import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton, AppInput, ErrorState, LoadingState, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import type { Market } from "../../types";
import { MarketForm, marketSchema } from "../shared";
import { updateMarketCaches } from "../../lib/marketCache";

export function CreateEditMarketPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const market = useQuery({ queryKey: ["market", id], queryFn: () => api<Market>(`/markets/${id}`), enabled: isEdit });
  const form = useForm<MarketForm>({
    resolver: zodResolver(marketSchema),
    defaultValues: { name: "", address: "", neighborhood: "", city: "", state: "", country: "BR", postalCode: "", notes: "" },
  });

  useEffect(() => {
    if (market.data) {
      form.reset({
        name: market.data.name,
        address: market.data.address ?? "",
        neighborhood: market.data.neighborhood ?? "",
        city: market.data.city ?? "",
        state: market.data.state ?? "",
        country: market.data.country ?? "BR",
        postalCode: market.data.postalCode ?? "",
        notes: market.data.notes ?? "",
        latitude: market.data.latitude ?? undefined,
        longitude: market.data.longitude ?? undefined,
      });
    }
  }, [market.data, form]);

  const save = useMutation({
    mutationFn: (values: MarketForm) => (isEdit ? api<Market>(`/markets/${id}`, { method: "PATCH", body: values }) : api<Market>("/markets", { method: "POST", body: values })),
    onSuccess: (saved) => {
      void updateMarketCaches(queryClient, saved);
      navigate(`/app/markets/${saved.id}`);
    },
  });

  if (isEdit && market.isLoading) return <ScreenContainer title="Editar mercado"><LoadingState /></ScreenContainer>;
  if (isEdit && (market.isError || !market.data)) return <ScreenContainer title="Editar mercado"><ErrorState /></ScreenContainer>;

  return (
    <ScreenContainer title={isEdit ? "Editar mercado" : "Novo mercado"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Cidade" {...form.register("city")} />
        <AppInput label="Bairro" {...form.register("neighborhood")} />
        <AppInput label="Estado" maxLength={2} {...form.register("state")} />
        <AppInput label="Endereço" maxLength={180} error={form.formState.errors.address?.message} {...form.register("address")} />
        <AppInput label="Observações" {...form.register("notes")} />
        {save.isError ? <p role="alert" className="rounded-xl border border-tomato/20 bg-tomato/5 p-3 text-sm font-semibold text-tomato">Não foi possível salvar o mercado. Confira os campos e sua conexão e tente novamente.</p> : null}
        <AppButton full type="submit" loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>
    </ScreenContainer>
  );
}
