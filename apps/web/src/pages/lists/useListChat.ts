import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Socket } from "socket.io-client";
import { api } from "../../lib/api";
import type { ListMessage } from "../../types";
import type { ListMessageRealtimePayload } from "../shared";
import { useChatNotifications } from "./useChatNotifications";
import { mergeChatMessages } from "./chatNotifications";

const EMPTY_MESSAGES: ListMessage[] = [];

export function useListChat(listId: string | undefined, socket: Socket | undefined, options: { currentUserId?: string; open?: boolean } = {}) {
  const queryClient = useQueryClient();
  const messagesQuery = useQuery({
    queryKey: ["list-messages", listId],
    queryFn: async () => {
      const fetched = await api<ListMessage[]>(`/lists/${listId}/messages`);
      return mergeChatMessages(fetched, queryClient.getQueryData<ListMessage[]>(["list-messages", listId]));
    },
    enabled: Boolean(listId),
  });
  const messages = messagesQuery.data ?? EMPTY_MESSAGES;
  const notifications = useChatNotifications(listId, messages, options.currentUserId, options.open ?? false);
  const onIncomingRef = useRef(notifications.onIncoming);
  onIncomingRef.current = notifications.onIncoming;

  const sendMessage = useMutation({
    mutationFn: (body: string) => api<ListMessage>(`/lists/${listId}/messages`, { method: "POST", body: { body } }),
    onSuccess: (message) => {
      queryClient.setQueryData<ListMessage[]>(["list-messages", listId], (current) => mergeChatMessages([message], current));
    },
  });

  useEffect(() => {
    if (!socket || !listId) return;

    const handleMessageCreated = (payload: ListMessageRealtimePayload) => {
      if (payload.listId !== listId) return;
      let isNew = false;
      queryClient.setQueryData<ListMessage[]>(["list-messages", listId], (current) => {
        isNew = !current?.some(message => message.id === payload.message.id);
        return mergeChatMessages([payload.message], current);
      });
      if (isNew) onIncomingRef.current(payload.message);
    };
    const resyncMessages = () => { void queryClient.invalidateQueries({ queryKey: ["list-messages", listId] }); };

    socket.on("listMessageCreated", handleMessageCreated);
    socket.on("connect", resyncMessages);
    if (socket.connected) resyncMessages();
    return () => {
      socket.off("listMessageCreated", handleMessageCreated);
      socket.off("connect", resyncMessages);
    };
  }, [socket, listId, queryClient]);

  return {
    ...notifications,
    messages,
    isLoading: messagesQuery.isLoading,
    send: (body: string) => sendMessage.mutate(body),
    sending: sendMessage.isPending,
  };
}
