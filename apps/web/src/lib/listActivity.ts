import type { MarketList } from "../types";

const LIST_LAST_VIEWED_KEY_PREFIX = "gondly.list-last-viewed.";
const LIST_LAST_MESSAGE_READ_KEY_PREFIX = "gondly.list-last-message-read.";

export function getListLastViewedAt(listId: string) {
  try {
    const value = window.localStorage.getItem(LIST_LAST_VIEWED_KEY_PREFIX + listId);
    const parsed = value ? Number(value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setListLastViewedAt(listId: string, timestamp = Date.now()) {
  try {
    window.localStorage.setItem(LIST_LAST_VIEWED_KEY_PREFIX + listId, String(timestamp));
  } catch {
    // Local storage is an optimization for the "new items" indicator; failure should not block the app.
  }
}

export function hasNewItemsSince(list: Pick<MarketList, "id" | "items">, lastViewedAt: number) {
  if (!lastViewedAt) return false;
  return list.items.some((item) => {
    const createdAt = item.createdAt ? Date.parse(item.createdAt) : NaN;
    return Number.isFinite(createdAt) && createdAt > lastViewedAt;
  });
}

export function getListLastMessageReadAt(listId: string) {
  try {
    const value = window.localStorage.getItem(LIST_LAST_MESSAGE_READ_KEY_PREFIX + listId);
    const parsed = value ? Number(value) : 0;
    return Number.isFinite(parsed) ? parsed : 0;
  } catch {
    return 0;
  }
}

export function setListLastMessageReadAt(listId: string, timestamp = Date.now()) {
  try {
    window.localStorage.setItem(LIST_LAST_MESSAGE_READ_KEY_PREFIX + listId, String(timestamp));
  } catch {
    // Local storage is an optimization for the unread badge; failure should not block the app.
  }
}
