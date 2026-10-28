import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Apple,
  Check,
  ChevronRight,
  Heart,
  Home,
  Info,
  Minus,
  Plus,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import type { DietPlanItem, DietPlanSuggestion, DietRestriction, DietType, Unit } from "@gondly/types";
import {
  DIET_DEFINITIONS,
  RESTRICTION_DEFINITIONS,
  generateDietSuggestion,
} from "@gondly/utils";
import { AppButton, AppInput, ScreenContainer, SectionHeader } from "../../components";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import type { MarketList } from "../../types";
import { addListCache } from "../shared";

type EditablePlanItem = DietPlanItem & {
  id: string;
  alreadyAtHome: boolean;
};

export function DietPlanPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Wizard step: 'config' | 'review'
  const [step, setStep] = useState<"config" | "review">("config");

  // Configuration options
  const [dietType, setDietType] = useState<DietType>("balanced");
  const [familySize, setFamilySize] = useState<number>(2);
  const [periodDays, setPeriodDays] = useState<number>(7);
  const [selectedRestrictions, setSelectedRestrictions] = useState<DietRestriction[]>([]);

  // Review step state
  const [suggestedListTitle, setSuggestedListTitle] = useState("");
  const [planItems, setPlanItems] = useState<EditablePlanItem[]>([]);
  const [premisesText, setPremisesText] = useState("");

  // Quick add in review
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("Hortifrúti");

  const toggleRestriction = (id: DietRestriction) => {
    setSelectedRestrictions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleGenerate = () => {
    const suggestion: DietPlanSuggestion = generateDietSuggestion({
      dietType,
      familySize,
      periodDays,
      restrictions: selectedRestrictions,
    });

    const periodLabel = periodDays === 7 ? "Semanal" : periodDays === 15 ? "Quinzenal" : "Mensal";
    setSuggestedListTitle(`Compras ${periodLabel} - ${suggestion.dietName} (${familySize} ${familySize === 1 ? "pessoa" : "pessoas"})`);
    setPremisesText(suggestion.premises);
    setPlanItems(
      suggestion.items.map((item, index) => ({
        ...item,
        id: `diet-item-${index}-${Date.now()}`,
        alreadyAtHome: false,
      })),
    );
    setStep("review");
    trackEvent("generate_diet_plan", {
      diet_type: dietType,
      family_size: familySize,
      period_days: periodDays,
      restrictions_count: selectedRestrictions.length,
    });
  };

  const updateItemQuantity = (id: string, delta: number) => {
    setPlanItems((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const stepAmount = item.unit === "un" || item.unit === "pacote" || item.unit === "caixa" ? 1 : 0.5;
        const nextVal = Math.max(stepAmount, Math.round((item.suggestedQuantity + delta * stepAmount) * 10) / 10);
        return { ...item, suggestedQuantity: nextVal };
      }),
    );
  };

  const setExactItemQuantity = (id: string, value: number) => {
    const safeVal = Math.max(0.1, Number.isFinite(value) ? value : 1);
    setPlanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, suggestedQuantity: safeVal } : item)),
    );
  };

  const toggleAlreadyAtHome = (id: string) => {
    setPlanItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, alreadyAtHome: !item.alreadyAtHome } : item)),
    );
  };

  const removeItem = (id: string) => {
    setPlanItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleAddNewItem = () => {
    if (!newItemName.trim()) return;
    const newItem: EditablePlanItem = {
      id: `custom-item-${Date.now()}`,
      productName: newItemName.trim(),
      category: newItemCategory || "Mercearia",
      unit: "un",
      suggestedQuantity: 1,
      baseWeeklyPerPerson: 1,
      alreadyAtHome: false,
    };
    setPlanItems((prev) => [...prev, newItem]);
    setNewItemName("");
  };

  const itemsToBuy = useMemo(() => planItems.filter((i) => !i.alreadyAtHome), [planItems]);
  const itemsAtHome = useMemo(() => planItems.filter((i) => i.alreadyAtHome), [planItems]);

  const groupedItems = useMemo(() => {
    const groups = new Map<string, EditablePlanItem[]>();
    for (const item of itemsToBuy) {
      const cat = item.category || "Outros";
      const existing = groups.get(cat) ?? [];
      existing.push(item);
      groups.set(cat, existing);
    }
    return groups;
  }, [itemsToBuy]);

  const createList = useMutation({
    mutationFn: (body: {
      name: string;
      description?: string;
      items: Array<{
        productName: string;
        category?: string;
        unit: Unit;
        expectedQuantity: number;
        packageSize?: number | null;
        packageUnit?: Unit | null;
      }>;
    }) => api<MarketList>("/lists/from-diet-plan", { method: "POST", body }),
    onSuccess: (saved) => {
      queryClient.setQueryData<MarketList[]>(["lists"], (current) => addListCache(current, saved));
      trackEvent("create_list_from_diet_plan", {
        list_id: saved.id,
        items_count: itemsToBuy.length,
        items_at_home_count: itemsAtHome.length,
        diet_type: dietType,
      });
      navigate(`/app/lists/${saved.id}`);
    },
  });

  const handleFinishCreate = () => {
    if (!suggestedListTitle.trim()) return;
    createList.mutate({
      name: suggestedListTitle.trim(),
      description: `Planejamento para ${familySize} ${familySize === 1 ? "pessoa" : "pessoas"} (${periodDays} dias) · ${premisesText}`,
      items: itemsToBuy.map((item) => ({
        productName: item.productName,
        category: item.category,
        unit: item.unit,
        expectedQuantity: item.suggestedQuantity,
        packageSize: item.packageSize,
        packageUnit: item.packageUnit,
      })),
    });
  };

  return (
    <ScreenContainer
      title={step === "config" ? "Planejar por dieta e família" : "Revisar lista sugerida"}
      subtitle={step === "config" ? "Sugestão inteligente para sua despensa" : `${itemsToBuy.length} itens a comprar`}
    >
      {step === "config" ? (
        <div className="space-y-5">
          {/* 1. Escolha do Perfil / Dieta */}
          <div>
            <SectionHeader title="1. Perfil alimentar da família" />
            <div className="grid gap-2.5 sm:grid-cols-2">
              {DIET_DEFINITIONS.map((def) => {
                const isSelected = dietType === def.id;
                return (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => setDietType(def.id)}
                    className={[
                      "flex flex-col text-left rounded-2xl border p-3.5 transition",
                      isSelected
                        ? "border-mint bg-mint/5 ring-2 ring-mint/20 shadow-sm"
                        : "border-line bg-white hover:border-mint/30",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-black text-ink">{def.title}</span>
                      <span
                        className={[
                          "grid h-5 w-5 place-items-center rounded-full border text-[10px] font-bold",
                          isSelected ? "border-mint bg-mint text-white" : "border-line bg-white text-transparent",
                        ].join(" ")}
                      >
                        ✓
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-ink/65">{def.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Quantidade de Pessoas e Período */}
          <div>
            <SectionHeader title="2. Pessoas e período" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-3.5 shadow-sm">
                <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-ink/60">
                  <Users className="h-4 w-4 text-mint" /> Pessoas na casa
                </span>
                <div className="mt-2.5 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => setFamilySize((prev) => Math.max(1, prev - 1))}
                    disabled={familySize <= 1}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-slate-50 text-ink transition hover:bg-slate-100 disabled:opacity-40"
                    aria-label="Diminuir pessoas"
                  >
                    <Minus className="h-4 w-4" />
                  </button>
                  <span className="text-xl font-black text-ink">
                    {familySize} {familySize === 1 ? "pessoa" : "pessoas"}
                  </span>
                  <button
                    type="button"
                    onClick={() => setFamilySize((prev) => Math.min(20, prev + 1))}
                    disabled={familySize >= 20}
                    className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-slate-50 text-ink transition hover:bg-slate-100"
                    aria-label="Aumentar pessoas"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-3.5 shadow-sm">
                <span className="text-xs font-bold uppercase tracking-wider text-ink/60">Período de compras</span>
                <div className="mt-2.5 grid grid-cols-3 gap-1.5">
                  {[
                    { days: 7, label: "7 dias" },
                    { days: 15, label: "15 dias" },
                    { days: 30, label: "1 mês" },
                  ].map((p) => (
                    <button
                      key={p.days}
                      type="button"
                      onClick={() => setPeriodDays(p.days)}
                      className={[
                        "h-10 rounded-xl text-xs font-bold transition",
                        periodDays === p.days
                          ? "bg-mint text-white shadow-soft"
                          : "border border-line bg-slate-50 text-ink/80 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 3. Restrições e Alimentos a Evitar */}
          <div>
            <SectionHeader title="3. Restrições e itens a evitar (opcional)" />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {RESTRICTION_DEFINITIONS.map((r) => {
                const checked = selectedRestrictions.includes(r.id);
                return (
                  <label
                    key={r.id}
                    className={[
                      "flex cursor-pointer items-start gap-2.5 rounded-xl border p-2.5 text-xs transition",
                      checked ? "border-tomato/40 bg-tomato/5 font-bold text-ink" : "border-line bg-white text-ink/75 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRestriction(r.id)}
                      className="mt-0.5 h-3.5 w-3.5 rounded border-line text-tomato focus:ring-tomato"
                    />
                    <span>{r.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Botão de Geração */}
          <div className="pt-2">
            <AppButton
              full
              variant="primary"
              icon={<Sparkles className="h-4 w-4" />}
              onClick={handleGenerate}
            >
              Gerar lista sugerida
            </AppButton>
          </div>
        </div>
      ) : (
        /* Etapa de Revisão */
        <div className="space-y-4">
          <div className="rounded-2xl border border-line bg-white p-3.5 shadow-sm">
            <AppInput
              label="Nome da lista"
              value={suggestedListTitle}
              onChange={(e) => setSuggestedListTitle(e.target.value)}
              placeholder="Ex.: Compras do Mês"
            />
            <div className="mt-3 flex items-start gap-2 rounded-xl bg-mint/8 p-2.5 text-xs leading-relaxed text-ink/70">
              <Info className="mt-0.5 h-3.5 w-3.5 flex-none text-mint" />
              <span>{premisesText}</span>
            </div>
          </div>

          {/* Resumo de Contagem */}
          <div className="flex items-center justify-between px-1 text-xs font-semibold text-ink/60">
            <span>
              {itemsToBuy.length} {itemsToBuy.length === 1 ? "item a comprar" : "itens a comprar"}
              {itemsAtHome.length > 0 ? ` · ${itemsAtHome.length} já possuo` : ""}
            </span>
            <button
              type="button"
              onClick={() => setStep("config")}
              className="flex items-center gap-1 font-bold text-mint hover:underline"
            >
              <RotateCcw className="h-3 w-3" /> Alterar premissas
            </button>
          </div>

          {/* Itens Agrupados por Setor */}
          <div className="space-y-3">
            {[...groupedItems.entries()].map(([category, items]) => (
              <div key={category} className="rounded-2xl border border-line bg-white p-3 shadow-soft">
                <p className="mb-2 text-xs font-black uppercase tracking-wider text-ink/50">{category}</p>
                <div className="divide-y divide-line/60">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2.5 gap-2">
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-ink">{item.productName}</span>
                        <div className="mt-1 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleAlreadyAtHome(item.id)}
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-slate-50 px-2 py-0.5 text-[10px] font-bold text-ink/65 hover:bg-slate-100"
                          >
                            <Home className="h-2.5 w-2.5 text-mint" />
                            Já tenho em casa
                          </button>
                        </div>
                      </div>

                      {/* Quantidade */}
                      <div className="flex items-center gap-1.5 flex-none">
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, -1)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-slate-50 text-ink/70 hover:bg-slate-100"
                          aria-label="Diminuir"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <div className="flex items-baseline gap-0.5 px-1 min-w-[50px] justify-center">
                          <input
                            type="number"
                            step="any"
                            value={item.suggestedQuantity}
                            onChange={(e) => setExactItemQuantity(item.id, parseFloat(e.target.value) || 0)}
                            className="w-12 text-center text-sm font-black text-ink outline-none bg-transparent"
                          />
                          <span className="text-[11px] font-bold text-ink/50">{item.unit}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => updateItemQuantity(item.id, 1)}
                          className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-slate-50 text-ink/70 hover:bg-slate-100"
                          aria-label="Aumentar"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="grid h-7 w-7 place-items-center rounded-lg text-ink/30 hover:text-tomato transition ml-1"
                          aria-label="Remover da sugestão"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Itens que já tenho em casa */}
          {itemsAtHome.length > 0 ? (
            <div className="rounded-2xl border border-dashed border-line bg-slate-50/70 p-3">
              <p className="text-xs font-bold text-ink/50">
                Itens marcados como &quot;Já tenho em casa&quot; ({itemsAtHome.length}) — não serão adicionados à lista
              </p>
              <div className="mt-2 divide-y divide-line/40">
                {itemsAtHome.map((item) => (
                  <div key={item.id} className="flex items-center justify-between py-1.5 text-xs text-ink/60">
                    <span className="line-through">{item.productName}</span>
                    <button
                      type="button"
                      onClick={() => toggleAlreadyAtHome(item.id)}
                      className="font-bold text-mint hover:underline text-[11px]"
                    >
                      Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {/* Adicionar item avulso */}
          <div className="rounded-2xl border border-line bg-white p-3.5 shadow-sm">
            <span className="text-xs font-black uppercase tracking-wider text-ink/50">Adicionar outro item à sugestão</span>
            <div className="mt-2 flex gap-2">
              <input
                type="text"
                placeholder="Ex.: Café solúvel, pasta de dente..."
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddNewItem();
                  }
                }}
                className="h-10 min-w-0 flex-1 rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint focus:ring-2 focus:ring-mint/20"
              />
              <button
                type="button"
                onClick={handleAddNewItem}
                className="inline-flex h-10 items-center gap-1 rounded-xl bg-slate-100 px-3 text-xs font-bold text-ink hover:bg-slate-200 transition"
              >
                <Plus className="h-3.5 w-3.5" /> Adicionar
              </button>
            </div>
          </div>

          {/* Botão de Criação da Lista */}
          <div className="pt-2">
            <AppButton
              full
              variant="primary"
              icon={<Check className="h-4 w-4" />}
              loading={createList.isPending}
              loadingLabel="Criando lista"
              disabled={itemsToBuy.length === 0}
              onClick={handleFinishCreate}
            >
              Criar lista de compras ({itemsToBuy.length} itens)
            </AppButton>
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}

