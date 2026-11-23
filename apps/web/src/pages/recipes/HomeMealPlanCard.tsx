import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ChefHat, ArrowRight, Clock3 } from "lucide-react";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { localDateKey } from "./myPlanCalendar";
import { activePlanForDate, highlightForPlan, type CalendarPlanSummary, type HighlightPlan } from "./meal-highlight";

export function HomeMealPlanCard() {
  const { user } = useAuth();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => setNow(new Date());
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => { window.clearInterval(timer); window.removeEventListener("focus", refresh); document.removeEventListener("visibilitychange", refresh); };
  }, []);
  const plans = useQuery({ queryKey: ["recipe-calendar-plans", user?.id], queryFn: () => api<CalendarPlanSummary[]>("/recipes/plans", { cacheFallback: false }), enabled: !!user?.id, refetchOnMount: "always", refetchOnWindowFocus: "always", refetchOnReconnect: true, staleTime: 60000, retry: 1 });
  const summary = activePlanForDate(plans.data ?? [], localDateKey(now));
  const plan = useQuery({ queryKey: ["recipe-meal-plan", user?.id, summary?.id], queryFn: () => api<HighlightPlan>(`/recipes/meal-plans/${summary!.id}`, { cacheFallback: false }), enabled: !!user?.id && !!summary, refetchOnMount: "always", refetchOnWindowFocus: "always", refetchOnReconnect: true, staleTime: 60000, retry: 1 });
  const meal = plan.data && summary?.id === plan.data.id ? highlightForPlan(plan.data, now) : null;
  if (!meal || plans.isError || plan.isError) return null;
  return <Link to={meal.href} aria-label={`Ver ${meal.name} do plano`} className="mb-4 block rounded-[24px] border border-mint/25 bg-white p-4 shadow-[0_12px_32px_rgba(79,70,229,0.12)] transition hover:border-mint/50">
    <div className="flex items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-mint text-white"><ChefHat className="h-6 w-6" /></span><div className="min-w-0 flex-1"><p className="text-xs font-bold text-mint">{meal.upcoming ? "PRÓXIMA REFEIÇÃO DO PLANO" : "SEU PLANO PARA AGORA"}</p><h2 className="mt-1 text-lg font-black">{meal.name}</h2></div><span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-muted"><Clock3 className="h-3.5 w-3.5" />{meal.time}</span></div>
    <h3 className="mt-3 text-base font-bold leading-6">{meal.title}</h3>
    {meal.summary ? <p className="mt-2 line-clamp-3 text-sm leading-6 text-muted">{meal.summary}</p> : null}
    <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-sm font-bold text-mint"><span>Ver refeição e preparo</span><ArrowRight className="h-4 w-4" /></div>
  </Link>;
}
