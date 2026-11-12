import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AppButton, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import { readQuantity } from "./types";
export function CreateRecipePage() {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [servings, setServings] = useState("2");
  const [prep, setPrep] = useState("10");
  const [cook, setCook] = useState("0");
  const [steps, setSteps] = useState("");
  const [calories, setCalories] = useState("");
  const [nutritionSource, setNutritionSource] = useState("");
  const [mealTypes, setMealTypes] = useState<string[]>(["lunch", "dinner"]);
  const [lines, setLines] = useState([{ name: "", quantity: "", unit: "g" }]);
  const create = useMutation({ mutationFn: () => api<{ id: string }>("/recipes", { method: "POST", body: { title, description, servings: Number(servings), prepMinutes: Number(prep), cookMinutes: Number(cook), mealTypes, ...(calories.trim() ? { caloriesPerServing: readQuantity(calories), nutritionSource } : {}), steps: steps.split("\n").map(step => step.trim()).filter(Boolean), ingredients: lines.map(line => ({ ...line, quantity: readQuantity(line.quantity) })) } }), onSuccess: recipe => { void client.invalidateQueries({ queryKey: ["recipes"] }); void client.invalidateQueries({ queryKey: ["recipe-ingredients"] }); navigate(`/app/recipes/${recipe.id}`); } });
  const field = "mt-1 min-h-12 w-full min-w-0 rounded-xl border border-line bg-white px-3 text-base";
  return <ScreenContainer title="Cadastrar minha receita" subtitle="Ela ficará privada na sua conta">
    <Link className="mb-4 block font-bold text-mint" to="/app/recipes">← Receitas</Link>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); create.mutate(); }}>
      <label className="block text-sm">Nome<input className={field} required minLength={2} maxLength={120} value={title} onChange={event => setTitle(event.target.value)} /></label>
      <label className="block text-sm">Descrição<textarea className={`${field} py-3`} maxLength={2000} value={description} onChange={event => setDescription(event.target.value)} /></label>
      <div className="grid grid-cols-3 gap-2">{[["Porções", servings, setServings], ["Preparo (min)", prep, setPrep], ["Cozimento (min)", cook, setCook]].map(([label, value, setter]) => <label className="min-w-0 text-xs" key={String(label)}>{String(label)}<input className={field} required type="number" step="1" min={label === "Porções" ? 1 : 0} max={label === "Porções" ? 100 : 1440} value={String(value)} onChange={event => (setter as (value: string) => void)(event.target.value)} /></label>)}</div>
      <h2 className="font-black">Ingredientes para esse rendimento</h2>
      <fieldset className="space-y-3 rounded-xl border border-line p-3"><legend className="px-1 font-bold">Planejamento por calorias (opcional)</legend>
        <label className="block text-sm">Calorias por uma porção, não pela receita inteira (kcal)<input className={field} type="number" min="1" max="10000" step="0.01" value={calories} onChange={event => setCalories(event.target.value)} /></label>
        {calories ? <label className="block text-sm">Origem do valor (rótulo, cálculo ou fonte consultada)<input className={field} required minLength={2} maxLength={1000} value={nutritionSource} onChange={event => setNutritionSource(event.target.value)} /></label> : null}
        <p className="text-xs text-muted">Não chute calorias. Sem informação de energia, a receita continua disponível, mas não entra no cardápio por meta calórica. Os valores serão identificados como declarados pelo autor.</p>
        <div className="grid grid-cols-2 gap-2">{[["breakfast", "Café da manhã"], ["lunch", "Almoço"], ["dinner", "Jantar"], ["snack", "Lanches"]].map(([slot, label]) => <label className="flex min-h-11 items-center gap-2 text-sm" key={slot}><input type="checkbox" checked={mealTypes.includes(slot)} onChange={() => setMealTypes(current => current.includes(slot) ? current.filter(value => value !== slot) : [...current, slot])} />{label}</label>)}</div>
      </fieldset>
      <p className="text-xs text-muted">Use gramas, mililitros ou unidades. Exemplos: 500 g de arroz, 250 ml de leite, 2 unidades de ovo. A lista será ajustada pela quantidade de porções.</p>
      {lines.map((line, index) => <fieldset className="space-y-2 rounded-xl border border-line bg-white p-3" key={index}><legend className="px-1 text-sm font-bold">Ingrediente {index + 1}</legend><label className="block text-sm">Nome<input className={field} required minLength={2} maxLength={120} value={line.name} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><div className="grid grid-cols-2 gap-2"><label className="text-sm">Quantidade<input className={field} required inputMode="decimal" value={line.quantity} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, quantity: event.target.value } : item))} /></label><label className="text-sm">Unidade<select className={field} value={line.unit} onChange={event => setLines(current => current.map((item, i) => i === index ? { ...item, unit: event.target.value } : item))}><option value="g">g</option><option value="ml">ml</option><option value="un">unidades</option></select></label></div>{lines.length > 1 ? <button type="button" className="min-h-11 text-sm text-tomato" onClick={() => setLines(current => current.filter((_, i) => i !== index))}>Remover ingrediente</button> : null}</fieldset>)}
      <AppButton type="button" variant="secondary" disabled={lines.length >= 50} onClick={() => setLines(current => [...current, { name: "", quantity: "", unit: "g" }])}>Adicionar ingrediente</AppButton>
      <label className="block text-sm">Preparo: uma etapa por linha<textarea className={`${field} min-h-40 py-3`} required maxLength={20000} value={steps} onChange={event => setSteps(event.target.value)} /></label>
      <AppButton type="submit" full loading={create.isPending} disabled={lines.some(line => !Number.isFinite(readQuantity(line.quantity)) || readQuantity(line.quantity) <= 0)}>Salvar receita privada</AppButton>
      {create.isError ? <p role="alert" className="text-sm text-tomato">{create.error.message}</p> : null}
    </form>
  </ScreenContainer>;
}
