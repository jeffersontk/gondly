import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ListMessage } from "../../types";
import { getListLastMessageReadAt, setListLastMessageReadAt } from "../../lib/listActivity";
import { CHAT_SOUND_CHANGED, getChatSoundEnabled, playChatSound, saveChatSoundEnabled, unlockChatSound } from "../../lib/chatSound";
import { createChatAlertTracker, unreadChatMessages } from "./chatNotifications";

export function useChatNotifications(listId: string | undefined, messages: ListMessage[], currentUserId: string | undefined, chatOpen: boolean) {
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const [readState, setReadState] = useState({ listId, at: listId ? getListLastMessageReadAt(listId) : 0 });
  const [soundEnabled, setSoundEnabled] = useState(getChatSoundEnabled);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const tracker = useRef(createChatAlertTracker());
  const lastReadAt = readState.listId === listId ? readState.at : listId ? getListLastMessageReadAt(listId) : 0;
  const unread = useMemo(() => unreadChatMessages(messages, currentUserId, lastReadAt), [messages, currentUserId, lastReadAt]);
  const latest = unread[unread.length - 1];
  const noticeKey = latest ? `${listId}:${latest.id}:${unread.length}` : null;

  useEffect(() => {
    const visibility = () => setVisible(document.visibilityState === "visible");
    const onStorage = () => {
      setSoundEnabled(getChatSoundEnabled());
      if (listId) setReadState({ listId, at: getListLastMessageReadAt(listId) });
    };
    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("storage", onStorage);
    window.addEventListener(CHAT_SOUND_CHANGED, onStorage);
    window.addEventListener("pointerdown", unlockChatSound, true);
    window.addEventListener("pointerup", unlockChatSound, true);
    window.addEventListener("keydown", unlockChatSound, true);
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(CHAT_SOUND_CHANGED, onStorage);
      window.removeEventListener("pointerdown", unlockChatSound, true);
      window.removeEventListener("pointerup", unlockChatSound, true);
      window.removeEventListener("keydown", unlockChatSound, true);
    };
  }, [listId]);

  useEffect(() => {
    if (!listId || !chatOpen || !visible) return;
    const at = Math.max(Date.now(), ...messages.map(message => Date.parse(message.createdAt)).filter(Number.isFinite));
    setListLastMessageReadAt(listId, at);
    setReadState(previous => previous.listId === listId && previous.at === at ? previous : { listId, at });
  }, [listId, chatOpen, visible, messages]);

  const onIncoming = useCallback((message: ListMessage) => {
    if (tracker.current.accept(message, { currentUserId, chatOpen, visible: document.visibilityState === "visible", lastReadAt }) && soundEnabled) playChatSound();
  }, [currentUserId, chatOpen, lastReadAt, soundEnabled]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    saveChatSoundEnabled(next);
    if (next) unlockChatSound();
  };

  return {
    unreadCount: chatOpen && visible ? 0 : unread.length,
    notice: !chatOpen && visible && latest && dismissed !== noticeKey ? latest : undefined,
    dismissNotice: () => setDismissed(noticeKey),
    soundEnabled,
    toggleSound,
    onIncoming,
  };
}
