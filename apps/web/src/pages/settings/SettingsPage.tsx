import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CheckCircle2, Download, HelpCircle, LogOut, Smartphone } from "lucide-react";
import { AppButton, MemberAvatar, ScreenContainer } from "../../components";
import { useAds } from "../../lib/ads";
import { trackEvent } from "../../lib/analytics";
import { useAuth } from "../../lib/auth";
import { promptPwaInstall, usePwaInstall } from "../../lib/pwaInstall";
import type { User } from "../../types";

export function SettingsPage() {
  const { user, logout } = useAuth();
  const { hasNoAds } = useAds();
  const pwaInstall = usePwaInstall();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const canPromptInstall = Boolean(pwaInstall.deferredPrompt) && !pwaInstall.installed;

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
