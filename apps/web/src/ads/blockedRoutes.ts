import type { AdSlotName } from "./config";

const allowedRoutes: Record<AdSlotName, string[]> = {
  home_inline: ["/", "/app/home"],
  lists_inline: ["/app/lists", "/lists"],
  history_inline: ["/app/history", "/history"],
  compare_inline: ["/app/compare", "/prices"],
  landing_inline: ["/login"],
};

export function isBlockedAdRoute(pathname: string) {
  return (
    pathname.startsWith("/app/purchase") ||
    pathname.startsWith("/purchase") ||
    pathname.startsWith("/app/billing") ||
    pathname.startsWith("/billing") ||
    pathname === "/app/settings" ||
    pathname === "/settings" ||
    pathname.includes("/item") ||
    pathname.includes("/finish")
  );
}

export function isAllowedAdRoute(pathname: string, slot: AdSlotName) {
  return allowedRoutes[slot].includes(pathname);
}
