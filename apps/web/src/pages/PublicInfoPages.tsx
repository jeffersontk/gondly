import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileText, Mail, MessageCircle, ShieldCheck } from "lucide-react";

const CONTACT_EMAIL = "contato@gondly.com.br";
const UPDATED_AT = "02 de julho de 2026";

export function PrivacyPage() {
  return (
    <PublicPageShell
      title="Política de privacidade"
      description="Como o Gondly usa dados para manter suas listas, compras e histórico sincronizados."
      icon={<ShieldCheck className="h-6 w-6" />}
    >
      <InfoSection title="Dados que usamos">
        <p>
          Quando você entra com Google, o Gondly pode receber nome, e-mail e foto
          de perfil para criar sua conta e identificar suas sessões.
        </p>
        <p>
          Também armazenamos dados que você registra no app, como listas,
          produtos, mercados, compras, preços, preferências, convites e
          histórico de uso necessário para operar a plataforma.
        </p>
      </InfoSection>

      <InfoSection title="Finalidade">
        <p>
          Usamos esses dados para autenticar sua conta, sincronizar informações
          entre dispositivos, permitir compras compartilhadas, gerar relatórios
          e melhorar a experiência do produto.
        </p>
        <p>
          Eventos técnicos e de analytics podem ser usados para segurança,
          diagnóstico de erros e entendimento de fluxos do app, sem intenção de
          vender dados pessoais.
        </p>
      </InfoSection>

      <InfoSection title="Anúncios e cookies">
        <p>
          O Gondly pode exibir anúncios em páginas públicas e em rotas permitidas
          do app para usuários sem o benefício de remoção de anúncios. Provedores
          de anúncios podem usar cookies ou tecnologias similares conforme suas
          próprias políticas.
        </p>
      </InfoSection>

      <InfoSection title="Seus direitos">
        <p>
          Você pode solicitar informações, correções ou exclusão de dados da sua
          conta pelo canal de contato informado nesta página.
        </p>
      </InfoSection>
    </PublicPageShell>
  );
}

export function TermsPage() {
  return (
    <PublicPageShell
      title="Termos de uso"
      description="Regras básicas para usar o Gondly de forma segura e responsável."
      icon={<FileText className="h-6 w-6" />}
    >
      <InfoSection title="Uso da plataforma">
        <p>
          O Gondly ajuda você a organizar listas de mercado, acompanhar compras,
          comparar preços e compartilhar listas com outras pessoas.
        </p>
        <p>
          Você é responsável pelas informações cadastradas na sua conta e pelo
          uso adequado dos recursos de colaboração.
        </p>
      </InfoSection>

      <InfoSection title="Conta e acesso">
        <p>
          O acesso pode depender de autenticação por Google. Você deve manter sua
          conta protegida e não usar a plataforma para atividades ilegais,
          abusivas ou que prejudiquem outros usuários.
        </p>
      </InfoSection>

      <InfoSection title="Disponibilidade e dados">
        <p>
          O serviço pode evoluir, ficar temporariamente indisponível ou mudar
          recursos conforme manutenção, melhorias ou necessidades operacionais.
        </p>
        <p>
          As informações de preços e economia são baseadas nos dados cadastrados
          por você e podem não representar preços oficiais de mercados.
        </p>
      </InfoSection>

      <InfoSection title="Monetização">
        <p>
          O Gondly pode oferecer anúncios, recursos pagos ou benefícios como
          remoção de anúncios. Condições comerciais podem mudar antes de novas
          contratações.
        </p>
      </InfoSection>
    </PublicPageShell>
  );
}

export function ContactPage() {
  return (
    <PublicPageShell
      title="Contato"
      description="Fale com o Gondly sobre suporte, privacidade, termos ou dúvidas gerais."
      icon={<MessageCircle className="h-6 w-6" />}
    >
      <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 flex-none place-items-center rounded-xl bg-mint/12 text-mint">
            <Mail className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-black text-ink">E-mail</h2>
            <a
              className="mt-1 block break-words text-sm font-bold text-mint"
              href={`mailto:${CONTACT_EMAIL}`}
            >
              {CONTACT_EMAIL}
            </a>
            <p className="mt-2 text-sm leading-6 text-ink/60">
              Envie sua mensagem com o máximo de contexto possível para que a
              resposta seja mais objetiva.
            </p>
          </div>
        </div>
      </div>

      <InfoSection title="Assuntos comuns">
        <p>
          Suporte de login, dúvidas sobre dados, solicitações de privacidade,
          problemas com compras compartilhadas e feedback do produto.
        </p>
      </InfoSection>
    </PublicPageShell>
  );
}

function PublicPageShell({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <div className="mx-auto w-full max-w-3xl px-5 py-6 sm:px-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2 text-sm font-black text-ink">
            <ArrowLeft className="h-4 w-4" />
            Gondly
          </Link>
          <nav className="flex flex-wrap gap-x-4 gap-y-2 text-sm font-semibold text-ink/55">
            <Link className="transition hover:text-mint" to="/privacy">
              Privacidade
            </Link>
            <Link className="transition hover:text-mint" to="/terms">
              Termos
            </Link>
            <Link className="transition hover:text-mint" to="/contact">
              Contato
            </Link>
            <Link className="transition hover:text-mint" to="/login">
              Entrar
            </Link>
          </nav>
        </header>

        <section className="mt-10">
          <span className="grid h-14 w-14 place-items-center rounded-xl bg-mint text-white shadow-soft">
            {icon}
          </span>
          <p className="mt-6 text-xs font-black uppercase tracking-[0.08em] text-ink/45">
            Última atualização: {UPDATED_AT}
          </p>
          <h1 className="mt-3 text-4xl font-black leading-tight tracking-normal text-ink">
            {title}
          </h1>
          <p className="mt-3 text-base leading-7 text-ink/65">{description}</p>
        </section>

        <section className="mt-8 space-y-4">{children}</section>
      </div>
    </main>
  );
}

function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <h2 className="text-base font-black text-ink">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-6 text-ink/65">
        {children}
      </div>
    </section>
  );
}
