import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppButton, ScreenContainer } from "../../components";
import { trackEvent } from "../../lib/analytics";
import { useAds } from "../../lib/ads";
import { useAuth } from "../../lib/auth";

export function BillingReturnPage({
  title,
  description,
  successLabel,
  analyticsEvent,
}: {
  title: string;
  description: string;
  successLabel?: string;
  analyticsEvent?: "remove_ads_purchase_success" | "remove_ads_purchase_pending";
}) {
  const navigate = useNavigate();
  const { hasNoAds, refreshBillingStatus } = useAds();
  const { refreshUser } = useAuth();
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      await refreshBillingStatus();
      await refreshUser();
    } finally {
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  useEffect(() => {
    if (!analyticsEvent) return;
    trackEvent(analyticsEvent, {
      provider: "mercado_pago",
    });
  }, [analyticsEvent]);

  return (
    <ScreenContainer title={title}>
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <p className="text-sm text-ink/60">{hasNoAds && successLabel ? successLabel : description}</p>
        <div className="mt-4 grid gap-2">
          <AppButton full onClick={refresh} loading={refreshing} loadingLabel="Atualizando">
            Atualizar status
          </AppButton>
          <AppButton full variant="secondary" onClick={() => navigate("/app/home")}>
            Voltar para o app
          </AppButton>
        </div>
      </div>
    </ScreenContainer>
  );
}
