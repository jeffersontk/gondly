import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, CheckCircle2, Download, HelpCircle, LogOut, ShieldCheck, Smartphone } from "lucide-react";
import { AppButton, MemberAvatar, ScreenContainer } from "../../components";
import { useAds } from "../../lib/ads";
import { trackEvent } from "../../lib/analytics";
import { api } from "../../lib/api";
import { useAuth } from "../../lib/auth";
import { promptPwaInstall, usePwaInstall } from "../../lib/pwaInstall";
import type { ShareLocationLevel } from "@gondly/types";
import type { PriceSharingPreference, User } from "../../types";

type PriceSharingPreferencePatch = Partial<Pick<PriceSharingPreference, "sharePrices" | "shareLocationLevel">>;

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { hasNoAds } = useAds();
  const pwaInstall = usePwaInstall();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const priceSharing = useQuery({
    queryKey: ["price-sharing-preference"],
    queryFn: () => api<PriceSharingPreference>("/me/price-sharing-preference"),
  });
  const updatePriceSharing = useMutation({
    mutationFn: (values: PriceSharingPreferencePatch) =>
      api<PriceSharingPreference>("/me/price-sharing-preference", { method: "PATCH", body: values }),
    onMutate: async (values) => {
      await queryClient.cancelQueries({ queryKey: ["price-sharing-preference"] });
      const previous = queryClient.getQueryData<PriceSharingPreference>(["price-sharing-preference"]);
      queryClient.setQueryData<PriceSharingPreference>(["price-sharing-preference"], (current) => ({
        sharePrices: false,
        shareLocationLevel: "city",
        ...current,
        ...values,
      }));
      return { previous };
    },
    onError: (_error, _values, context) => {
      if (context?.previous) queryClient.setQueryData(["price-sharing-preference"], context.previous);
    },
    onSuccess: (saved) => {
      queryClient.setQueryData(["price-sharing-preference"], saved);
    },
  });

  const canPromptInstall = Boolean(pwaInstall.deferredPrompt) && !pwaInstall.installed;
  const preference = priceSharing.data ?? { sharePrices: false, shareLocationLevel: "city" as ShareLocationLevel };

  async function handleInstall() {
    trackEvent("click_install_pwa", { source: "settings" });
    await promptPwaInstall();
  }

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout({ source: "settings" });
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <ScreenContainer title="Ajustes" backTo="/app/home">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <MemberAvatar user={(user as User) ?? { name: "U" }} />
          <div>
            <p className="text-sm font-black text-ink">{user?.name}</p>
            <p className="text-xs text-ink/55">{user?.email}</p>
          </div>
        </div>

        {!hasNoAds ? (
          <AppButton className="mt-4" full variant="secondary" onClick={() => navigate("/app/billing")}>
            Remover anuncios
          </AppButton>
        ) : null}

        <div className="mt-4 grid gap-2">
          <AppButton
            variant="secondary"
            icon={<BookOpen className="h-4 w-4" />}
            onClick={() => {
              trackEvent("open_tutorial", { source: "settings" });
              navigate("/app/tutorial");
            }}
          >
            Guia de uso
          </AppButton>
          <AppButton variant="danger" icon={<LogOut className="h-4 w-4" />} onClick={handleLogout} loading={loggingOut} loadingLabel="Saindo">
            Sair
          </AppButton>
        </div>
      </div>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mint/10 text-mint">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-ink">Compartilhamento de preços</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              Quando ativo, compras finalizadas podem contribuir com preços anonimizados. Nome, email e localização exata não são compartilhados.
            </p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-paper p-3">
          <div>
            <p className="text-sm font-black text-ink">{preference.sharePrices ? "Ativo" : "Inativo"}</p>
            <p className="mt-0.5 text-xs font-semibold text-ink/55">Usado como padrão na finalização da compra.</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={preference.sharePrices}
            className={[
              "relative h-7 w-12 flex-none rounded-full transition disabled:cursor-not-allowed disabled:opacity-60",
              preference.sharePrices ? "bg-mint" : "bg-ink/15",
            ].join(" ")}
            disabled={priceSharing.isLoading || updatePriceSharing.isPending}
            onClick={() => updatePriceSharing.mutate({ sharePrices: !preference.sharePrices })}
          >
            <span
              className={[
                "absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition",
                preference.sharePrices ? "left-6" : "left-1",
              ].join(" ")}
            />
          </button>
        </div>

        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-semibold text-ink">Nível de localização</span>
          <select
            className="h-12 w-full rounded-xl border border-line bg-white px-4 text-base text-ink shadow-sm outline-none transition focus:border-mint focus:ring-4 focus:ring-mint/10 disabled:cursor-not-allowed disabled:bg-paper disabled:text-muted"
            value={preference.shareLocationLevel}
            disabled={priceSharing.isLoading || updatePriceSharing.isPending}
            onChange={(event) => updatePriceSharing.mutate({ shareLocationLevel: event.target.value as ShareLocationLevel })}
          >
            <option value="none">Não compartilhar localização</option>
            <option value="city">Cidade</option>
            <option value="neighborhood">Bairro</option>
          </select>
        </label>
      </section>

      <section className="mt-4 rounded-xl border border-line bg-white p-4 shadow-soft">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mint/10 text-mint">
            {pwaInstall.installed ? <CheckCircle2 className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-black text-ink">Instalar o app</h2>
            <p className="mt-1 text-sm leading-6 text-ink/60">
              {pwaInstall.installed
                ? "Gondly ja esta instalado neste dispositivo."
                : "O botao automatico depende do navegador. Quando ele nao aparecer, use o menu do navegador."}
            </p>
          </div>
        </div>

        {canPromptInstall ? (
          <AppButton className="mt-4" full icon={<Download className="h-4 w-4" />} onClick={handleInstall}>
            Instalar agora
          </AppButton>
        ) : null}

        {!pwaInstall.installed ? (
          <div className="mt-4 rounded-xl bg-paper p-3">
            <div className="flex items-center gap-2 text-sm font-black text-ink">
              <HelpCircle className="h-4 w-4 text-mint" />
              {installInstructionTitle(pwaInstall.platform)}
            </div>
            <ol className="mt-2 space-y-1.5 text-sm leading-6 text-ink/65">
              {installInstructionSteps(pwaInstall.platform).map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        ) : null}
      </section>
    </ScreenContainer>
  );
}

function installInstructionTitle(platform: ReturnType<typeof usePwaInstall>["platform"]) {
  if (platform === "ios") return "iPhone ou iPad";
  if (platform === "android") return "Android";
  if (platform === "desktop") return "Computador";
  return "Instalacao manual";
}

function installInstructionSteps(platform: ReturnType<typeof usePwaInstall>["platform"]) {
  if (platform === "ios") {
    return ["1. Abra no Safari.", "2. Toque em Compartilhar.", "3. Escolha Adicionar a Tela de Inicio."];
  }

  if (platform === "android") {
    return ["1. Abra o menu do navegador.", "2. Toque em Instalar app ou Adicionar a tela inicial.", "3. Confirme o atalho."];
  }

  if (platform === "desktop") {
    return ["1. Use Chrome ou Edge.", "2. Clique no icone de instalar na barra de endereco.", "3. Confirme a instalacao."];
  }

  return ["1. Abra o menu do navegador.", "2. Procure Instalar app ou Adicionar a tela inicial.", "3. Confirme a instalacao."];
}
