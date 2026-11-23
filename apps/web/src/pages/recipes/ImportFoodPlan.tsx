import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../lib/api";
import { localDateKey } from "./myPlanCalendar";
import { parseFoodPlanText, readFoodPlanFile, type FoodMeal } from "./foodPlanImport";

const field = "mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-sm";
const uid = () => crypto.randomUUID();
export function ImportFoodPlan({ onSaved, onClose }: { onSaved: (id: string) => void; onClose: () => void }) {
  const client = useQueryClient();
  const [text, setText] = useState("");
  const [meals, setMeals] = useState<FoodMeal[]>([]);
  const [name, setName] = useState("Meu plano alimentar");
  const [startDate, setStartDate] = useState(localDateKey);
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  const save = useMutation({ mutationFn: () => api<{ id: string }>("/recipes/plans/import", { method: "POST", body: { name, startDate, days, reviewed, meals } }), onSuccess: result => { void client.invalidateQueries({ queryKey: ["recipe-calendar-plans"] }); onSaved(result.id); } });
  function parse(value: string) {
    setReviewed(false); setError(""); save.reset();
    try { setMeals(parseFoodPlanText(value)); } catch (cause) { setMeals([]); setError(cause instanceof Error ? cause.message : "Não foi possível identificar as refeições."); }
  }
  function updateMeals(next: FoodMeal[]) { setMeals(next); setReviewed(false); save.reset(); }
  const valid = name.trim().length >= 2 && !!startDate && days >= 1 && days <= 31 && meals.length > 0 && meals.every(meal => meal.name.trim() && meal.options.length > 0 && meal.options.every(option => option.title.trim() && (option.text.trim() || option.groups?.length) && (option.groups ?? []).every(group => group.options.length && group.options.every(item => item.text.trim()))));
  return <section aria-labelledby="import-plan-title" className="mb-5 space-y-4 rounded-2xl border border-mint/30 bg-white p-4 shadow-sm">
    <div className="flex items-center justify-between gap-3"><h2 id="import-plan-title" className="font-black">Importar plano alimentar</h2><button type="button" disabled={busy || save.isPending} onClick={onClose} className="min-h-11 px-2 text-sm text-muted">Cancelar</button></div>
    <p className="text-sm text-muted">Selecione o arquivo recebido do seu nutricionista. Após a revisão, o Gondly distribui as opções do plano pelos dias automaticamente. Você pode trocar alguma depois, se quiser.</p>
    <fieldset disabled={busy || save.isPending} className="space-y-4">
      <label className="block text-sm font-bold">Arquivo PDF, DOCX ou TXT (até 10 MB)<input type="file" accept=".pdf,.docx,.txt" className={`${field} file:mr-2 file:rounded-lg file:border-0 file:bg-mint/10 file:p-2 file:text-mint`} onChange={async event => {
        const file = event.target.files?.[0]; if (!file) return;
        setBusy(true); setError(""); setText(""); setMeals([]); setReviewed(false); save.reset();
        try { const content = await readFoodPlanFile(file); setText(content); parse(content); } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível ler o arquivo. Tente colar o texto abaixo."); } finally { setBusy(false); }
      }} /></label>
      {busy ? <p role="status" className="text-sm">Lendo arquivo e identificando refeições...</p> : null}
      <details><summary className="cursor-pointer py-2 text-sm font-bold text-mint">Conferir texto extraído ou colar conteúdo</summary><p className="text-xs text-muted">Para PDFs digitalizados, cole o texto ou monte as refeições manualmente. Use títulos como “09:00 Café da manhã” e “Almoço”. Este texto original não será salvo.</p><textarea aria-label="Texto do plano" className={`${field} min-h-40`} value={text} maxLength={150000} onChange={event => setText(event.target.value)} /><button type="button" className="mt-2 min-h-11 rounded-xl border border-line px-3 text-sm font-bold" onClick={() => parse(text)}>Identificar refeições no texto</button></details>
      {error ? <p role="alert" className="text-sm text-red-700">{error}</p> : null}
      {meals.length ? <>
        <div className="rounded-xl bg-mint/5 p-3 text-sm">Organizamos as refeições e os grupos identificados no arquivo. O calendário alternará as opções previstas, com um carboidrato e uma proteína quando esses grupos estiverem indicados. Confira quantidades e acompanhamentos antes de salvar.</div>
        <label className="block text-sm font-bold">Nome do plano<input className={field} maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
        <div className="grid grid-cols-2 gap-3"><label className="min-w-0 text-sm">Primeiro dia<input className={field} type="date" value={startDate} onChange={event => setStartDate(event.target.value)} required /></label><label className="min-w-0 text-sm">Dias no calendário<input className={field} type="number" min={1} max={31} step={1} value={days} onChange={event => setDays(Number(event.target.value))} /></label></div>
        <h3 className="font-black">Revise as refeições</h3>
      </> : null}
      {meals.map((meal, index) => <fieldset key={meal.id} className="space-y-3 rounded-xl border border-line p-3"><legend className="px-1 text-sm font-bold">Refeição {index + 1}</legend>
        <div className="grid grid-cols-[1fr_100px] gap-2"><label className="min-w-0 text-xs">Nome<input className={field} maxLength={120} value={meal.name} onChange={event => updateMeals(meals.map(item => item.id === meal.id ? { ...item, name: event.target.value } : item))} /></label><label className="text-xs">Horário<input className={field} type="time" value={meal.time} onChange={event => updateMeals(meals.map(item => item.id === meal.id ? { ...item, time: event.target.value } : item))} /></label></div>
        <label className="block text-xs">Observações · confira a quais opções se aplicam<textarea className={field} maxLength={5000} value={meal.notes} onChange={event => updateMeals(meals.map(item => item.id === meal.id ? { ...item, notes: event.target.value } : item))} /></label>
        {meal.options.map((option, position) => <div key={option.id} className="space-y-2 rounded-lg bg-paper p-3"><label className="block text-xs">Opção {position + 1} · Nome<input className={field} maxLength={120} value={option.title} onChange={event => updateMeals(meals.map(item => item.id === meal.id ? { ...item, options: item.options.map(value => value.id === option.id ? { ...value, title: event.target.value } : value) } : item))} /></label><label className="block text-xs">{option.groups?.length ? "Acompanhamentos e orientações comuns" : "Alimentos, quantidades e observações"}<textarea className={`${field} min-h-24`} maxLength={10000} value={option.text} onChange={event => updateMeals(meals.map(item => item.id === meal.id ? { ...item, options: item.options.map(value => value.id === option.id ? { ...value, text: event.target.value } : value) } : item))} /></label>
          {option.groups?.map(group => <details key={group.id} className="rounded-lg border border-line bg-white p-3"><summary className="cursor-pointer text-sm font-bold text-mint">{group.name} · {group.options.length} alternativas identificadas</summary><p className="my-2 text-xs text-muted">O calendário usará apenas uma alternativa deste grupo por dia.</p>{group.options.map((alternative, itemIndex) => <label key={alternative.id} className="mb-2 block text-xs">Alternativa {itemIndex + 1}<textarea className={field} value={alternative.text} maxLength={10000} onChange={event => updateMeals(meals.map(item => item.id === meal.id ? { ...item, options: item.options.map(value => value.id === option.id ? { ...value, groups: value.groups?.map(current => current.id === group.id ? { ...current, options: current.options.map(entry => entry.id === alternative.id ? { ...entry, title: event.target.value.replace(/\s+/g, " ").slice(0, 120), text: event.target.value } : entry) } : current) } : value) } : item))} /></label>)}</details>)}
          <button type="button" className="min-h-11 text-xs text-red-700" onClick={() => updateMeals(meals.map(item => item.id === meal.id ? { ...item, options: item.options.filter(value => value.id !== option.id) } : item))}>Remover esta opção</button></div>)}
        <div className="flex flex-wrap justify-between gap-2"><button type="button" disabled={meal.options.length >= 15} className="min-h-11 text-sm font-bold text-mint" onClick={() => updateMeals(meals.map(item => item.id === meal.id ? { ...item, options: [...item.options, { id: uid(), title: `Opção ${item.options.length + 1}`, text: "" }] } : item))}>+ Adicionar opção</button><button type="button" className="min-h-11 text-xs text-red-700" onClick={() => updateMeals(meals.filter(item => item.id !== meal.id))}>Remover refeição</button></div>
      </fieldset>)}
      <button type="button" disabled={meals.length >= 12} className="min-h-11 text-sm font-bold text-mint" onClick={() => updateMeals([...meals, { id: uid(), name: "", time: "", notes: "", options: [{ id: uid(), title: "Opção 1", text: "" }] }])}>+ Adicionar refeição manualmente</button>
      {meals.length ? <><label className="flex items-start gap-2 text-sm"><input className="mt-1" type="checkbox" checked={reviewed} onChange={event => setReviewed(event.target.checked)} />Conferi o plano original, as quantidades, as alternativas e os acompanhamentos. Quero salvar estas refeições na minha conta.</label><p className="text-xs text-muted">O arquivo fica no seu dispositivo. Somente as refeições revisadas serão salvas de forma privada. Nada será publicado como receita.</p><button type="button" disabled={!reviewed || !valid || !Number.isInteger(days)} onClick={() => save.mutate()} className="min-h-12 w-full rounded-xl bg-mint px-3 font-bold text-white disabled:opacity-40">{save.isPending ? "Salvando..." : "Salvar plano e abrir calendário"}</button></> : null}
      {save.isError ? <p role="alert" className="text-sm text-red-700">{save.error.message}</p> : null}
    </fieldset>
  </section>;
}
