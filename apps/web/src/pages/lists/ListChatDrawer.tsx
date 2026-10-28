import { useEffect, useRef, useState } from "react";
import { MessageCircle, Send, X } from "lucide-react";
import { AppButton, MemberAvatar } from "../../components";
import type { ListMessage } from "../../types";

export function ListChatDrawer({
  open,
  messages,
  currentUserId,
  sending,
  onClose,
  onSend,
}: {
  open: boolean;
  messages: ListMessage[];
  currentUserId?: string;
  sending: boolean;
  onClose: () => void;
  onSend: (body: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement | null>(null);

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

  useEffect(() => {
    if (!open) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [open, messages.length]);

  if (!open) return null;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    onSend(body);
    setDraft("");
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="list-chat-title">
      <button type="button" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar mensagens" />
      <div className="absolute inset-x-0 bottom-0 mx-auto flex h-[85vh] w-full max-w-xl flex-col rounded-t-3xl border-x border-t border-line bg-white px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-lift">
        <div className="mx-auto mb-3 h-1.5 w-12 flex-none rounded-full bg-line" />
        <div className="flex flex-none items-center justify-between">
          <div>
            <p id="list-chat-title" className="text-lg font-bold tracking-tight text-ink">Mensagens</p>
            <p className="text-xs font-medium text-ink/60">Converse com quem tem acesso a esta lista.</p>
          </div>
          <button type="button" className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-white text-ink shadow-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="mt-3 flex-1 space-y-3 overflow-y-auto">
          {!messages.length ? (
            <div className="grid h-full place-items-center text-center">
              <div>
                <MessageCircle className="mx-auto h-8 w-8 text-ink/25" />
                <p className="mt-2 text-xs font-semibold text-ink/50">Nenhuma mensagem ainda. Diga oi!</p>
              </div>
            </div>
          ) : (
            messages.map((message) => {
              const isMine = message.userId === currentUserId;
              return (
                <div key={message.id} className={`flex items-end gap-2 ${isMine ? "flex-row-reverse" : ""}`}>
                  <MemberAvatar user={message.user} />
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${isMine ? "bg-mint text-white" : "bg-paper text-ink"}`}>
                    {!isMine ? <p className="text-[11px] font-black opacity-70">{message.user.name}</p> : null}
                    <p className="whitespace-pre-wrap break-words text-sm font-medium">{message.body}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <form onSubmit={handleSubmit} className="mt-3 flex flex-none items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva uma mensagem"
            maxLength={1000}
            className="h-12 flex-1 rounded-xl border border-line bg-white px-3 text-sm font-medium text-ink outline-none focus:border-mint/60"
          />
          <AppButton type="submit" className="h-12 w-12 px-0" icon={<Send className="h-5 w-5" />} disabled={!draft.trim()} loading={sending}>
            <span className="sr-only">Enviar</span>
          </AppButton>
        </form>
      </div>
    </div>
  );
}
