import { useState } from "react";
import { ChevronDown, ChevronUp, Footprints, Info, Pause, Play, RotateCcw } from "lucide-react";
import { usePurchaseStepCounter } from "../../lib/stepCounter";

export function PurchaseStepCounterCard({ purchaseId }: { purchaseId: string }) {
  const [expanded, setExpanded] = useState(false);
  const counter = usePurchaseStepCounter(purchaseId);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white shadow-soft transition">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex w-full items-center justify-between p-3.5 text-left transition hover:bg-slate-50/80"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-mint/10 text-mint">
            <Footprints className="h-4 w-4" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-ink/70">Passos no mercado</span>
              {counter.status === "counting" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />
                  Ativo
                </span>
              ) : counter.steps > 0 ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                  {counter.steps} passos
                </span>
              ) : null}
            </div>
            <p className="text-xs font-semibold text-ink/60">
              {counter.steps > 0 ? `${counter.steps} passos · ${counter.distanceLabel}` : "Contador opcional da sessão de compra"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 text-ink/40">
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-line/60 bg-slate-50/50 p-4">
          <div className="rounded-xl bg-white p-3.5 shadow-sm">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-black text-ink">{counter.steps.toLocaleString("pt-BR")}</span>
                <span className="ml-1.5 text-xs font-bold text-ink/60">passos</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-black text-mint">{counter.distanceLabel}</span>
                <span className="block text-[11px] font-semibold text-ink/50">~{counter.calories} kcal estimadas</span>
              </div>
            </div>

            {counter.status === "unsupported" ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>
                  Sensor de movimento não detectado neste navegador ou dispositivo. Você poderá informar os passos manualmente ao finalizar.
                </span>
              </div>
            ) : counter.status === "permission_denied" ? (
              <div className="mt-3 flex items-start gap-2 rounded-xl bg-amber-50 p-2.5 text-xs text-amber-900">
                <Info className="mt-0.5 h-3.5 w-3.5 flex-none" />
                <span>Permissão para sensores de movimento foi negada. A compra continua funcionando normalmente.</span>
              </div>
            ) : null}

            <div className="mt-3 flex items-center gap-2">
              {counter.status === "idle" || counter.status === "unsupported" || counter.status === "permission_denied" ? (
                <button
                  type="button"
                  onClick={() => counter.start()}
                  disabled={counter.status === "unsupported" || counter.status === "permission_denied"}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-mint px-3 text-xs font-bold text-white shadow-soft transition hover:bg-mint/90 disabled:opacity-50"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Iniciar contagem
                </button>
              ) : null}

              {counter.status === "counting" ? (
                <button
                  type="button"
                  onClick={() => counter.pause()}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink transition hover:bg-slate-50"
                >
                  <Pause className="h-3.5 w-3.5 fill-current" />
                  Pausar
                </button>
              ) : null}

              {counter.status === "paused" ? (
                <button
                  type="button"
                  onClick={() => counter.resume()}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-mint px-3 text-xs font-bold text-white shadow-soft transition hover:bg-mint/90"
                >
                  <Play className="h-3.5 w-3.5 fill-current" />
                  Retomar
                </button>
              ) : null}

              {counter.steps > 0 ? (
                <button
                  type="button"
                  onClick={() => counter.reset()}
                  className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-line bg-white px-2.5 text-xs font-bold text-ink/70 transition hover:bg-slate-50"
                  title="Zerar contagem"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Zerar
                </button>
              ) : null}
            </div>
          </div>

          <p className="mt-2 text-[11px] font-medium leading-relaxed text-ink/50">
            A contagem ocorre em primeiro plano enquanto você usa o app no mercado. A gravação no histórico é opcional na finalização da compra.
          </p>
        </div>
      ) : null}
    </div>
  );
}

