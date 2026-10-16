import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart } from "lucide-react";
import { AppButton } from ".";
import { trackEvent } from "../lib/analytics";
import { api } from "../lib/api";
import type { Purchase } from "../types";

// After the checkout people focus on leaving the market, not on the app. Counting from the last item put in the
// cart, we remind them to finish the purchase after 1h and again after 2h.
const REMINDER_STAGES = [
  { stage: 1, delay: 60 * 60_000 },
  { stage: 2, delay: 2 * 60 * 60_000 },
] as const;
const STATE_KEY_PREFIX = "gondly.finish-reminder.";

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type ReminderState = { lastCartAt: number; shownStages: number[] };

export function cartItemsCount(purchase: Pick<Purchase, "items">) {
  return purchase.items.filter((item) => Number(item.pricePaid ?? 0) > 0).length;
}

export function usePurchaseWithCart() {
  const active = useQuery({ queryKey: ["active-purchases"], queryFn: () => api<Purchase[]>("/purchases/active") });
  return active.data?.find((purchase) => purchase.status === "in_progress" && cartItemsCount(purchase) > 0);
}

export function lastCartActivityAt(purchase: Purchase) {
  const timestamps = purchase.items
    .filter((item) => Number(item.pricePaid ?? 0) > 0)
    .map((item) => Date.parse(item.updatedAt ?? item.createdAt ?? ""))
    .filter(Number.isFinite);
  if (timestamps.length) return Math.max(...timestamps);
  const fallback = Date.parse(purchase.updatedAt ?? purchase.startedAt);
  return Number.isFinite(fallback) ? fallback : Date.now();
}

function readState(purchaseId: string, lastCartAt: number): ReminderState {
  try {
    const stored = JSON.parse(window.localStorage.getItem(STATE_KEY_PREFIX + purchaseId) ?? "null") as ReminderState | null;
    // A new item in the cart restarts the countdown.
    if (stored && stored.lastCartAt === lastCartAt) return stored;
  } catch {
    // Ignore malformed or unavailable storage.
  }
  return { lastCartAt, shownStages: [] };
}

function writeState(purchaseId: string, state: ReminderState) {
  try {
    window.localStorage.setItem(STATE_KEY_PREFIX + purchaseId, JSON.stringify(state));
  } catch {
    // Without storage a reminder may repeat; that is acceptable.
  }
}

export function canAskNotificationPermission() {
  return typeof Notification !== "undefined" && Notification.permission === "default";
}

async function showSystemNotification(purchase: Purchase) {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  const count = cartItemsCount(purchase);
  const title = "Já passou no caixa?";
  const options: NotificationOptions = {
    body: `Sua compra ainda está aberta com ${count} ${count === 1 ? "item" : "itens"} (${brl.format(Number(purchase.subtotalCalculated ?? 0))}). Toque para finalizar.`,
    icon: "/icons/gondly-icon-192x192.png",
    tag: `finish-purchase-${purchase.id}`,
    data: { url: `/app/purchase/${purchase.id}/finish` },
  };
  try {
    const registration = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (registration) await registration.showNotification(title, options);
    else new Notification(title, options);
  } catch {
    // Notifications are best effort; the in-app reminder still shows when the user returns.
  }
}

export function FinishPurchaseReminder() {
  const location = useLocation();
  const navigate = useNavigate();
  const purchase = usePurchaseWithCart();
  const [open, setOpen] = useState(false);
  const onFinishRoute = /^\/app\/purchase\/[^/]+\/(finish|item)$/.test(location.pathname);

  const checkDueStages = useCallback(() => {
    if (!purchase) return undefined;

    const lastCartAt = lastCartActivityAt(purchase);
    const state = readState(purchase.id, lastCartAt);
    const elapsed = Date.now() - lastCartAt;
    const dueStages = REMINDER_STAGES.filter(({ stage, delay }) => elapsed >= delay && !state.shownStages.includes(stage));

    if (dueStages.length) {
      const stage = dueStages[dueStages.length - 1].stage;
      writeState(purchase.id, { lastCartAt, shownStages: [...state.shownStages, ...dueStages.map((entry) => entry.stage)] });
      if (document.visibilityState === "hidden") void showSystemNotification(purchase);
      if (!onFinishRoute) setOpen(true);
      trackEvent("finish_purchase_reminder_shown", { purchase_id: purchase.id, stage, cart_items_count: cartItemsCount(purchase) });
    }

    const next = REMINDER_STAGES.find(({ stage }) => !state.shownStages.includes(stage) && !dueStages.some((entry) => entry.stage === stage));
    return next ? lastCartAt + next.delay - Date.now() : undefined;
  }, [onFinishRoute, purchase]);

  useEffect(() => {
    const timeoutMs = checkDueStages();
    // Browsers clamp very long timers, so re-check at most every 10 minutes.
    const timer = timeoutMs === undefined ? undefined : window.setTimeout(checkDueStages, Math.min(Math.max(timeoutMs, 1_000), 10 * 60_000));
    const handleVisibility = () => {
      if (document.visibilityState === "visible") checkDueStages();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      if (timer) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [checkDueStages]);

  useEffect(() => {
    if (!purchase || onFinishRoute) setOpen(false);
  }, [onFinishRoute, purchase]);

  if (!open || !purchase) return null;

  const count = cartItemsCount(purchase);
  const listName = purchase.sourceList?.name;

  return (
    <div className="fixed inset-0 z-[60] grid place-items-end bg-ink/45 p-3 backdrop-blur-sm sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="finish-reminder-title">
      <div className="mx-auto w-full max-w-sm rounded-3xl border border-line bg-white p-5 shadow-lift">
        <div className="grid h-12 w-12 place-items-center rounded-2xl bg-mint text-white shadow-soft">
          <ShoppingCart className="h-6 w-6" />
        </div>
        <h2 id="finish-reminder-title" className="mt-4 text-xl font-black tracking-[-0.03em] text-ink">
          Já passou no caixa?
        </h2>
        <p className="mt-2 text-sm leading-6 text-ink/65">
          {listName ? `A compra "${listName}"` : "Sua compra"} ainda está aberta com {count} {count === 1 ? "item" : "itens"} (
          {brl.format(Number(purchase.subtotalCalculated ?? 0))}). Finalize agora para salvar o histórico e os preços.
        </p>
        <div className="mt-5 grid gap-2">
          <AppButton
            full
            onClick={() => {
              setOpen(false);
              trackEvent("finish_purchase_reminder_accepted", { purchase_id: purchase.id });
              navigate(`/app/purchase/${purchase.id}/finish`);
            }}
          >
            Finalizar compra
          </AppButton>
          <AppButton
            full
            variant="secondary"
            onClick={() => {
              setOpen(false);
              trackEvent("finish_purchase_reminder_dismissed", { purchase_id: purchase.id });
            }}
          >
            Ainda estou comprando
          </AppButton>
        </div>
      </div>
    </div>
  );
}
