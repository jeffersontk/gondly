import { MessageCircle, Volume2, VolumeX, X } from "lucide-react";
import type { ListMessage } from "../../types";

export function ChatUnreadBadge({ count }: { count: number }) {
  if (!count) return null;
  return <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-tomato px-1 text-[10px] font-black text-white shadow-sm">{count > 99 ? "99+" : count}</span>;
}

export function ChatSoundButton({ enabled, onToggle }: { enabled: boolean; onToggle: () => void }) {
  return <button type="button" onClick={onToggle} aria-pressed={enabled} aria-label={enabled ? "Silenciar som das mensagens" : "Ativar som das mensagens"} title={enabled ? "Som das mensagens ligado" : "Som das mensagens desligado"} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-line bg-white px-3 text-xs font-bold text-ink">
    {enabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
    {enabled ? "Som ligado" : "Sem som"}
  </button>;
}

export function ChatMessageNotice({ message, count, onOpen, onDismiss, soundEnabled, onToggleSound }: {
  message?: ListMessage; count: number; onOpen: () => void; onDismiss: () => void;
  soundEnabled: boolean; onToggleSound: () => void;
}) {
  if (!message || count === 0) return null;
  return <aside aria-label="Nova mensagem no chat" className="fixed inset-x-3 top-[calc(76px+env(safe-area-inset-top))] z-50 mx-auto w-auto max-w-xl rounded-2xl border border-mint/25 bg-white p-3 shadow-lift">
    <div className="flex items-start gap-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-start gap-3 rounded-xl p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-mint">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint text-white"><MessageCircle className="h-5 w-5" /></span>
        <span className="min-w-0" role="status" aria-live="polite" aria-atomic="true">
          <span className="block text-xs font-black text-mint">{count} {count === 1 ? "mensagem não lida" : "mensagens não lidas"}</span>
          <span className="mt-0.5 block truncate text-sm font-black text-ink">{message.user.name}</span>
          <span className="mt-1 line-clamp-2 break-words text-sm text-ink/75">{message.body}</span>
          <span className="mt-1 block text-xs font-bold text-mint">Toque para abrir a conversa</span>
        </span>
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dispensar aviso sem marcar como lido" className="grid h-11 w-11 flex-none place-items-center rounded-xl text-ink/60 hover:bg-paper"><X className="h-4 w-4" /></button>
    </div>
    <div className="mt-2 flex justify-end"><ChatSoundButton enabled={soundEnabled} onToggle={onToggleSound} /></div>
  </aside>;
}
