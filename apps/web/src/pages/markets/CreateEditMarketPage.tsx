import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AppButton, AppInput, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import type { Market } from "../../types";
import { MarketForm, marketSchema, upsertById } from "../shared";

export function CreateEditMarketPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const market = useQuery({ queryKey: ["market", id], queryFn: () => api<Market>(`/markets/${id}`), enabled: isEdit });
  const form = useForm<MarketForm>({ resolver: zodResolver(marketSchema), defaultValues: { name: "", address: "", city: "", notes: "" } });

  useEffect(() => {
    if (market.data) form.reset({ name: market.data.name, address: market.data.address ?? "", city: market.data.city ?? "", notes: market.data.notes ?? "" });
  }, [market.data, form]);

  const save = useMutation({
    mutationFn: (values: MarketForm) => (isEdit ? api<Market>(`/markets/${id}`, { method: "PUT", body: values }) : api<Market>("/markets", { method: "POST", body: values })),
    onSuccess: (saved) => {
      queryClient.setQueryData<Market[]>(["markets"], (current) => upsertById(current, saved));
      queryClient.setQueryData<{ market: Market; purchaseCount: number; totalSpent: number; averageTicket: number; topProduct: string | null }>(["market-summary", saved.id], (current) =>
        current ? { ...current, market: saved } : { market: saved, purchaseCount: 0, totalSpent: 0, averageTicket: 0, topProduct: null },
      );
      navigate(`/app/markets/${saved.id}`);
    },
  });

  return (
    <ScreenContainer title={isEdit ? "Editar mercado" : "Novo mercado"}>
      <form className="space-y-3" onSubmit={form.handleSubmit((values) => save.mutate(values))}>
        <AppInput label="Nome" error={form.formState.errors.name?.message} {...form.register("name")} />
        <AppInput label="Endereço" {...form.register("address")} />
        <AppInput label="Cidade" {...form.register("city")} />
        <AppInput label="Observações" {...form.register("notes")} />
        <AppButton full type="submit" loading={save.isPending} loadingLabel="Salvando">
          Salvar
        </AppButton>
      </form>
    </ScreenContainer>
  );
}
