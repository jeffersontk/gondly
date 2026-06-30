import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { AppButton, AppInput } from "../../components";

type PurchaseTitleDialogProps = {
  open: boolean;
  loading?: boolean;
  onClose: () => void;
  onConfirm: (title: string) => void;
};

export function PurchaseTitleDialog({ open, loading, onClose, onConfirm }: PurchaseTitleDialogProps) {
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    if (!open) {
      setTitle("");
      setError(undefined);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedTitle = title.trim();

    if (normalizedTitle.length < 2) {
      setError("Informe um título");
      return;
    }

    onConfirm(normalizedTitle);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-end bg-ink/40 p-3 backdrop-blur-sm sm:place-items-center">
      <form className="w-full max-w-sm rounded-2xl border border-line bg-white p-4 shadow-lift" onSubmit={handleSubmit}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-[-0.02em] text-ink">Nome da compra</h2>
          <button
            type="button"
            className="grid h-10 w-10 place-items-center rounded-xl bg-ink/5 text-ink/70 transition hover:bg-ink/10"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <AppInput
          label="Título"
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            if (error) setError(undefined);
          }}
          error={error}
          autoFocus
          maxLength={120}
          disabled={loading}
        />
        <div className="mt-4 grid grid-cols-2 gap-2">
          <AppButton type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Cancelar
          </AppButton>
          <AppButton type="submit" loading={loading} loadingLabel="Iniciando">
            Iniciar
          </AppButton>
        </div>
      </form>
    </div>
  );
}
