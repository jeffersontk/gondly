import type { HouseholdMember } from "@gondly/types";
import { ADULT_PORTION_REFERENCE, ageBandForYears, householdPortion } from "@gondly/utils";
export function HouseholdMembersEditor({ members, onChange }: { members: HouseholdMember[]; onChange: (members: HouseholdMember[]) => void }) {
  const update = (index: number, patch: Partial<HouseholdMember>) => onChange(members.map((member, i) => i === index ? { ...member, ...patch } : member));
  const field = "mt-1 min-h-11 min-w-0 max-w-full w-full rounded-xl border border-line bg-white px-3 text-sm text-ink";
  return <section className="space-y-3" aria-labelledby="household-title">
    <h2 id="household-title" className="font-black text-ink">Rotina de cada pessoa</h2>
    <p className="text-xs text-muted">Não é necessário informar nomes. Escolha porção manual ou referência adulta opcional por sexo, idade e atividade. A identidade de gênero não é usada para presumir sexo.</p>
    {members.map((member, index) => <fieldset key={index} className="space-y-3 rounded-2xl border border-line bg-white p-3.5">
      <legend className="px-1 text-sm font-bold">Pessoa {index + 1}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="min-w-0 text-xs font-semibold">Faixa etária<select className={field} value={member.ageBand} onChange={event => update(index, { ageBand: event.target.value as HouseholdMember["ageBand"], ageYears: undefined })}>
          <option value="not_informed">Prefiro não informar</option><option value="under_3">Menos de 3 anos</option><option value="3_5">3 a 5 anos</option><option value="6_12">6 a 12 anos</option><option value="13_17">13 a 17 anos</option><option value="18_59">18 a 59 anos</option><option value="60_plus">60 anos ou mais</option>
        </select></label>
        <label className="min-w-0 text-xs font-semibold">Identidade de gênero (opcional)<select className={field} value={member.gender} onChange={event => update(index, { gender: event.target.value as HouseholdMember["gender"] })}>
          <option value="not_informed">Prefiro não informar</option><option value="woman">Mulher</option><option value="man">Homem</option><option value="other">Outro</option>
        </select></label>
      </div>
      <label className="block text-xs font-semibold">Como estimar a porção?<select className={field} value={member.portionMode ?? "manual"} onChange={event => update(index, { portionMode: event.target.value as HouseholdMember["portionMode"] })}><option value="manual">Informar minha porção (prioridade)</option><option value="reference">Usar referência adulta por sexo, idade e atividade</option></select></label>
      {member.portionMode === "reference" ? <div className="space-y-3 rounded-xl bg-paper p-3">
        <label className="block text-xs font-semibold">Sexo para a referência (opcional)<select className={field} value={member.biologicalSex ?? "not_informed"} onChange={event => update(index, { biologicalSex: event.target.value as HouseholdMember["biologicalSex"] })}><option value="not_informed">Não informado</option><option value="female">Feminino</option><option value="male">Masculino</option></select></label>
        <label className="block text-xs font-semibold">Idade em anos (sem data de nascimento)<input className={field} type="number" min="0" max="120" step="1" inputMode="numeric" value={member.ageYears ?? ""} onChange={event => { const age = event.target.value === "" ? undefined : Number(event.target.value); update(index, { ageYears: age, ...(age !== undefined && Number.isInteger(age) && age >= 0 && age <= 120 ? { ageBand: ageBandForYears(age) } : {}) }); }} /></label>
        <label className="block text-xs font-semibold">Atividade habitual<select className={field} value={member.activityLevel ?? "not_informed"} onChange={event => update(index, { activityLevel: event.target.value as HouseholdMember["activityLevel"] })}><option value="not_informed">Não informado</option><option value="sedentary">Sedentária: atividades usuais do dia a dia</option><option value="moderate">Moderada: equivalente a caminhar 2,4–4,8 km/dia além da rotina</option><option value="active">Ativa: equivalente a caminhar mais de 4,8 km/dia além da rotina</option></select></label>
        <p role="status" className="text-xs text-muted">{householdPortion(member).multiplier === null ? householdPortion(member).reason : `Fator inicial: ${householdPortion(member).multiplier!.toLocaleString("pt-BR")}×. ${householdPortion(member).reason}`}</p>
        <p className="text-xs text-muted">A escala divide a referência energética tabular por 2.000. Essa é uma aproximação da aplicação, não uma meta calórica pessoal nem uma equivalência validada em quilos. Para menores de 18 anos, gestação, amamentação ou necessidades específicas, use a porção manual.</p>
        <a className="text-xs font-semibold text-mint underline" href={ADULT_PORTION_REFERENCE.url} target="_blank" rel="noreferrer">Fonte: {ADULT_PORTION_REFERENCE.title}</a>
      </div> : <div>
        <label className="block text-xs font-semibold">Porção habitual<select className={field} value={member.portion} onChange={event => update(index, { portion: event.target.value as HouseholdMember["portion"] })}><option value="small">Pequena (0,75×)</option><option value="medium">Média (1×)</option><option value="large">Grande (1,25×)</option></select></label>
        <p className="mt-1 text-xs text-muted">Sua escolha substitui o ajuste de referência, mesmo se sexo, idade e atividade já estiverem salvos.</p>
      </div>}
      <p className="text-xs text-muted">Em quantos dias da semana faz cada refeição em casa?</p>
      <div className="grid grid-cols-2 gap-3">{([{ id: "breakfast", name: "Café da manhã" }, { id: "lunch", name: "Almoço" }, { id: "dinner", name: "Jantar" }, { id: "snack", name: "Lanches" }] as const).map(meal => <label key={meal.id} className="text-xs font-semibold">{meal.name}<select className={field} value={member.mealsPerWeek[meal.id]} onChange={event => update(index, { mealsPerWeek: { ...member.mealsPerWeek, [meal.id]: Number(event.target.value) } })}>{Array.from({ length: 8 }, (_, days) => <option key={days} value={days}>{days} {days === 1 ? "dia" : "dias"}</option>)}</select></label>)}</div>
      {member.ageBand === "under_3" ? <p className="text-xs text-muted">O modelo genérico não calcula quantidades para menores de 3 anos. Os itens dessa pessoa devem ser incluídos manualmente na revisão.</p> : null}
    </fieldset>)}
  </section>;
}
