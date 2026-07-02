import { useEffect, type RefObject, type ReactNode } from "react";
import {
  AlertCircle,
  BarChart3,
  ListChecks,
  Loader2,
  ReceiptText,
  RefreshCcw,
  ScanLine,
  ShoppingCart,
  Store,
  TrendingUp,
} from "lucide-react";
import { AdSlot } from "../ads/AdSlot";
import { trackEvent } from "../lib/analytics";

type LandingPageProps = {
  clientId?: string;
  signinButtonRef: RefObject<HTMLDivElement>;
  signupButtonRef: RefObject<HTMLDivElement>;
  googleReady?: boolean;
  loginPending?: boolean;
  authError?: string | null;
};

export function LandingPage({
  clientId,
  signinButtonRef,
  signupButtonRef,
  googleReady,
  loginPending,
  authError,
}: LandingPageProps) {
  useEffect(() => {
    trackEvent("view_landing", { source: "login_page" });
  }, []);

  return (
    <main className="min-h-screen overflow-x-hidden bg-paper text-ink">
      <section className="relative mx-auto flex min-h-[88svh] w-full max-w-7xl flex-col px-5 pb-10 pt-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between gap-4">
          <picture>
            <source srcSet="/gondly-logo-small.webp" type="image/webp" />
            <img
              src="/gondly-logo-small.png"
              alt="Gondly"
              width="512"
              height="171"
              className="h-10 w-auto max-w-[150px] object-contain"
            />
          </picture>
          {clientId ? (
            <GoogleAuthButton
              buttonRef={signinButtonRef}
              label="Entrar com Google"
              className="min-h-10 w-[198px]"
              source="header"
              loading={!googleReady || loginPending}
              loadingLabel={loginPending ? "Entrando..." : "Preparando..."}
            />
          ) : (
            <span className="rounded-full border border-tomato/20 px-3 py-2 text-xs font-black text-tomato shadow-soft">
              Login indisponível
            </span>
          )}
        </header>

        <div className="grid flex-1 items-center gap-10 py-8 lg:grid-cols-[minmax(0,0.95fr)_minmax(340px,0.8fr)] lg:py-12">
          <div className="max-w-2xl">
            <span className="inline-flex rounded-full bg-mint/12 px-3 py-1.5 text-xs font-black uppercase text-mint">
              Compras organizadas
            </span>
            <h1 className="mt-5 max-w-2xl text-5xl font-black leading-[1.04] tracking-normal text-ink sm:text-6xl">
              Sua lista, seu carrinho e seus preços no mesmo fluxo.
            </h1>
            <p className="mt-5 max-w-xl text-base leading-7 text-ink/65 sm:text-lg">
              Organize listas de mercado, abra o carrinho rapidamente e
              acompanhe preços para decidir melhor antes de passar no caixa.
            </p>

            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center">
              {clientId ? (
                <GoogleAuthButton
                  buttonRef={signupButtonRef}
                  label="Inscrever-se com Google"
                  className="min-h-11 w-[260px]"
                  source="hero"
                  loading={!googleReady || loginPending}
                  loadingLabel={loginPending ? "Entrando..." : "Preparando login"}
                />
              ) : (
                <div className="flex min-h-11 w-full max-w-[280px] items-center justify-center rounded-full border border-tomato/20  px-4 text-sm font-semibold text-tomato shadow-soft">
                  Login Google indisponível
                </div>
              )}
              <p className="max-w-xs text-xs font-semibold text-ink/50">
                Crie sua conta com Google e sincronize listas, compras e
                histórico de preços.
              </p>
            </div>

            {authError ? (
              <div className="mt-3 flex max-w-xl items-start gap-2 rounded-xl border border-tomato/20 bg-tomato/10 p-3 text-sm font-semibold leading-5 text-tomato" role="alert">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none" />
                <span>{authError}</span>
              </div>
            ) : null}

            <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-3">
              <LandingMetric
                icon={<ListChecks className="h-5 w-5" />}
                title="Lista pronta"
                description="Crie itens e transforme tudo em carrinho."
                tone="mint"
              />
              <LandingMetric
                icon={<TrendingUp className="h-5 w-5" />}
                title="Preço claro"
                description="Veja histórico e compare mercados."
                tone="sky"
              />
              <LandingMetric
                icon={<ShoppingCart className="h-5 w-5" />}
                title="Carrinho pronto"
                description="Transforme a lista em compra sem recadastrar itens."
                tone="tomato"
              />
            </div>
          </div>

          <LandingAppPreview />
        </div>
      </section>

      <AdSlot
        slot="landing_inline"
        disabled={loginPending}
        className="mx-5 mb-8 sm:mx-8 lg:mx-auto lg:max-w-7xl"
      />

      <section className="mx-auto grid w-full max-w-7xl gap-3 px-5 pb-10 sm:px-8 md:grid-cols-4 lg:px-10">
        <LandingFeature
          icon={<ReceiptText className="h-5 w-5" />}
          title="Listas que viram compra"
          description="Monte a lista e abra o carrinho sem recadastrar tudo."
        />
        <LandingFeature
          icon={<ShoppingCart className="h-5 w-5" />}
          title="Carrinho rápido"
          description="Abra uma compra a partir da lista e acompanhe o total."
        />
        <LandingFeature
          icon={<ScanLine className="h-5 w-5" />}
          title="Histórico de preços"
          description="Compare mercados e acompanhe variações dos produtos."
        />
        <LandingFeature
          icon={<Store className="h-5 w-5" />}
          title="Mercados favoritos"
          description="Guarde locais, tickets e produtos para decidir mais rápido."
        />
      </section>
    </main>
  );
}

function GoogleAuthButton({
  buttonRef,
  label,
  className,
  source,
  loading,
  loadingLabel,
}: {
  buttonRef: RefObject<HTMLDivElement>;
  label: string;
  className: string;
  source: "header" | "hero";
  loading?: boolean;
  loadingLabel?: string;
}) {
  return (
    <div
      className={[
        "relative overflow-hidden rounded-full bg-white shadow-soft",
        className,
      ].join(" ")}
      aria-label={label}
      onClickCapture={() => trackEvent("click_cta_access_app", { source, method: "google" })}
    >
      <div className="pointer-events-none absolute inset-0 flex h-full min-h-[inherit] w-full items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink">
        <span className="text-base font-black text-[#4285F4]">G</span>
        <span>{label}</span>
      </div>
      {loading ? (
        <button
          type="button"
          className="absolute inset-0 z-20 flex h-full min-h-[inherit] w-full cursor-wait items-center justify-center gap-2 rounded-full border border-line bg-white px-4 text-sm font-semibold text-ink/65"
          disabled
          aria-busy="true"
        >
          <Loader2 className="h-4 w-4 animate-spin text-mint" />
          <span>{loadingLabel ?? "Carregando"}</span>
        </button>
      ) : null}
      <div ref={buttonRef} className="relative z-10 flex min-h-[inherit] w-full items-center justify-center" />
    </div>
  );
}

function LandingMetric({
  icon,
  title,
  description,
  tone,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  tone: "mint" | "sky" | "tomato";
}) {
  const tones = {
    mint: "bg-mint/12 text-mint border-mint/15",
    sky: "bg-sky/12 text-sky border-sky/15",
    tomato: "bg-tomato/12 text-tomato border-tomato/15",
  };

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div
        className={[
          "grid h-10 w-10 place-items-center rounded-xl border",
          tones[tone],
        ].join(" ")}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm font-black text-ink">{title}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-ink/55">
        {description}
      </p>
    </div>
  );
}

function LandingFeature({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-mint/12 text-mint">
        {icon}
      </div>
      <h2 className="mt-4 text-sm font-black text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-ink/60">{description}</p>
    </article>
  );
}

function LandingAppPreview() {
  return (
    <div
      className="relative mx-auto flex min-h-[390px] w-full max-w-[420px] items-center justify-center lg:min-h-[470px]"
      aria-hidden="true"
    >
      <div className="absolute inset-x-10 bottom-12 top-16 z-0 rounded-full bg-mint/10 blur-3xl" />

      <div className="absolute left-0 top-16 z-20 hidden w-44 rounded-xl border border-line bg-white/95 p-3 shadow-soft backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-sky/12 text-sky">
            <BarChart3 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink/45">Melhor preço</p>
            <p className="text-sm font-black text-ink">Mercado Sul</p>
          </div>
        </div>
      </div>

      <div className="absolute bottom-16 right-0 z-20 hidden w-48 rounded-xl border border-line bg-white/95 p-3 shadow-soft backdrop-blur sm:block">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-tomato/12 text-tomato">
            <RefreshCcw className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xs font-semibold text-ink/45">Atualizado</p>
            <p className="text-sm font-black text-ink">Lista pronta</p>
          </div>
        </div>
      </div>

      <picture className="relative z-10">
        <source srcSet="/gondly-mockup.webp" type="image/webp" />
        <img
          src="/gondly-mockup.png"
          alt=""
          width="895"
          height="1756"
          className="w-[min(58vw,266px)] max-w-full select-none drop-shadow-[0_22px_44px_rgba(15,23,42,0.16)] lg:w-[300px]"
          decoding="async"
        />
      </picture>
    </div>
  );
}
