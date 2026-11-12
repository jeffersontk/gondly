import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { useDebouncedValue } from "../shared";
import { IngredientOption, PantryRow, PurchaseCandidate, RecipeSummary, readQuantity } from "./types";

export function RecipesPage() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [tab, setTab] = useState("recipes");
  const [q, setQ] = useState("");
  const search = useDebouncedValue(q);
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [ingredientId, setIngredientId] = useState("");
  const [quantity, setQuantity] = useState("");
  const [entries, setEntries] = useState<Record<string, { ingredientId?: string; quantity?: string }>>({});
  const ingredients = useQuery({ queryKey: ["recipe-ingredients"], queryFn: () => api<IngredientOption[]>("/recipes/ingredients", { cacheFallback: false }), refetchOnMount: true });
  const recipes = useQuery({ queryKey: ["recipes", user?.id, search], queryFn: () => api<RecipeSummary[]>(`/recipes?q=${encodeURIComponent(search)}`, { cacheFallback: false }), enabled: tab === "recipes", refetchOnMount: true });
  const pantry = useQuery({ queryKey: ["recipe-pantry", user?.id], queryFn: () => api<PantryRow[]>("/recipes/pantry", { cacheFallback: false }), enabled: tab === "pantry", refetchOnMount: true });
  const purchases = useQuery({ queryKey: ["recipe-purchases", user?.id], queryFn: () => api<PurchaseCandidate[]>("/recipes/purchases/recent", { cacheFallback: false }), enabled: tab === "purchases", refetchOnMount: true });
  const refresh = () => { for (const key of ["recipes", "recipe-pantry", "recipe-purchases", "recipe-preview"]) void client.invalidateQueries({ queryKey: [key] }); };
  const save = useMutation({ mutationFn: () => api(`/recipes/pantry/${ingredientId}`, { method: "PUT", body: { quantity: readQuantity(quantity) } }), onSuccess: () => { setQuantity(""); refresh(); } });
  const confirm = useMutation({ mutationFn: ({ id, ingredientId, quantity }: { id: string; ingredientId: string; quantity: number }) => api(`/recipes/purchases/${id}/confirm`, { method: "POST", body: { ingredientId, quantity } }), onSuccess: refresh });
  const field = "min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-base text-ink";
  const data = (recipes.data ?? []).filter(recipe => !onlyAvailable || recipe.availableIngredients > 0);
  return <ScreenContainer title="Receitas e despensa" subtitle="Planeje uma receita ou aproveite o que já tem">
    <div className="mb-4 grid grid-cols-3 gap-1 rounded-xl border border-line bg-white p-1">{[["recipes", "Receitas"], ["pantry", "Despensa"], ["purchases", "Compras"]].map(([value, label]) => <button key={value} type="button" aria-pressed={tab === value} className={`min-h-11 rounded-lg text-sm font-bold ${tab === value ? "bg-mint/10 text-mint" : "text-muted"}`} onClick={() => setTab(value)}>{label}</button>)}</div>
    {tab === "recipes" ? <div className="space-y-4">
      <Link className="block rounded-xl bg-mint px-4 py-3 text-center font-bold text-white" to="/app/recipes/new">Cadastrar minha receita</Link>
      <Link className="block rounded-xl border border-mint/25 bg-white px-4 py-3 text-center font-bold text-mint" to="/app/recipes/calorie-plan">Montar cardápio e lista por meta diária de calorias →</Link>
      <input className={field} aria-label="Buscar receita" placeholder="Buscar receita" value={q} onChange={event => setQ(event.target.value)} />
      <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={onlyAvailable} onChange={event => setOnlyAvailable(event.target.checked)} />Sugerir com ingredientes da minha despensa</label>
      <p className="text-xs text-muted">Ordenadas pela proporção de ingredientes cobertos no rendimento original. O filtro também inclui disponibilidade parcial: confira o que falta e a última confirmação na aba Despensa. As receitas não são certificadas para restrições alimentares.</p>
      {recipes.isLoading ? <p role="status">Carregando receitas...</p> : null}
      {recipes.isError ? <p role="alert">Não foi possível carregar. <button onClick={() => void recipes.refetch()} className="underline">Tentar novamente</button></p> : null}
      {recipes.isSuccess && !data.length ? <p className="rounded-xl border border-line bg-white p-4 text-sm">{onlyAvailable ? "Nenhuma receita tem ingredientes confirmados na sua despensa. Confira as abas Despensa e Compras ou desmarque o filtro." : "Nenhuma receita disponível nesta busca. Cadastre sua receita para calcular os ingredientes e montar uma lista."}</p> : null}
      {data.map(recipe => <Link key={recipe.id} to={`/app/recipes/${recipe.id}`} className="block rounded-2xl border border-line bg-white p-4 shadow-sm"><h2 className="font-black">{recipe.title}</h2><p className="mt-1 text-sm text-muted">{recipe.description}</p><p className="mt-2 text-xs text-mint">{recipe.own ? "Sua receita privada" : "Catálogo publicado"} · {recipe.servings} porções · {recipe.minutes} min</p><p className="mt-2 text-sm">{recipe.coveredIngredients} de {recipe.requiredIngredients} ingredientes cobertos · {recipe.missingIngredients} a conferir/comprar</p><span className="mt-3 block text-sm font-bold text-mint">Ver preparo e montar lista →</span></Link>)}
      <p className="text-xs text-muted">Até 100 receitas por busca. Compartilhamento e avaliações comunitárias ainda não estão disponíveis.</p>
    </div> : null}
    {tab === "pantry" ? <div className="space-y-4">
      <p className="text-sm text-muted">Informe o total que ainda tem em casa. Salvar substitui o saldo desse ingrediente. Use zero para marcar que acabou. As compras não entram automaticamente.</p>
      {ingredients.isError ? <p role="alert">Não foi possível carregar ingredientes. <button className="underline" onClick={() => void ingredients.refetch()}>Tentar novamente</button></p> : null}
      <form className="space-y-3 rounded-xl border border-line bg-white p-3" onSubmit={event => { event.preventDefault(); save.mutate(); }}>
        <label className="block text-sm">Ingrediente<select className={field} required value={ingredientId} onChange={event => setIngredientId(event.target.value)}><option value="">Selecione</option>{ingredients.data?.map(item => <option key={item.id} value={item.id}>{item.name} ({item.baseUnit})</option>)}</select></label>
        <label className="block text-sm">Total disponível ({ingredients.data?.find(item => item.id === ingredientId)?.baseUnit ?? "selecione a unidade"})<input className={field} inputMode="decimal" required value={quantity} onChange={event => setQuantity(event.target.value)} /></label>
        <AppButton type="submit" loading={save.isPending} disabled={!ingredientId || !Number.isFinite(readQuantity(quantity)) || readQuantity(quantity) < 0}>Confirmar estoque</AppButton>
        {save.isError ? <p role="alert" className="text-sm text-tomato">{save.error.message}</p> : save.isSuccess ? <p role="status" className="text-sm text-mint">Estoque atualizado.</p> : null}
      </form>
      <p className="text-xs text-muted">Se o ingrediente não estiver no catálogo, cadastre uma receita com ele primeiro. O seletor mostra os primeiros 200 ingredientes.</p>
      {pantry.isLoading ? <p>Carregando despensa...</p> : null}
      {pantry.isError ? <p role="alert">Não foi possível carregar a despensa. <button className="underline" onClick={() => void pantry.refetch()}>Tentar novamente</button></p> : null}
      {pantry.isSuccess && !pantry.data.length ? <p>Nenhum estoque confirmado ainda.</p> : null}
      {pantry.data?.map(item => <div className="rounded-xl border border-line bg-white p-3" key={item.id}><strong>{item.ingredient.name}</strong><p>{Number(item.quantity).toLocaleString("pt-BR")} {item.ingredient.baseUnit}</p><p className="text-xs text-muted">Confirmado em {new Date(item.confirmedAt).toLocaleDateString("pt-BR")}</p><button type="button" className="mt-2 min-h-11 text-sm font-bold text-mint" onClick={() => { setIngredientId(item.ingredientId); setQuantity(String(item.quantity)); }}>Ajustar saldo</button></div>)}
    </div> : null}
    {tab === "purchases" ? <div className="space-y-4">
      <p className="text-sm text-muted">Até 200 itens de compras finalizadas nos últimos 60 dias. Escolha o ingrediente e confirme quanto ainda tem, na unidade indicada. A confirmação soma ao saldo da despensa; não confirme novamente produtos que já incluiu manualmente.</p>
      {purchases.isLoading ? <p>Carregando compras...</p> : null}
      {purchases.isError ? <p role="alert">Não foi possível carregar as compras. <button className="underline" onClick={() => void purchases.refetch()}>Tentar novamente</button></p> : null}
      {purchases.isSuccess && !purchases.data.length ? <p>Nenhuma compra recente finalizada disponível.</p> : null}
      {confirm.isError ? <p role="alert" className="text-sm text-tomato">{confirm.error.message}</p> : null}
      {purchases.data?.map(item => {
        const entry = entries[item.id] ?? {};
        const selected = entry.ingredientId ?? item.suggestedIngredientId ?? "";
        const option = ingredients.data?.find(ingredient => ingredient.id === selected);
        return <div key={item.id} className="space-y-2 rounded-xl border border-line bg-white p-3"><strong>{item.productName}</strong><p className="text-xs text-muted">Comprado: {item.quantity} {item.unit}{item.packageSize ? ` · embalagem ${item.packageSize} ${item.packageUnit}` : ""} · {new Date(item.purchase.completedAt).toLocaleDateString("pt-BR")}</p>{item.confirmed ? <p className="text-sm font-bold text-mint">Já confirmado nesta conta. Ajuste o saldo na aba Despensa se necessário.</p> : <>
          <label className="block text-sm">Conferir ingrediente<select className={field} value={selected} onChange={event => setEntries(current => ({ ...current, [item.id]: { ...entry, ingredientId: event.target.value, quantity: "" } }))}><option value="">Selecione</option>{ingredients.data?.map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.name} ({ingredient.baseUnit})</option>)}</select></label>
          <label className="block text-sm">Quanto ainda tem ({option?.baseUnit ?? "selecione o ingrediente"})<input className={field} inputMode="decimal" value={entry.quantity ?? ""} onChange={event => setEntries(current => ({ ...current, [item.id]: { ...entry, quantity: event.target.value } }))} /></label>
          <AppButton loading={confirm.isPending && confirm.variables?.id === item.id} disabled={confirm.isPending || !option || !Number.isFinite(readQuantity(entry.quantity ?? "")) || readQuantity(entry.quantity ?? "") <= 0} onClick={() => confirm.mutate({ id: item.id, ingredientId: selected, quantity: readQuantity(entry.quantity!) })}>Confirmar na despensa</AppButton>
        </>}</div>;
      })}
    </div> : null}
  </ScreenContainer>;
}
