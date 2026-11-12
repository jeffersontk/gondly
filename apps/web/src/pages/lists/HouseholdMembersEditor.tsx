import type { HouseholdMember } from "@gondly/types";
export function HouseholdMembersEditor({ members, onChange }: { members: HouseholdMember[]; onChange: (members: HouseholdMember[]) => void }) {
  const update = (index: number, patch: Partial<HouseholdMember>) => onChange(members.map((member, i) => i === index ? { ...member, ...patch } : member));
  const field = "mt-1 min-h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink";
  return <section className="space-y-3" aria-labelledby="household-title">
    <h2 id="household-title" className="font-black text-ink">Rotina de cada pessoa</h2>
    <p className="text-xs text-muted">Não é necessário informar nomes. Idade e gênero são opcionais e não determinam quantidades. A porção é relativa à referência do modelo: pequena 0,75×, média 1× e grande 1,25×, conforme sua escolha.</p>
    {members.map((member, index) => <fieldset key={index} className="space-y-3 rounded-2xl border border-line bg-white p-3.5">
      <legend className="px-1 text-sm font-bold">Pessoa {index + 1}</legend>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs font-semibold">Faixa etária<select className={field} value={member.ageBand} onChange={event => update(index, { ageBand: event.target.value as HouseholdMember["ageBand"] })}>
          <option value="not_informed">Prefiro não informar</option><option value="under_3">Menos de 3 anos</option><option value="3_5">3 a 5 anos</option><option value="6_12">6 a 12 anos</option><option value="13_17">13 a 17 anos</option><option value="18_59">18 a 59 anos</option><option value="60_plus">60 anos ou mais</option>
        </select></label>
        <label className="text-xs font-semibold">Gênero (opcional)<select className={field} value={member.gender} onChange={event => update(index, { gender: event.target.value as HouseholdMember["gender"] })}>
          <option value="not_informed">Prefiro não informar</option><option value="woman">Mulher</option><option value="man">Homem</option><option value="other">Outro</option>
        </select></label>
      </div>
      <label className="block text-xs font-semibold">Porção habitual<select className={field} value={member.portion} onChange={event => update(index, { portion: event.target.value as HouseholdMember["portion"] })}><option value="small">Pequena</option><option value="medium">Média</option><option value="large">Grande</option></select></label>
      <p className="text-xs text-muted">Em quantos dias da semana faz cada refeição em casa?</p>
      <div className="grid grid-cols-2 gap-3">{([{ id: "breakfast", name: "Café da manhã" }, { id: "lunch", name: "Almoço" }, { id: "dinner", name: "Jantar" }, { id: "snack", name: "Lanches" }] as const).map(meal => <label key={meal.id} className="text-xs font-semibold">{meal.name}<select className={field} value={member.mealsPerWeek[meal.id]} onChange={event => update(index, { mealsPerWeek: { ...member.mealsPerWeek, [meal.id]: Number(event.target.value) } })}>{Array.from({ length: 8 }, (_, days) => <option key={days} value={days}>{days} {days === 1 ? "dia" : "dias"}</option>)}</select></label>)}</div>
      {member.ageBand === "under_3" ? <p className="text-xs text-muted">O modelo genérico não calcula quantidades para menores de 3 anos. Os itens dessa pessoa devem ser incluídos manualmente na revisão.</p> : null}
    </fieldset>)}
  </section>;
}
