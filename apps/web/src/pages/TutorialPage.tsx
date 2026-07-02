import { useEffect, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BarChart3, CheckCircle2, Download, ListChecks, Share2, ShoppingCart, Store, X } from "lucide-react";
import { AppButton, ScreenContainer } from "../components";
import { trackEvent } from "../lib/analytics";

type TutorialStep = {
  icon: ReactNode;
  title: string;
  description: string;
  details: string[];
};

type GondlyTutorialGuideProps = {
  open: boolean;
  onClose: () => void;
};

const tutorialSteps: TutorialStep[] = [
  {
    icon: <ListChecks className="h-5 w-5" />,
    title: "Monte sua lista",
    description: "Comece criando uma lista de mercado com os produtos que pretende comprar.",
    details: ["Adicione produto, quantidade e unidade.", "Use setores para encontrar itens mais rapido.", "Marque itens importantes antes de sair."],
  },
  {
    icon: <ShoppingCart className="h-5 w-5" />,
    title: "Inicie a compra",
    description: "Transforme a lista em uma compra ativa quando estiver no mercado.",
    details: ["Use uma lista existente ou crie uma compra rapida.", "Itens pendentes entram automaticamente.", "Itens que voce ja tem em casa ficam fora."],
  },
  {
    icon: <Store className="h-5 w-5" />,
    title: "Registre os precos",
    description: "Toque no produto conforme coloca no carrinho e informe o valor pago.",
    details: ["Informe quantidade, unidade e preco.", "O total da compra atualiza na hora.", "Voce pode editar o item se digitar algo errado."],
  },
  {
    icon: <CheckCircle2 className="h-5 w-5" />,
    title: "Finalize no caixa",
    description: "Depois de passar no caixa, salve o mercado e o valor final da compra.",
    details: ["Escolha ou cadastre o mercado.", "Informe o valor pago no caixa.", "A compra vai para o historico."],
  },
  {
    icon: <BarChart3 className="h-5 w-5" />,
    title: "Compare depois",
    description: "Com o historico salvo, o Gondly ajuda a comparar mercados e produtos.",
    details: ["Veja o melhor preco por produto.", "Acompanhe variacao entre compras.", "Use dados reais das suas compras."],
  },
  {
    icon: <Share2 className="h-5 w-5" />,
    title: "Compartilhe listas",
    description: "Convide outra pessoa para colaborar na mesma lista ou compra.",
    details: ["Abra a lista e toque em Acoes.", "Crie um link de compartilhamento.", "Aprove os acessos recebidos."],
  },
  {
    icon: <Download className="h-5 w-5" />,
    title: "Instale o app",
    description: "Instale o Gondly para acessar rapido pela tela inicial do celular.",
    details: ["Use o botao Instalar quando aparecer.", "Se nao aparecer, va em Ajustes.", "No iPhone, use Compartilhar e Adicionar a Tela de Inicio."],
  },
];

export function TutorialPage() {
  const navigate = useNavigate();
  const [guideOpen, setGuideOpen] = useState(true);

  useEffect(() => {
    trackEvent("view_tutorial", { source: "tutorial_page" });
  }, []);

  return (
    <ScreenContainer title="Guia de uso" subtitle="Aprenda o fluxo principal do Gondly passo a passo." backTo="/app/settings">
      <section className="rounded-xl border border-mint/20 bg-mint/5 p-4 shadow-sm">
        <h2 className="text-base font-black text-mint">Tutorial interativo</h2>
        <p className="mt-1 text-sm leading-6 text-ink/65">
          Veja as etapas principais para criar lista, comprar, salvar historico e comparar precos.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <AppButton onClick={() => setGuideOpen(true)}>Abrir guia</AppButton>
          <AppButton
            variant="secondary"
            onClick={() => {
              trackEvent("click_tutorial_shortcut", { target: "home" });
              navigate("/app/home");
            }}
          >
            Ir para inicio
          </AppButton>
        </div>
      </section>

      <div className="mt-4 grid gap-2">
        {tutorialSteps.map((step, index) => (
          <button
            key={step.title}
            type="button"
            className="flex items-center gap-3 rounded-xl border border-line bg-white p-3 text-left shadow-sm transition hover:border-mint/25"
            onClick={() => setGuideOpen(true)}
          >
            <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-mint/10 text-mint">{step.icon}</span>
            <span className="min-w-0">
              <span className="block text-sm font-black text-ink">
                {index + 1}. {step.title}
              </span>
              <span className="mt-0.5 block truncate text-xs font-semibold text-ink/55">{step.description}</span>
            </span>
          </button>
        ))}
      </div>

      <GondlyTutorialGuide open={guideOpen} onClose={() => setGuideOpen(false)} />
    </ScreenContainer>
  );
}

export function GondlyTutorialGuide({ open, onClose }: GondlyTutorialGuideProps) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    if (open) setStepIndex(0);
  }, [open]);

  if (!open) return null;

  const currentStep = tutorialSteps[stepIndex];
  const isFirstStep = stepIndex === 0;
  const isLastStep = stepIndex === tutorialSteps.length - 1;

  function nextStep() {
    if (isLastStep) {
      trackEvent("complete_tutorial", { steps: tutorialSteps.length });
      onClose();
      return;
    }

    setStepIndex((current) => current + 1);
  }

  function previousStep() {
    setStepIndex((current) => Math.max(0, current - 1));
  }

  function skipGuide() {
    trackEvent("skip_tutorial", { step: stepIndex + 1 });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="tutorial-step-title">
      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-5 shadow-lift">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mint text-white shadow-soft">{currentStep.icon}</span>
            <span className="rounded-full bg-mint/10 px-3 py-1 text-xs font-black text-mint">
              Passo {stepIndex + 1} de {tutorialSteps.length}
            </span>
          </div>
          <button type="button" className="grid h-9 w-9 place-items-center rounded-xl bg-paper text-ink/60 transition hover:bg-line hover:text-ink" onClick={skipGuide} aria-label="Fechar guia">
            <X className="h-4 w-4" />
          </button>
        </div>

        <h2 id="tutorial-step-title" className="mt-5 text-xl font-black tracking-[-0.03em] text-ink">
          {currentStep.title}
        </h2>
        <p className="mt-2 text-sm font-semibold leading-6 text-ink/65">{currentStep.description}</p>

        <div className="mt-4 space-y-2 rounded-xl bg-paper p-3">
          {currentStep.details.map((detail) => (
            <div key={detail} className="flex gap-2 text-sm font-semibold leading-5 text-ink/70">
              <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-mint" />
              <span>{detail}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex items-center gap-1.5" aria-label="Progresso do guia">
          {tutorialSteps.map((step, index) => (
            <button
              key={step.title}
              type="button"
              className={["h-2.5 rounded-full transition", index === stepIndex ? "w-8 bg-mint" : "w-2.5 bg-line hover:bg-mint/45"].join(" ")}
              onClick={() => setStepIndex(index)}
              aria-label={`Ir para passo ${index + 1}`}
              aria-current={index === stepIndex ? "step" : undefined}
            />
          ))}
        </div>

        <div className="mt-5 grid grid-cols-[auto_1fr_auto] items-center gap-2">
          <AppButton className="h-10 px-3" variant="secondary" onClick={skipGuide}>
            Pular
          </AppButton>
          <AppButton className="h-10 px-3" variant="secondary" icon={<ArrowLeft className="h-4 w-4" />} onClick={previousStep} disabled={isFirstStep}>
            Anterior
          </AppButton>
          <AppButton className="h-10 px-3" icon={isLastStep ? <CheckCircle2 className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />} onClick={nextStep}>
            {isLastStep ? "Concluir" : "Proximo"}
          </AppButton>
        </div>
      </div>
    </div>
  );
}
