import { Copy, Share2, UserCheck, UserPlus, Users, UserX } from "lucide-react";
import { AppButton, MemberAvatar } from "../../components";
import { ItemFeedback } from "../../components/ItemFeedback";
import type { ListMember } from "../../types";

export function ListSharingPanel({
  shareUrl,
  pendingMembers,
  collaborators,
  creatingLink,
  approvingMemberId,
  rejectingMemberId,
  feedback,
  onCreateLink,
  onCopy,
  onShare,
  onApprove,
  onReject,
}: {
  shareUrl: string;
  pendingMembers: ListMember[];
  collaborators: ListMember[];
  creatingLink: boolean;
  approvingMemberId?: string;
  rejectingMemberId?: string;
  feedback: string | null;
  onCreateLink: () => void;
  onCopy: () => Promise<void>;
  onShare: () => Promise<void>;
  onApprove: (memberId: string) => void;
  onReject: (memberId: string) => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-mint/12 text-mint">
          <Share2 className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-sm font-black text-ink">Compartilhar lista</span>
          <span className="mt-1 block text-xs text-ink/55">Quem receber o link precisará solicitar acesso. Você decide quem entra.</span>
        </span>
      </div>

      {shareUrl ? (
        <>
          <div className="rounded-xl bg-paper p-3">
            <p className="break-all text-xs font-semibold text-ink/65">{shareUrl}</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <AppButton type="button" variant="secondary" icon={<Copy className="h-4 w-4" />} onClick={() => void onCopy()}>
              Copiar link
            </AppButton>
            <AppButton type="button" icon={<Share2 className="h-4 w-4" />} onClick={() => void onShare()}>
              Enviar
            </AppButton>
          </div>
        </>
      ) : (
        <AppButton type="button" full icon={<Share2 className="h-4 w-4" />} loading={creatingLink} loadingLabel="Criando link" onClick={onCreateLink}>
          Criar link
        </AppButton>
      )}

      {feedback ? <ItemFeedback tone="success" message={feedback} /> : null}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="flex items-center gap-2 text-sm font-black text-ink"><UserPlus className="h-4 w-4 text-sky" /> Solicitações</p>
          <span className="rounded-full bg-sky/12 px-2 py-0.5 text-xs font-black text-sky">{pendingMembers.length}</span>
        </div>
        <div className="space-y-2">
          {!pendingMembers.length ? <p className="rounded-xl bg-paper p-3 text-xs font-semibold text-ink/50">Nenhuma solicitação pendente.</p> : null}
          {pendingMembers.map((member) => (
            <div key={member.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center gap-3">
                <MemberAvatar user={member.user} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-black text-ink">{member.user.name}</span>
                  <span className="block truncate text-xs text-ink/50">{member.user.email}</span>
                </span>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <AppButton
                  type="button"
                  className="h-10 px-2 text-xs"
                  icon={<UserCheck className="h-4 w-4" />}
                  loading={approvingMemberId === member.id}
                  loadingLabel="Aceitando"
                  onClick={() => onApprove(member.id)}
                >
                  Aceitar
                </AppButton>
                <AppButton
                  type="button"
                  className="h-10 px-2 text-xs"
                  variant="danger"
                  icon={<UserX className="h-4 w-4" />}
                  loading={rejectingMemberId === member.id}
                  loadingLabel="Recusando"
                  onClick={() => onReject(member.id)}
                >
                  Recusar
                </AppButton>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 flex items-center gap-2 text-sm font-black text-ink"><Users className="h-4 w-4 text-mint" /> Pessoas com acesso</p>
        <div className="space-y-2">
          {!collaborators.length ? <p className="rounded-xl bg-paper p-3 text-xs font-semibold text-ink/50">A lista ainda não possui colaboradores.</p> : null}
          {collaborators.map((member) => (
            <div key={member.id} className="flex items-center gap-3 rounded-xl bg-paper p-3">
              <MemberAvatar user={member.user} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-black text-ink">{member.user.name}</span>
                <span className="block truncate text-xs text-ink/50">{member.user.email}</span>
              </span>
              <span className="rounded-full bg-mint/12 px-2 py-1 text-[11px] font-black text-mint">Editor</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
