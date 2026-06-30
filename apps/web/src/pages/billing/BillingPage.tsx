import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation } from "@tanstack/react-query";
import { AppButton, MonetizationBadge, ScreenContainer } from "../../components";
import { api } from "../../lib/api";
import { useAds } from "../../lib/ads";
import { useAuth } from "../../lib/auth";
import { formatBRL } from "../shared";

export function BillingPage() {
  const { status, hasNoAds } = useAds();
  const navigate = useNavigate();
  const offer = status?.availableOffers[0];
  const checkout = useMutation({
    mutationFn: () => api<{ checkoutUrl: string; purchaseId: string }>("/billing/remove-ads/checkout", { method: "POST" }),
    onSuccess: (response) => {
      window.location.href = response.checkoutUrl;
    },
  });

  return (
    <ScreenContainer title="Remover anuncios">
      <div className="mb-4 flex items-center justify-between rounded-xl bg-white p-3 shadow-soft">
        <span className="text-sm font-semibold text-ink/65">Status</span>
        <MonetizationBadge hasNoAds={hasNoAds} />
      </div>

      {hasNoAds ? (
        <div className="rounded-xl bg-white p-4 shadow-soft">
          <p className="text-lg font-black text-ink">Sem anuncios ativo</p>
          <p className="mt-2 text-sm text-ink/60">Voce nao vera mais anuncios no Gondly.</p>
          <AppButton className="mt-4" full onClick={() => navigate("/app/home")}>
            Voltar para o app
          </AppButton>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl bg-white p-4 shadow-soft">
            <p className="text-lg font-black text-ink">{offer?.title ?? "Gondly Sem Anuncios"}</p>
            <p className="mt-2 text-sm text-ink/60">Use o Gondly com uma experiencia mais limpa. Pague uma vez e nao veja mais anuncios.</p>
            <p className="mt-4 text-2xl font-black text-mint">{formatBRL(offer?.price ?? 19.9)}</p>
            <p className="mt-2 text-xs text-ink/50">Este pagamento remove apenas os anuncios. Recursos futuros poderao ser vendidos separadamente.</p>
            <AppButton className="mt-4" full onClick={() => checkout.mutate()} loading={checkout.isPending} loadingLabel="Abrindo checkout">
              {`Remover anuncios por ${formatBRL(offer?.price ?? 19.9)}`}
            </AppButton>
          </div>
          <div className="rounded-xl border border-dashed border-line bg-white/70 p-3 text-xs font-semibold text-ink/50">
            O app continua gratuito com anuncios.
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}
