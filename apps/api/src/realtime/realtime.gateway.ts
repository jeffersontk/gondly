import { JwtService } from "@nestjs/jwt";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from "@nestjs/websockets";
import { Server, Socket } from "socket.io";
import { PrismaService } from "../prisma/prisma.service";
import { RealtimeService } from "./realtime.service";

type RealtimeUser = {
  id: string;
  email: string;
  name: string;
};

@WebSocketGateway({
  namespace: "/realtime",
  cors: {
    origin: process.env.FRONTEND_URL ?? process.env.WEB_ORIGIN ?? "*",
    credentials: true,
  },
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly roomPresence = new Map<string, Map<string, ReturnType<RealtimeGateway["participantPayload"]>>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
    private readonly realtimeService: RealtimeService,
  ) {}

  afterInit(server: Server) {
    this.realtimeService.bindServer(server);
  }

  async handleConnection(socket: Socket) {
    const token = String(socket.handshake.auth?.token ?? socket.handshake.query?.token ?? "");
    try {
      const payload = await this.jwtService.verifyAsync<{ sub?: string; userId?: string; email: string; name: string }>(token, {
        secret: process.env.JWT_SECRET ?? "dev-secret",
      });
      const userId = payload.sub ?? payload.userId;
      if (!userId) {
        socket.disconnect(true);
        return;
      }
      socket.data.user = { id: userId, email: payload.email, name: payload.name } satisfies RealtimeUser;
      socket.data.joinedRooms = new Set<string>();
    } catch {
      socket.disconnect(true);
    }
  }

  handleDisconnect(socket: Socket) {
    const joinedRooms = socket.data.joinedRooms as Set<string> | undefined;
    if (!joinedRooms) {
      return;
    }

    for (const room of joinedRooms) {
      this.removePresence(room, socket);
      socket.to(room).emit("participantLeft", this.participantPayload(socket));
      socket.to(room).emit("participantsOnline", this.participants(room));
    }
  }

  @SubscribeMessage("joinList")
  async joinList(@ConnectedSocket() socket: Socket, @MessageBody() body: { listId: string }) {
    const user = this.assertUser(socket);
    await this.assertListAccess(user.id, body.listId);
    const room = `list:${body.listId}`;
    socket.join(room);
    this.addPresence(room, socket);
    this.server.to(room).emit("participantJoined", this.participantPayload(socket));
    this.server.to(room).emit("participantsOnline", this.participants(room));
    return { event: "joinedList", data: { listId: body.listId, participants: this.participants(room) } };
  }

  @SubscribeMessage("leaveList")
  leaveList(@ConnectedSocket() socket: Socket, @MessageBody() body: { listId: string }) {
    const room = `list:${body.listId}`;
    socket.leave(room);
    this.removePresence(room, socket);
    this.server.to(room).emit("participantLeft", this.participantPayload(socket));
    this.server.to(room).emit("participantsOnline", this.participants(room));
    return { event: "leftList", data: { listId: body.listId, participants: this.participants(room) } };
  }

  @SubscribeMessage("joinPurchase")
  async joinPurchase(@ConnectedSocket() socket: Socket, @MessageBody() body: { purchaseId: string }) {
    const user = this.assertUser(socket);
    await this.assertPurchaseAccess(user.id, body.purchaseId);
    const room = `purchase:${body.purchaseId}`;
    await this.prisma.purchaseParticipant.upsert({
      where: { purchaseId_userId: { purchaseId: body.purchaseId, userId: user.id } },
      update: { lastSeenAt: new Date() },
      create: { purchaseId: body.purchaseId, userId: user.id },
    });
    socket.join(room);
    this.addPresence(room, socket);
    this.server.to(room).emit("participantJoined", this.participantPayload(socket));
    this.server.to(room).emit("participantsOnline", this.participants(room));
    return { event: "joinedPurchase", data: { purchaseId: body.purchaseId, participants: this.participants(room) } };
  }

  @SubscribeMessage("leavePurchase")
  leavePurchase(@ConnectedSocket() socket: Socket, @MessageBody() body: { purchaseId: string }) {
    const room = `purchase:${body.purchaseId}`;
    socket.leave(room);
    this.removePresence(room, socket);
    this.server.to(room).emit("participantLeft", this.participantPayload(socket));
    this.server.to(room).emit("participantsOnline", this.participants(room));
    return { event: "leftPurchase", data: { purchaseId: body.purchaseId, participants: this.participants(room) } };
  }

  @SubscribeMessage("listItemUpdated")
  async listItemUpdated(@ConnectedSocket() socket: Socket, @MessageBody() body: { listId: string; item: unknown }) {
    const user = this.assertUser(socket);
    await this.assertListAccess(user.id, body.listId);
    socket.to(`list:${body.listId}`).emit("listItemUpdated", {
      ...body,
      by: this.participantPayload(socket),
    });
  }

  @SubscribeMessage("itemAssigned")
  async itemAssigned(@ConnectedSocket() socket: Socket, @MessageBody() body: { listId: string; item: unknown }) {
    await this.emitListEvent(socket, "itemAssigned", body);
  }

  @SubscribeMessage("itemPurchased")
  async itemPurchased(@ConnectedSocket() socket: Socket, @MessageBody() body: { listId: string; item: unknown }) {
    await this.emitListEvent(socket, "itemPurchased", body);
  }

  @SubscribeMessage("itemSkipped")
  async itemSkipped(@ConnectedSocket() socket: Socket, @MessageBody() body: { listId: string; item: unknown }) {
    await this.emitListEvent(socket, "itemSkipped", body);
  }

  @SubscribeMessage("purchaseItemCreated")
  async purchaseItemCreated(@ConnectedSocket() socket: Socket, @MessageBody() body: { purchaseId: string; item: unknown }) {
    await this.emitPurchaseEvent(socket, "purchaseItemCreated", body);
  }

  @SubscribeMessage("purchaseItemUpdated")
  async purchaseItemUpdated(@ConnectedSocket() socket: Socket, @MessageBody() body: { purchaseId: string; item: unknown }) {
    await this.emitPurchaseEvent(socket, "purchaseItemUpdated", body);
  }

  @SubscribeMessage("purchaseItemDeleted")
  async purchaseItemDeleted(@ConnectedSocket() socket: Socket, @MessageBody() body: { purchaseId: string; itemId: string }) {
    await this.emitPurchaseEvent(socket, "purchaseItemDeleted", body);
  }

  @SubscribeMessage("purchaseTotalUpdated")
  async purchaseTotalUpdated(@ConnectedSocket() socket: Socket, @MessageBody() body: { purchaseId: string; total: number }) {
    await this.emitPurchaseEvent(socket, "purchaseTotalUpdated", body);
  }

  private participantPayload(socket: Socket) {
    const user = socket.data.user as RealtimeUser | undefined;
    return {
      socketId: socket.id,
      userId: user?.id,
      name: user?.name,
    };
  }

  private assertUser(socket: Socket): RealtimeUser {
    const user = socket.data.user as RealtimeUser | undefined;
    if (!user) {
      throw new WsException("Unauthorized socket.");
    }
    return user;
  }

  private async assertListAccess(userId: string, listId: string) {
    const list = await this.prisma.marketList.findFirst({
      where: {
        id: listId,
        deletedAt: null,
        OR: [{ userId }, { members: { some: { userId, status: "accepted" } } }],
      },
      select: { id: true },
    });

    if (!list) {
      throw new WsException("List not found or forbidden.");
    }
  }

  private async assertPurchaseAccess(userId: string, purchaseId: string) {
    const purchase = await this.prisma.purchase.findFirst({
      where: {
        id: purchaseId,
        deletedAt: null,
        OR: [{ userId }, { participants: { some: { userId } } }, { sourceList: { members: { some: { userId, status: "accepted" } } } }],
      },
      select: { id: true },
    });

    if (!purchase) {
      throw new WsException("Purchase not found or forbidden.");
    }
  }

  private async emitListEvent(socket: Socket, event: string, body: { listId: string; item: unknown }) {
    const user = this.assertUser(socket);
    await this.assertListAccess(user.id, body.listId);
    socket.to(`list:${body.listId}`).emit(event, { ...body, by: this.participantPayload(socket) });
  }

  private async emitPurchaseEvent(socket: Socket, event: string, body: { purchaseId: string; item?: unknown; itemId?: string; total?: number }) {
    const user = this.assertUser(socket);
    await this.assertPurchaseAccess(user.id, body.purchaseId);
    socket.to(`purchase:${body.purchaseId}`).emit(event, { ...body, by: this.participantPayload(socket) });
  }

  private addPresence(room: string, socket: Socket) {
    const roomParticipants = this.roomPresence.get(room) ?? new Map<string, ReturnType<RealtimeGateway["participantPayload"]>>();
    roomParticipants.set(socket.id, this.participantPayload(socket));
    this.roomPresence.set(room, roomParticipants);
    (socket.data.joinedRooms as Set<string> | undefined)?.add(room);
  }

  private removePresence(room: string, socket: Socket) {
    const roomParticipants = this.roomPresence.get(room);
    if (!roomParticipants) {
      return;
    }

    roomParticipants.delete(socket.id);
    (socket.data.joinedRooms as Set<string> | undefined)?.delete(room);
    if (!roomParticipants.size) {
      this.roomPresence.delete(room);
    }
  }

  private participants(room: string) {
    return [...(this.roomPresence.get(room)?.values() ?? [])];
  }
}
