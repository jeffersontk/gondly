import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, UserPlus } from "lucide-react";
import { AppButton, ErrorState, LoadingState, MemberAvatar, ScreenContainer } from "../../components";
import { ItemFeedback } from "../../components/ItemFeedback";
import { api } from "../../lib/api";
import type { MarketList, ShareLinkInfo } from "../../types";

export function SharedListPage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const info = useQuery({
    queryKey: ["share-link", token],
    queryFn: () => api<ShareLinkInfo>(`/lists/share-links/${token}`),
    enabled: Boolean(token),
    refetchInterval: (query) => (query.state.data?.accessStatus === "invited" ? 5_000 : false),
  });
  const request = useMutation({
    mutationFn: () => api<{ status: ShareLinkInfo["accessStatus"]; listId: string }>(`/lists/share-links/${token}/request`, { method: "POST" }),
    onSuccess: (result) => {
      queryClient.setQueryData<ShareLinkInfo>(["share-link", token], (current) =>
        current ? { ...current, accessStatus: result.status } : current,
      );
    },
  });

  useEffect(() => {
    if (info.data?.accessStatus !== "accepted" && info.data?.accessStatus !== "owner") return;

    let cancelled = false;
    const listId = info.data.listId;

    async function refreshAccessibleLists() {
      queryClient.removeQueries({ queryKey: ["lists"] });
      await queryClient
        .fetchQuery({
          queryKey: ["lists"],
          queryFn: () => api<MarketList[]>("/lists"),
          staleTime: 0,
        })
        .catch(() => undefined);

      if (!cancelled) {
        navigate(`/app/lists/${listId}`, { replace: true });
      }
    }

    void refreshAccessibleLists();
    return () => {
      cancelled = true;
    };
  }, [info.data?.accessStatus, info.data?.listId, navigate, queryClient]);

  if (info.isLoading) return <LoadingState label="Carregando convite" />;
  if (info.isError || !info.data) {
    return <ScreenContainer title="Lista compartilhada"><ErrorState /></ScreenContainer>;
  }

  const waiting = info.data.accessStatus === "invited" || request.data?.status === "invited";

  return (
    <ScreenContainer title="Lista compartilhada">
      <div className="rounded-xl bg-white p-4 shadow-soft">
        <div className="flex items-center gap-3">
          <MemberAvatar user={info.data.owner} />
          <span>
            <span className="block text-xs font-semibold text-ink/45">Lista de {info.data.owner.name}</span>
            <span className="block text-lg font-black text-ink">{info.data.listName}</span>
          </span>
        </div>
        {info.data.description ? <p className="mt-3 text-sm text-ink/60">{info.data.description}</p> : null}

        {waiting ? (
          <div className="mt-4 rounded-xl border border-sky/20 bg-sky/10 p-4 text-center">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-sky" />
            <p className="mt-2 text-sm font-black text-sky">Aguardando aprovação</p>
            <p className="mt-1 text-xs text-ink/55">O dono da lista precisa aceitar sua solicitação. Esta página atualiza automaticamente.</p>
          </div>
        ) : (
          <AppButton className="mt-4" full icon={<UserPlus className="h-4 w-4" />} onClick={() => request.mutate()} loading={request.isPending} loadingLabel="Enviando solicitação">
            Solicitar acesso
          </AppButton>
        )}
        {request.isError ? <div className="mt-3"><ItemFeedback tone="error" message="Não foi possível solicitar acesso." /></div> : null}
      </div>
    </ScreenContainer>
  );
}
