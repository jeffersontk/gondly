import { Injectable } from "@nestjs/common";
import type { Server } from "socket.io";

@Injectable()
export class RealtimeService {
  private server?: Server;

  bindServer(server: Server) {
    this.server = server;
  }

  emitToList(listId: string, event: string, payload: unknown) {
    this.server?.to(`list:${listId}`).emit(event, payload);
  }

  emitToPurchase(purchaseId: string, event: string, payload: unknown) {
    this.server?.to(`purchase:${purchaseId}`).emit(event, payload);
  }
}
