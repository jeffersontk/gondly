import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import type { Server } from "socket.io";

type RealtimePayload = Record<string, unknown>;

@Injectable()
export class RealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitToList(listId: string, event: string, payload: unknown) {
    this.server?.to(`list:${listId}`).emit(event, this.buildEventPayload(event, payload));
  }

  emitToPurchase(purchaseId: string, event: string, payload: unknown) {
    this.server?.to(`purchase:${purchaseId}`).emit(event, this.buildEventPayload(event, payload));
  }

  buildEventPayload(event: string, payload: unknown) {
    if (!this.isPayloadObject(payload)) {
      return payload;
    }

    const originalPayload = { ...payload };
    const descriptor = this.describeEvent(event, originalPayload);
    const actorUserId = this.stringValue(originalPayload.actorUserId) ?? this.stringValue(originalPayload.byUserId) ?? this.actorFromPayload(originalPayload);
    const eventPayload = {
      ...originalPayload,
      eventId: this.stringValue(originalPayload.eventId) ?? randomUUID(),
      entityType: this.stringValue(originalPayload.entityType) ?? descriptor.entityType,
      entityId: this.stringValue(originalPayload.entityId) ?? descriptor.entityId,
      action: this.stringValue(originalPayload.action) ?? descriptor.action,
      updatedAt: this.isoDate(originalPayload.updatedAt) ?? descriptor.updatedAt ?? new Date().toISOString(),
      payload: originalPayload,
      actorUserId,
    };

    return actorUserId && !this.stringValue(originalPayload.byUserId) ? { ...eventPayload, byUserId: actorUserId } : eventPayload;
  }

  private describeEvent(event: string, payload: RealtimePayload) {
    if (event === "listItemUpdated" || event === "itemAssigned" || event === "itemPurchased" || event === "itemSkipped") {
      return {
        entityType: "listItem",
        entityId: this.entityIdFromItem(payload) ?? this.stringValue(payload.itemId),
        action: this.stringValue(payload.action) ?? this.defaultActionFor(event),
        updatedAt: this.updatedAtFromItem(payload),
      };
    }

    if (event === "purchaseItemCreated" || event === "purchaseItemUpdated" || event === "purchaseItemDeleted" || event === "purchaseItemChanged") {
      return {
        entityType: "purchaseItem",
        entityId: this.entityIdFromItem(payload) ?? this.stringValue(payload.itemId),
        action: this.stringValue(payload.action) ?? this.defaultActionFor(event),
        updatedAt: this.updatedAtFromItem(payload),
      };
    }

    if (event === "purchaseTotalUpdated" || event === "purchaseItemsSynced") {
      const purchase = this.objectValue(payload.purchase);
      return {
        entityType: "purchase",
        entityId: this.stringValue(payload.purchaseId),
        action: this.stringValue(payload.status) ?? this.defaultActionFor(event),
        updatedAt: this.isoDate(purchase?.updatedAt) ?? this.isoDate(payload.purchaseUpdatedAt),
      };
    }

    if (event === "listItemsImported" || event === "accessRequested" || event === "memberApproved" || event === "memberRemoved") {
      return {
        entityType: "list",
        entityId: this.stringValue(payload.listId),
        action: this.defaultActionFor(event),
        updatedAt: undefined,
      };
    }

    if (event === "listMessageCreated") {
      const message = this.objectValue(payload.message);
      return {
        entityType: "listMessage",
        entityId: this.stringValue(message?.id),
        action: this.defaultActionFor(event),
        updatedAt: this.isoDate(message?.createdAt),
      };
    }

    return {
      entityType: this.stringValue(payload.entityType) ?? "unknown",
      entityId: this.stringValue(payload.entityId) ?? this.stringValue(payload.purchaseId) ?? this.stringValue(payload.listId),
      action: this.defaultActionFor(event),
      updatedAt: undefined,
    };
  }

  private defaultActionFor(event: string) {
    const actions: Record<string, string> = {
      itemAssigned: "assigned",
      itemPurchased: "purchased",
      itemSkipped: "skipped",
      listItemUpdated: "updated",
      purchaseItemCreated: "created",
      purchaseItemUpdated: "updated",
      purchaseItemDeleted: "deleted",
      purchaseItemChanged: "changed",
      purchaseItemsSynced: "synced",
      purchaseTotalUpdated: "total_updated",
      listItemsImported: "imported",
      accessRequested: "access_requested",
      memberApproved: "member_approved",
      memberRemoved: "member_removed",
      listMessageCreated: "created",
    };
    return actions[event] ?? event;
  }

  private entityIdFromItem(payload: RealtimePayload) {
    const item = this.objectValue(payload.item);
    return this.stringValue(item?.id);
  }

  private updatedAtFromItem(payload: RealtimePayload) {
    const item = this.objectValue(payload.item);
    return this.isoDate(item?.updatedAt);
  }

  private actorFromPayload(payload: RealtimePayload) {
    const by = this.objectValue(payload.by);
    return this.stringValue(by?.userId);
  }

  private isPayloadObject(value: unknown): value is RealtimePayload {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private objectValue(value: unknown): RealtimePayload | undefined {
    return this.isPayloadObject(value) ? value : undefined;
  }

  private stringValue(value: unknown) {
    return typeof value === "string" && value.length > 0 ? value : undefined;
  }

  private isoDate(value: unknown) {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === "string" && value.length > 0) return value;
    return undefined;
  }
}
