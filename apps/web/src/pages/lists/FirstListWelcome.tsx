import { useState } from "react";
import { Link } from "react-router-dom";

export function FirstListWelcome({ userId }: { userId: string }) {
  const key = `gondly.firstList.dismissed.${userId}`;
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(key) === "true"; } catch { return false; }
  });
  if (dismissed) return null;
  return <section aria-labelledby="first-list-title" className="mb-5 rounded-2xl border border-mint/25 bg-mint/5 p-4">
    <h2 id="first-list-title" className="text-lg font-black text-ink">Vamos montar sua primeira lista?</h2>
    <p className="mt-2 text-sm text-ink/70">Responda sobre as pessoas da casa, refeições e período da compra. Você revisa a sugestão antes de salvar.</p>
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <Link to="/app/lists/diet-plan?source=welcome" className="rounded-xl bg-mint px-4 py-3 text-sm font-bold text-white">Gerar minha lista</Link>
      <button type="button" className="min-h-12 rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold text-ink" onClick={() => { try { localStorage.setItem(key, "true"); } catch { /* Still dismiss for this visit. */ } setDismissed(true); }}>Fazer depois</button>
    </div>
    <p className="mt-3 text-xs text-muted">Opcional. Você pode voltar ao assistente pela tela de Listas.</p>
  </section>;
}
