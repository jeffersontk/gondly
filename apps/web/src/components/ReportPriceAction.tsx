import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { api } from "../lib/api";
import { AppButton } from "./index";

type ReportReason = "wrong_price" | "wrong_product" | "wrong_market" | "wrong_brand" | "wrong_unit" | "other";

const reasonOptions: Array<{ value: ReportReason; label: string }> = [
  { value: "wrong_price", label: "Preço errado" },
  { value: "wrong_product", label: "Produto errado" },
  { value: "wrong_market", label: "Mercado errado" },
  { value: "wrong_brand", label: "Marca errada" },
  { value: "wrong_unit", label: "Unidade errada" },
  { value: "other", label: "Outro" },
];

export function ReportPriceAction({ recordId }: { recordId?: string | null }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<ReportReason>("wrong_price");
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const queryClient = useQueryClient();
  const report = useMutation({
    mutationFn: () =>
      api<{ id: string; status: string; reportsCount: number }>(`/shared-price-records/${recordId}/report`, {
        method: "POST",
        body: {
          reason,
          comment: comment.trim() || undefined,
        },
      }),
    onSuccess: () => {
      setSubmitted(true);
      void queryClient.invalidateQueries({ queryKey: ["price-library"] });
      void queryClient.invalidateQueries({ queryKey: ["regional-price-comparison"] });
      void queryClient.invalidateQueries({ queryKey: ["purchase-regional-comparison"] });
    },
  });

  if (!recordId) return null;

  function close() {
    if (report.isPending) return;
    setOpen(false);
    window.setTimeout(() => {
      setSubmitted(false);
      setReason("wrong_price");
      setComment("");
      report.reset();
    }, 150);
  }

  return (
    <>
      <AppButton
        type="button"
        variant="secondary"
        className="h-9 px-3 text-xs"
        icon={<Flag className="h-3.5 w-3.5" />}
        onClick={() => setOpen(true)}
      >
        Reportar preço incorreto
      </AppButton>

      {open ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="report-price-title">
          <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lift">
            {submitted ? (
              <>
                <h2 id="report-price-title" className="text-lg font-bold tracking-tight text-ink">
                  Report recebido
                </h2>
                <p className="mt-2 text-sm leading-6 text-ink/65">Obrigado. Vamos revisar este preço.</p>
                <AppButton className="mt-4" full onClick={close}>
                  Fechar
                </AppButton>
              </>
            ) : (
              <>
                <h2 id="report-price-title" className="text-lg font-bold tracking-tight text-ink">
                  Reportar preço incorreto
                </h2>
                <label className="mt-4 block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">Motivo</span>
                  <select className={selectClass} value={reason} onChange={(event) => setReason(event.target.value as ReportReason)}>
                    {reasonOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="mt-3 block">
                  <span className="mb-1.5 block text-sm font-semibold text-ink">Comentário opcional</span>
                  <textarea
                    className="min-h-24 w-full resize-none rounded-xl border border-line bg-white px-3 py-3 text-sm text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10"
                    maxLength={500}
                    value={comment}
                    onChange={(event) => setComment(event.target.value)}
                  />
                </label>
                {report.isError ? <p className="mt-2 text-xs font-semibold text-tomato">Não foi possível enviar o report.</p> : null}
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <AppButton type="button" variant="secondary" onClick={close} disabled={report.isPending}>
                    Cancelar
                  </AppButton>
                  <AppButton type="button" onClick={() => report.mutate()} loading={report.isPending} loadingLabel="Enviando">
                    Enviar
                  </AppButton>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

const selectClass =
  "h-12 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10";
