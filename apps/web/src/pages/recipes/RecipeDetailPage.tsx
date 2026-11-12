import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppButton, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import type { MarketList } from "../../types";
import { addListCache } from "../shared";
import { RecipeDetail, RecipePreview, quantityLabel, readQuantity } from "./types";
export function RecipeDetailPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const client = useQueryClient();
  const [portionInput, setPortionInput] = useState("");
  const [usePantry, setUsePantry] = useState(true);
  const recipe = useQuery({ queryKey: ["recipe", user?.id, id], queryFn: () => api<RecipeDetail>(`/recipes/${id}`, { cacheFallback: false }), refetchOnMount: true });
  const servings = portionInput === "" ? recipe.data?.servings ?? 0 : readQuantity(portionInput);
  const valid = Number.isFinite(servings) && servings > 0 && servings <= 100;
  const preview = useQuery({ queryKey: ["recipe-preview", user?.id, id, servings, usePantry], queryFn: () => api<RecipePreview>(`/recipes/${id}/preview`, { method: "POST", body: { servings, usePantry } }), enabled: recipe.isSuccess && valid, staleTime: 0, refetchOnMount: true });
  const createList = useMutation({ mutationFn: () => api<MarketList>(`/recipes/${id}/list`, { method: "POST", body: { servings, usePantry } }), onSuccess: list => { client.setQueryData<MarketList[]>(["lists"], current => addListCache(current, list)); void client.invalidateQueries({ queryKey: ["lists"] }); navigate(`/app/lists/${list.id}`); } });
  const unknown = preview.data?.ingredients.some(item => item.unknown);
  const nothingMissing = !preview.data?.ingredients.some(item => item.missing !== null && item.missing > 0);
  return <ScreenContainer title={recipe.data?.title ?? "Receita"}>
    <Link to="/app/recipes" className="mb-4 block text-sm font-bold text-mint">← Receitas e despensa</Link>
    {recipe.isLoading ? <p>Carregando...</p> : null}
    {recipe.isError ? <p role="alert">Receita indisponível. <button className="underline" onClick={() => void recipe.refetch()}>Tentar novamente</button></p> : null}
    {recipe.data ? <div className="space-y-4">
      <p className="text-sm text-muted">{recipe.data.description}</p>
      {recipe.data.sourceUrl && /^https:\/\//i.test(recipe.data.sourceUrl) ? <div className="rounded-xl border border-line bg-white p-3 text-xs text-muted"><a className="font-bold text-mint underline" href={recipe.data.sourceUrl} target="_blank" rel="noopener noreferrer">Consultar referência culinária ↗</a>{recipe.data.attribution ? <p className="mt-1">{recipe.data.attribution}</p> : null}</div> : null}
      <p className="text-xs text-muted">{recipe.data.own ? "Sua receita privada" : "Catálogo publicado"} · Rendimento original: {recipe.data.servings} porções · {recipe.data.prepMinutes + recipe.data.cookMinutes} min</p>
      <p className="text-xs text-muted">{recipe.data.caloriesPerServing == null ? "Calorias por porção não informadas: esta receita não entra no planejamento por meta calórica." : `${recipe.data.caloriesPerServing} kcal por porção · Origem declarada: ${recipe.data.nutritionSource}. Valor informado pelo autor, não auditado nutricionalmente.`}</p>
      <section className="space-y-2 rounded-2xl border border-line bg-white p-4"><h2 className="font-black">Ingredientes originais</h2>{recipe.data.ingredients.map((item, index) => <p className="text-sm" key={index}>{item.quantity === null ? "Quantidade a confirmar" : quantityLabel(item.quantity)} {item.unit} de {item.name}{item.optional ? " (opcional, fora da lista automática)" : ""}{item.note ? ` · ${item.note}` : ""}</p>)}</section>
      <section className="rounded-2xl border border-line bg-white p-4"><h2 className="font-black">Preparo</h2><ol className="mt-3 list-decimal space-y-3 pl-5">{recipe.data.steps.map((step, index) => <li className="text-sm" key={index}>{step}</li>)}</ol></section>
      <section className="space-y-3 rounded-2xl border border-line bg-white p-4"><h2 className="font-black">Montar lista a partir desta receita</h2>
        <label className="block text-sm">Quantas porções quer preparar?<input className="mt-1 min-h-12 w-full rounded-xl border border-line px-3" type="text" inputMode="decimal" value={portionInput} placeholder={String(recipe.data.servings)} onChange={event => setPortionInput(event.target.value)} /></label>
        {!valid ? <p role="alert" className="text-sm text-tomato">Informe de 0,001 a 100 porções.</p> : null}
        <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={usePantry} onChange={event => setUsePantry(event.target.checked)} />Descontar minha despensa confirmada</label>
        <p className="text-xs text-muted">Confira se o saldo da despensa ainda está disponível. Preparar esta receita não dá baixa automática no estoque.</p>
        {preview.isFetching ? <p role="status">Calculando ingredientes...</p> : null}
        {preview.isError ? <p role="alert">Não foi possível calcular. <button className="underline" onClick={() => void preview.refetch()}>Tentar novamente</button></p> : null}
        {valid && !preview.isFetching ? preview.data?.ingredients.map(item => <div key={item.ingredientId} className="border-t border-line py-2 text-sm"><strong>{item.name}</strong><p>Necessário: {item.required === null ? "a confirmar" : quantityLabel(item.required)} {item.unit} · Disponível: {quantityLabel(item.available)} {item.unit}</p><p className={item.covered ? "font-bold text-emerald-700" : "font-bold text-amber-700"}>{item.missing === null ? "Confirme a quantidade ou conversão na receita antes de gerar." : item.covered ? "Já tem na despensa" : `Comprar ${quantityLabel(item.missing)} ${item.unit}`}</p></div>) : null}
        {nothingMissing && preview.isSuccess && !unknown ? <p className="text-sm text-emerald-700">Todos os ingredientes obrigatórios estão cobertos. Para listar tudo, desmarque o desconto da despensa.</p> : null}
        <AppButton full loading={createList.isPending} disabled={!valid || preview.isFetching || !preview.isSuccess || unknown || nothingMissing} onClick={() => createList.mutate()}>Criar nova lista de ingredientes</AppButton>
        <p className="text-xs text-muted">Cria uma lista nova. As suas listas existentes serão preservadas.</p>
        {createList.isError ? <p role="alert" className="text-sm text-tomato">{createList.error.message}</p> : null}
      </section>
    </div> : null}
  </ScreenContainer>;
}
