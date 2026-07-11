import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { api } from "../../lib/api";
import type { ListMessage } from "../../types";
import { type ListMessageRealtimePayload, upsertListMessageCache } from "../shared";

export function useListChat(listId: string | undefined, socket: Socket | undefined) {
  const queryClient = useQueryClient();
  const messagesQuery = useQuery({
    queryKey: ["list-messages", listId],
    queryFn: () => api<ListMessage[]>(`/lists/${listId}/messages`),
    enabled: Boolean(listId),
  });

  const sendMessage = useMutation({
    mutationFn: (body: string) => api<ListMessage>(`/lists/${listId}/messages`, { method: "POST", body: { body } }),
    onSuccess: (message) => {
      queryClient.setQueryData<ListMessage[]>(["list-messages", listId], (current) => upsertListMessageCache(current, message));
    },
  });

  useEffect(() => {
    if (!socket || !listId) return;

    const handleMessageCreated = (payload: ListMessageRealtimePayload) => {
      if (payload.listId !== listId) return;
      queryClient.setQueryData<ListMessage[]>(["list-messages", listId], (current) => upsertListMessageCache(current, payload.message));
    };

    socket.on("listMessageCreated", handleMessageCreated);
    return () => {
      socket.off("listMessageCreated", handleMessageCreated);
    };
  }, [socket, listId, queryClient]);

  return {
    messages: messagesQuery.data ?? [],
    isLoading: messagesQuery.isLoading,
    send: (body: string) => sendMessage.mutate(body),
    sending: sendMessage.isPending,
  };
}
