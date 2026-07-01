import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AppButton, ScreenContainer } from "../../components";
import { trackEvent } from "../../lib/analytics";

export function BillingFailurePage() {
  const navigate = useNavigate();
  useEffect(() => {
    trackEvent("remove_ads_purchase_failed", { provider: "mercado_pago" });
  }, []);

  return (
    <ScreenContainer title="Pagamento nao concluido">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/60">Voce pode tentar novamente quando quiser.</p>
        <AppButton className="mt-4" full onClick={() => navigate("/app/billing")}>
          Tentar novamente
        </AppButton>
      </div>
    </ScreenContainer>
  );
}
