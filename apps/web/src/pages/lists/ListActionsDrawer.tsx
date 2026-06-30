import { useEffect } from "react";
import { Archive, Copy, Edit, FileUp, Menu, RefreshCcw, Share2, Trash2, X } from "lucide-react";
import { AppButton } from "../../components";

export function ListActionsDrawer({
  open,
  isOwner,
  pendingRequests,
  archiving,
  duplicating,
  onClose,
  onEdit,
  onArchive,
  onDuplicate,
  onImport,
  onShare,
  onDelete,
}: {
  open: boolean;
  isOwner: boolean;
  pendingRequests: number;
  archiving: boolean;
  duplicating: boolean;
  onClose: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDuplicate: () => void;
  onImport: () => void;
  onShare: () => void;
  onDelete: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="list-actions-title">
      <button type="button" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar ações" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl border-x border-t border-line bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-lift">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <div className="flex items-center justify-between">
          <div>
            <p id="list-actions-title" className="text-lg font-bold tracking-tight text-ink">Ações da lista</p>
            <p className="text-xs font-medium text-ink/60">Gerencie, compartilhe ou importe itens.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-ink shadow-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<Edit className="h-5 w-5" />} onClick={onEdit}>
            Editar
          </AppButton>
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<Archive className="h-5 w-5" />} loading={archiving} loadingLabel="Arquivando" onClick={onArchive}>
            Arquivar
          </AppButton>
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<RefreshCcw className="h-5 w-5" />} loading={duplicating} loadingLabel="Duplicando" onClick={onDuplicate}>
            Duplicar
          </AppButton>
          <AppButton className="h-14 justify-start" full variant="secondary" icon={<FileUp className="h-5 w-5" />} onClick={onImport}>
            Importar
          </AppButton>
          {isOwner ? (
            <AppButton className="relative col-span-2 h-14 justify-start" full variant="secondary" icon={<Share2 className="h-5 w-5" />} onClick={onShare}>
              Compartilhar
              {pendingRequests ? (
                <span className="absolute right-3 rounded-full bg-tomato px-2 py-0.5 text-[11px] font-black text-white">{pendingRequests}</span>
              ) : null}
            </AppButton>
          ) : null}
          {isOwner ? (
            <AppButton className="col-span-2 h-14 justify-start" full variant="danger" icon={<Trash2 className="h-5 w-5" />} onClick={onDelete}>
              Excluir lista
            </AppButton>
          ) : null}
        </div>
      </div>
    </div>
  );
}
