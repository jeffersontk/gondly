import { isQuietHour as replenishmentQuietHour, nextOccurrence } from "../replenishment/rules";
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import webpush from "web-push";
import { toNumber } from "../common/utils/money";
import { PrismaService } from "../prisma/prisma.service";
import { PushSubscriptionDto } from "./dto";

const HOUR = 60 * 60_000;
// Reminders to finish a purchase, counted from the last item put in the cart.
export const FINISH_REMINDER_STAGES = [
  { stage: 1, after: 1 * HOUR },
  { stage: 2, after: 2 * HOUR },
] as const;
// A purchase left open longer than this was abandoned; reminding about it would only be noise.
const FINISH_REMINDER_MAX_AGE = 12 * HOUR;
const IN_PROCESS_INTERVAL = 5 * 60_000;
const QUIET_HOURS = { start: 23, end: 7, timeZone: "America/Sao_Paulo" };
const BATCH_SIZE = 200;

const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

type PushPayload = { title: string; body: string; url: string; tag: string; type?: "chat"; listId?: string; messageId?: string };

@Injectable()
export class PushService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;
  private interval?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    const publicKey = this.config.get<string>("VAPID_PUBLIC_KEY");
    const privateKey = this.config.get<string>("VAPID_PRIVATE_KEY");
    if (!publicKey || !privateKey) {
      this.logger.warn("Web push disabled: VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY are not configured.");
      return;
    }

    webpush.setVapidDetails(this.config.get<string>("VAPID_SUBJECT") ?? "mailto:contato@gondly.app", publicKey, privateKey);
    this.publicKey = publicKey;
    // The API runs continuously on the VPS, so an in-process timer is enough. POST /push/reminders/run can trigger
    // the same check manually; each reminder stage is reserved before sending, so overlapping runs never double-send.
    this.interval = setInterval(() => { void this.runFinishReminders(); void this.runReplenishmentReminders(); }, IN_PROCESS_INTERVAL);
    this.interval.unref();
  }

  onModuleDestroy() {
    if (this.interval) clearInterval(this.interval);
  }

  getPublicKey() {
    return { publicKey: this.publicKey };
  }

  async subscribe(userId: string, dto: PushSubscriptionDto) {
    // The same browser can be reused by another account; the endpoint always belongs to the last user who registered it.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId, p256dh: dto.p256dh, auth: dto.auth, userAgent: dto.userAgent },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth, userAgent: dto.userAgent },
    });
    return { subscribed: true };
  }

  async unsubscribe(userId: string, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return { subscribed: false };
  }

  async notifyListMessage(listId: string, senderId: string, senderName: string, messageId: string) {
    if (!this.publicKey) return 0;
    const list = await this.prisma.marketList.findFirst({
      where: { id: listId, deletedAt: null },
      select: { userId: true, name: true, members: { where: { status: "accepted" }, select: { userId: true } } },
    });
    if (!list) return 0;
    const participants = new Set([list.userId, ...list.members.map(member => member.userId)]);
    if (!participants.has(senderId)) return 0;
    participants.delete(senderId);
    return this.sendToUsers([...participants], {
      type: "chat", listId, messageId,
      title: "Nova mensagem no Gondly",
      body: `${senderName.slice(0, 80)} enviou uma mensagem em ${list.name}.`,
      url: `/app/lists/${listId}?chat=1`, tag: `chat-${listId}`,
    });
  }

  async runFinishReminders(now = new Date()) {
    const result = { checked: 0, reminded: 0, sent: 0 };
    if (!this.publicKey || this.running || isQuietHour(now)) return result;

    this.running = true;
    try {
      const firstStage = FINISH_REMINDER_STAGES[0];
      const purchases = await this.prisma.purchase.findMany({
        where: {
          status: "in_progress",
          deletedAt: null,
          OR: FINISH_REMINDER_STAGES.map(({ stage, after }) => ({
            finishRemindersSent: stage - 1,
            lastCartActivityAt: { lte: new Date(now.getTime() - after) },
          })),
        },
        select: {
          id: true,
          userId: true,
          lastCartActivityAt: true,
          finishRemindersSent: true,
          subtotalCalculated: true,
          sourceList: { select: { name: true } },
          participants: { select: { userId: true } },
          items: { where: { pricePaid: { gt: 0 } }, select: { id: true } },
        },
        orderBy: { lastCartActivityAt: "asc" },
        take: BATCH_SIZE,
      });
      result.checked = purchases.length;

      for (const purchase of purchases) {
        if (!purchase.lastCartActivityAt) continue;
        const elapsed = now.getTime() - purchase.lastCartActivityAt.getTime();
        const lastStage = FINISH_REMINDER_STAGES[FINISH_REMINDER_STAGES.length - 1].stage;
        const stage = elapsed > FINISH_REMINDER_MAX_AGE ? lastStage : [...FINISH_REMINDER_STAGES].reverse().find(({ after }) => elapsed >= after)?.stage ?? firstStage.stage;

        // Reserve the stage before sending so the in-process timer and the external scheduler never send it twice.
        const reserved = await this.prisma.purchase.updateMany({
          where: { id: purchase.id, finishRemindersSent: purchase.finishRemindersSent },
          data: { finishRemindersSent: stage },
        });
        if (!reserved.count || elapsed > FINISH_REMINDER_MAX_AGE || !purchase.items.length) continue;

        const userIds = [...new Set([purchase.userId, ...purchase.participants.map((participant) => participant.userId)])];
        const count = purchase.items.length;
        const listName = purchase.sourceList?.name;
        result.reminded += 1;
        result.sent += await this.sendToUsers(userIds, {
          title: "Já passou no caixa?",
          body: `${listName ? `A compra "${listName}"` : "Sua compra"} ainda está aberta com ${count} ${count === 1 ? "item" : "itens"} (${brl.format(toNumber(purchase.subtotalCalculated))}). Toque para finalizar.`,
          url: `/app/purchase/${purchase.id}/finish`,
          tag: `finish-purchase-${purchase.id}`,
        });
      }
    } catch (error) {
      this.logger.error("Finish-purchase reminders failed", error instanceof Error ? error.stack : String(error));
    } finally {
      this.running = false;
    }

    return result;
  }

  async runReplenishmentReminders(now = new Date()) {
    if (!this.publicKey) return { sent: 0 };
    let sent = 0;
    try {
      const due = await this.prisma.listReplenishment.findMany({
        where: { enabled: true, nextReminderAt: { lte: now }, list: { deletedAt: null, status: "active" } },
        include: { list: { select: { name: true, userId: true, members: { where: { status: "accepted" }, select: { userId: true } } } } },
        take: BATCH_SIZE, orderBy: { nextReminderAt: "asc" },
      });
      for (const reminder of due) {
        const authorized = reminder.list.userId === reminder.userId || reminder.list.members.some(m => m.userId === reminder.userId);
        if (!authorized) {
          await this.prisma.listReplenishment.updateMany({ where: { id: reminder.id, updatedAt: reminder.updatedAt }, data: { enabled: false } });
          continue;
        }
        if (replenishmentQuietHour(now, reminder.quietStart, reminder.quietEnd, reminder.timeZone)) continue;
        const hasPermission = await this.prisma.pushSubscription.count({ where: { userId: reminder.userId } });
        if (!hasPermission) continue;
        // Compare-and-swap includes preferences/version: cancellation or edits invalidate this reservation.
        const reserved = await this.prisma.listReplenishment.updateMany({
          where: { id: reminder.id, enabled: true, nextReminderAt: reminder.nextReminderAt, updatedAt: reminder.updatedAt },
          data: { nextReminderAt: nextOccurrence(reminder.nextReminderAt, reminder.intervalDays, now) },
        });
        if (!reserved.count) continue;
        sent += await this.sendToUsers([reminder.userId], {
          title: "Hora de revisar sua lista",
            body: 'Revise os itens de "' + reminder.list.name + '" antes da próxima compra.',
          url: '/app/lists/' + reminder.listId + '?review=1', tag: 'replenishment-' + reminder.id,
        });
      }
    } catch (error) {
      this.logger.error("Replenishment reminders failed", error instanceof Error ? error.stack : String(error));
    }
    return { sent };
  }

  private async sendToUsers(userIds: string[], payload: PushPayload) {
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { userId: { in: userIds } } });
    let sent = 0;

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(payload),
          { TTL: payload.type === "chat" ? 300 : 60 * 60, urgency: payload.type === "chat" ? "high" : "normal" },
        );
        sent += 1;
        await this.prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastUsedAt: new Date() } });
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // The browser revoked the subscription (permission removed, app uninstalled).
          await this.prisma.pushSubscription.delete({ where: { id: subscription.id } }).catch(() => undefined);
        } else {
          this.logger.warn(`Push to subscription ${subscription.id} failed with status ${statusCode ?? "unknown"}.`);
        }
      }
    }

    return sent;
  }
}

function isQuietHour(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: QUIET_HOURS.timeZone }).format(date));
  return hour >= QUIET_HOURS.start || hour < QUIET_HOURS.end;
}
