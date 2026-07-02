type AdPlaceholderProps = {
  className?: string;
};

export function AdPlaceholder({ className }: AdPlaceholderProps) {
  return (
    <div
      className={[
        "rounded-xl border border-dashed border-line bg-white/70 p-3 text-center shadow-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <p className="text-[10px] font-black uppercase tracking-[0.08em] text-ink/35">
        Publicidade
      </p>
      <p className="mt-1 text-xs font-semibold text-ink/45">
        Espaço para anúncio
      </p>
    </div>
  );
}
