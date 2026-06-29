import { Component, type ErrorInfo, type ReactNode } from "react";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  failed: boolean;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Gondly render error", error, info);
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="flex min-h-screen items-center justify-center bg-paper p-5 text-ink">
        <section className="w-full max-w-sm rounded-3xl border border-line bg-white p-6 text-center shadow-soft">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-mint/10 text-xl font-black text-mint">!</div>
          <h1 className="mt-4 text-xl font-black tracking-[-0.03em]">Não foi possível carregar a tela.</h1>
          <p className="mt-2 text-sm leading-6 text-ink/60">Recarregue o app. Se continuar, feche e abra o atalho novamente.</p>
          <button
            type="button"
            className="mt-5 h-12 w-full rounded-xl bg-mint px-5 text-sm font-bold text-white shadow-soft"
            onClick={() => window.location.reload()}
          >
            Recarregar
          </button>
        </section>
      </main>
    );
  }
}
