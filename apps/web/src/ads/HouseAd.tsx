import type { AdSlotName } from "./config";

type HouseAdProps = {
  slot: AdSlotName;
  className?: string;
};

const messages: Record<AdSlotName, string> = {
  home_inline: "Remover anúncios para sempre",
  lists_inline: "Convide alguém para comprar junto",
  history_inline: "Compare preços da sua região",
  compare_inline: "Compare preços da sua região",
  landing_inline: "Organize listas, carrinho e preços no Gondly",
};

export function HouseAd({ slot, className }: HouseAdProps) {
  return (
    <aside
      className={[
        "rounded-xl border border-line bg-white/80 p-3 text-center shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      aria-label="Publicidade"
    >
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-ink/35">
        Publicidade
      </p>
      <p className="mt-1 text-sm font-semibold leading-5 text-ink/60">
        {messages[slot]}
      </p>
    </aside>
  );
}
