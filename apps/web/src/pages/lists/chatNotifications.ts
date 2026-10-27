import type { ListMessage } from "../../types";

export function mergeChatMessages(fetched: ListMessage[], current: ListMessage[] = []) {
  const byId = new Map([...current, ...fetched].map(message => [message.id, message]));
  return [...byId.values()].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}

export function unreadChatMessages(messages: ListMessage[], currentUserId: string | undefined, lastReadAt: number) {
  if (!currentUserId) return [];
  return messages.filter(message => message.userId !== currentUserId && Date.parse(message.createdAt) > lastReadAt)
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.id.localeCompare(b.id));
}

export function createChatAlertTracker() {
  const seen = new Set<string>();
  return {
    accept(message: ListMessage, context: { currentUserId?: string; chatOpen: boolean; visible: boolean; lastReadAt: number }) {
      if (seen.has(message.id)) return false;
      seen.add(message.id);
      if (seen.size > 1000) seen.delete(seen.values().next().value!);
      return Boolean(context.currentUserId && message.userId !== context.currentUserId && !context.chatOpen && context.visible && Date.parse(message.createdAt) > context.lastReadAt);
    },
  };
}
