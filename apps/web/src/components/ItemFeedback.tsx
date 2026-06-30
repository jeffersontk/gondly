export function ItemFeedback({ tone, message }: { tone: "info" | "success" | "error"; message: string }) {
  const tones = {
    info: "border-line bg-white text-ink",
    success: "border-mint/20 bg-mint/10 text-mint",
    error: "border-line bg-paper text-ink",
  };

  return (
    <div role="status" aria-live="polite" className={["rounded-xl border px-3 py-2 text-sm font-semibold", tones[tone]].join(" ")}>
      {message}
    </div>
  );
}
