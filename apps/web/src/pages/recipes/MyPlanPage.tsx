import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, ChevronLeft, ChevronRight, ChefHat, Upload } from "lucide-react";
import { ScreenContainer } from "../../components";
import { useAuth } from "../../lib/auth";
import { api } from "../../lib/api";
import { quantityLabel } from "./types";
import { localDateKey, mealsForDate, monthCells, shiftMonth } from "./myPlanCalendar";
import { ImportFoodPlan } from "./ImportFoodPlan";
import { ImportedPlanDay, type ImportedSavedPlan } from "./ImportedPlanDay";

type Summary = { id: string; name: string; startDate: string; endDate: string };
const names: Record<string, string> = { breakfast: "Café da manhã", lunch: "Almoço", snack: "Lanches", dinner: "Jantar" };
function dateLabel(date: string, options: Intl.DateTimeFormatOptions) { return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", options); }

export function MyPlanPage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const requestedPlan = params.get("plan") ?? "";
  const requestedMeal = params.get("meal") ?? "";
  const rawDate = params.get("date") ?? "";
  const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? new Date(`${rawDate}T00:00:00Z`) : null;
  const requestedDate = parsedDate && Number.isFinite(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === rawDate ? rawDate : null;
  const [chosenId, setChosenId] = useState(requestedPlan);
  const [importOpen, setImportOpen] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(requestedDate);
  const [month, setMonth] = useState<string | null>(null);
  const today = localDateKey();
  const plans = useQuery({ queryKey: ["recipe-calendar-plans", user?.id], queryFn: () => api<Summary[]>("/recipes/plans", { cacheFallback: false }), enabled: !!user?.id, refetchOnMount: "always" });
  const summary = plans.data?.find(plan => plan.id === chosenId) ?? plans.data?.[0];
  const detail = useQuery({ queryKey: ["recipe-meal-plan", user?.id, summary?.id], queryFn: () => api<ImportedSavedPlan>(`/recipes/meal-plans/${summary!.id}`, { cacheFallback: false }), enabled: !!user?.id && !!summary?.id, refetchOnMount: "always" });
  const start = summary?.startDate.slice(0, 10);
  const end = summary?.endDate.slice(0, 10);
  const date = selected ?? (start && end && (today < start || today > end) ? start : today);
  useEffect(() => { if (requestedPlan) setChosenId(requestedPlan); if (requestedDate) { setSelected(requestedDate); setMonth(null); } }, [requestedPlan, requestedDate]);
  useEffect(() => {
    if (!requestedMeal || !detail.data || summary?.id !== requestedPlan || date !== requestedDate) return;
    document.getElementById(`plan-meal-${requestedMeal}`)?.scrollIntoView({ block: "start" });
  }, [requestedMeal, requestedPlan, requestedDate, detail.data?.id, summary?.id, date]);
  const visibleMonth = month ?? date;
  const meals = mealsForDate(detail.data?.recipes ?? [], date);
  const plannedDates = new Set(detail.data?.recipes.map(meal => meal.date.slice(0, 10)));
  if (detail.data?.importedPlan && start && end) {
    const cursor = new Date(`${start}T12:00:00`);
    for (let count = 0; count < 31 && localDateKey(cursor) <= end; count++, cursor.setDate(cursor.getDate() + 1)) plannedDates.add(localDateKey(cursor));
  }
  const knownEnergy = meals.length > 0 && meals.every(meal => meal.plannedCalories !== null);
  return <ScreenContainer title="Meu plano" subtitle="Seu calendário de refeições e receitas" headerAction={<div className="flex gap-2">
    <button type="button" aria-label="Importar plano alimentar" title="Importar plano alimentar" aria-expanded={importOpen} aria-controls="import-food-plan" onClick={() => setImportOpen(true)} className={`grid h-11 w-11 place-items-center rounded-xl border shadow-sm ${importOpen ? "border-mint/30 bg-mint/10 text-mint" : "border-line bg-white text-ink/70 hover:text-mint"}`}><Upload className="h-5 w-5" aria-hidden="true" /></button>
    <button type="button" aria-label={calendarOpen ? "Ocultar calendário" : "Mostrar calendário"} title={calendarOpen ? "Ocultar calendário" : "Mostrar calendário"} aria-expanded={calendarOpen} aria-controls="meal-plan-calendar" disabled={!summary} onClick={() => setCalendarOpen(open => !open)} className={`grid h-11 w-11 place-items-center rounded-xl border shadow-sm disabled:opacity-40 ${calendarOpen ? "border-mint/30 bg-mint/10 text-mint" : "border-line bg-white text-ink/70 hover:text-mint"}`}><CalendarDays className="h-5 w-5" aria-hidden="true" /></button>
  </div>}>
    <Link to="/app/home" className="mb-4 block text-sm font-bold text-mint">← Início</Link>
    {importOpen ? <div id="import-food-plan"><ImportFoodPlan onClose={() => setImportOpen(false)} onSaved={id => { setChosenId(id); setSelected(null); setMonth(null); setImportOpen(false); }} /></div> : null}
    {plans.isPending ? <p role="status">Carregando seus planos...</p> : plans.isError ? <p role="alert">Não foi possível carregar seus planos. <button className="underline" onClick={() => void plans.refetch()}>Tentar novamente</button></p> : !summary ? <div className="rounded-2xl border border-line bg-white p-5"><CalendarDays className="mb-3 h-8 w-8 text-mint" /><h2 className="font-black">Você ainda não tem um plano salvo</h2><p className="mt-2 text-sm text-muted">Monte um cardápio para ver as receitas de cada dia aqui.</p><Link className="mt-4 block font-bold text-mint" to="/app/recipes/calorie-plan">Criar meu cardápio →</Link></div> : <>
      <label className="block text-sm font-bold">Plano<select className="mb-4 mt-2 min-h-12 w-full rounded-xl border border-line bg-white px-3" value={summary.id} onChange={event => { setChosenId(event.target.value); setSelected(null); setMonth(null); }}>{plans.data?.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select></label>
      <section id="meal-plan-calendar" hidden={!calendarOpen} aria-label="Calendário de refeições" className="rounded-2xl border border-line bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center justify-between"><button type="button" aria-label="Mês anterior" className="grid h-11 w-11 place-items-center rounded-xl bg-paper" onClick={() => setMonth(shiftMonth(visibleMonth, -1))}><ChevronLeft className="h-5 w-5" /></button><h2 aria-live="polite" className="font-black capitalize">{dateLabel(visibleMonth, { month: "long", year: "numeric" })}</h2><button type="button" aria-label="Próximo mês" className="grid h-11 w-11 place-items-center rounded-xl bg-paper" onClick={() => setMonth(shiftMonth(visibleMonth, 1))}><ChevronRight className="h-5 w-5" /></button></div>
        <div className="grid grid-cols-7 gap-1">{["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => <span key={day} className="py-2 text-center text-xs text-muted">{day}</span>)}{monthCells(visibleMonth).map((day, index) => day ? <button key={day} type="button" aria-pressed={day === date} aria-current={day === today ? "date" : undefined} aria-label={`${dateLabel(day, { day: "numeric", month: "long", year: "numeric" })}${plannedDates.has(day) ? ", com refeições" : ""}`} onClick={() => { setSelected(day); setCalendarOpen(false); }} className={`flex min-h-11 flex-col items-center justify-center rounded-xl text-sm ${day === date ? "bg-mint font-bold text-white" : day === today ? "bg-mint/10 font-bold text-mint" : "hover:bg-paper"}`}><span>{Number(day.slice(8))}</span><span className={`mt-1 h-1 w-1 rounded-full ${plannedDates.has(day) ? day === date ? "bg-white" : "bg-mint" : "bg-transparent"}`} /></button> : <span key={`blank-${index}`} />)}</div>
        <div className="mt-3 flex items-center justify-between border-t border-line pt-3"><span className="text-xs text-muted">● Dias com refeições planejadas</span><button className="min-h-11 px-3 text-sm font-bold text-mint" onClick={() => { setSelected(today); setMonth(today); }}>Hoje</button></div>
      </section>
      <h2 className="mb-3 mt-5 font-black capitalize" aria-live="polite">{dateLabel(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
      {detail.isPending ? <p role="status">Carregando refeições...</p> : detail.isError ? <p role="alert">Não foi possível carregar as refeições. <button className="underline" onClick={() => void detail.refetch()}>Tentar novamente</button></p> : detail.data?.importedPlan ? <ImportedPlanDay key={`${detail.data.id}-${date}`} plan={detail.data} date={date} inPeriod={!!start && !!end && date >= start && date <= end} /> : !meals.length ? <p className="rounded-xl border border-line bg-white p-4 text-sm text-muted">Nenhuma refeição planejada para este dia. Escolha uma data marcada no calendário.</p> : <div className="space-y-3">{knownEnergy ? <p className="text-sm text-muted">Total registrado: {quantityLabel(meals.reduce((sum, meal) => sum + Number(meal.plannedCalories), 0))} kcal{detail.data?.dailyCalorieTarget !== null ? ` · Meta: ${quantityLabel(Number(detail.data?.dailyCalorieTarget))} kcal` : ""}</p> : <p className="text-xs text-muted">Total de calorias indisponível: há refeições sem valor registrado.</p>}{meals.map((meal, index) => <Link to={`/app/recipes/${meal.recipeId}`} key={`${meal.recipeId}-${index}`} id={`plan-meal-${meal.meal}-${meal.recipeId}`} className="scroll-mt-5 flex items-center gap-3 rounded-2xl border border-line bg-white p-4 shadow-sm"><ChefHat className="h-6 w-6 shrink-0 text-mint" /><div className="min-w-0 flex-1"><p className="text-xs font-bold text-mint">{names[meal.meal] ?? meal.meal}</p><h3 className="mt-1 font-black">{meal.titleSnapshot ?? "Receita"}</h3><p className="mt-1 text-xs text-muted">{quantityLabel(Number(meal.servings))} porções · {meal.plannedCalories === null ? "Calorias não informadas" : `${quantityLabel(Number(meal.plannedCalories))} kcal`}</p><span className="mt-2 block text-sm font-bold text-mint">Ver ingredientes e preparo →</span></div><ChevronRight className="h-5 w-5 shrink-0 text-muted" /></Link>)}<p className="text-xs text-muted">Porções e calorias registradas ao criar o plano. Confira alterações na receita antes de preparar.</p></div>}
      {detail.data?.shoppingListId ? <Link to={`/app/lists/${detail.data.shoppingListId}`} className="mt-5 block rounded-xl bg-mint px-4 py-3 text-center font-bold text-white">Abrir lista de compras do plano</Link> : null}
      <Link to="/app/recipes/calorie-plan" className="mt-4 block py-3 text-center text-sm font-bold text-mint">Criar outro cardápio</Link>
    </>}
  </ScreenContainer>;
}
