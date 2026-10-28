import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppButton, BrandSelect } from "../../components";
import { api } from "../../lib/api";
import type { MarketList, MarketListItem } from "../../types";
import { updateListItemCache } from "../shared";

export function ListItemBrandPreference({ listId, item }: { listId: string; item: MarketListItem }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [brand, setBrand] = useState<{ id?: string; name: string }>({ name: "" });
  const savedName = item.brandNameSnapshot ?? item.brand ?? "";
  const save = useMutation({
    mutationFn: () => api<MarketListItem>(`/lists/${listId}/items/${item.id}`, {
      method: "PUT",
      body: { brandId: brand.id || null, brand: brand.name.trim() || null, brandNameSnapshot: brand.name.trim() || null },
    }),
    onSuccess: (updated) => {
      queryClient.setQueryData<MarketList>(["list", listId], current => updateListItemCache(current, updated));
      void queryClient.invalidateQueries({ queryKey: ["lists"] });
      setEditing(false);
    },
  });

  if (!editing) return (
    <button type="button" className="mt-2 min-h-11 w-full rounded-xl border border-line px-3 py-2 text-left text-xs font-semibold text-mint" onClick={() => {
      setBrand({ id: item.brandId ?? undefined, name: savedName });
      save.reset();
      setEditing(true);
    }}>
      {savedName ? `Marca de preferência: ${savedName}` : "+ Marca de preferência (opcional)"}
    </button>
  );

  return (
    <div className="mt-3 space-y-2 rounded-xl bg-paper p-3">
      <BrandSelect label="Marca de preferência (opcional)" brandId={brand.id} brandName={brand.name} disabled={save.isPending} onChange={setBrand} />
      <p className="text-xs text-muted">Deixe em branco para aceitar qualquer marca. Você pode trocar a marca ao comprar.</p>
      <div className="flex gap-2">
        <AppButton type="button" loading={save.isPending} onClick={() => save.mutate()}>Salvar marca</AppButton>
        <button type="button" disabled={save.isPending} className="min-h-11 px-3 text-sm font-semibold text-muted" onClick={() => setEditing(false)}>Cancelar</button>
      </div>
      {save.isError ? <p role="alert" className="text-xs text-tomato">Não foi possível salvar a marca. Tente novamente.</p> : null}
    </div>
  );
}
