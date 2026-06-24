import { Injectable } from "@nestjs/common";
import { SharedRole } from "@prisma/client";
import { ListsService } from "../lists/lists.service";
import { CreateInviteDto } from "../lists/dto";

@Injectable()
export class SharingService {
  constructor(private readonly listsService: ListsService) {}

  members(userId: string, listId: string) {
    return this.listsService.members(userId, listId);
  }

  invite(userId: string, listId: string, dto: CreateInviteDto) {
    return this.listsService.invite(userId, listId, dto);
  }

  createShareLink(userId: string, listId: string) {
    return this.listsService.createShareLink(userId, listId);
  }

  shareLink(userId: string, token: string) {
    return this.listsService.shareLink(userId, token);
  }

  requestAccess(userId: string, token: string) {
    return this.listsService.requestAccess(userId, token);
  }

  acceptInvite(userId: string, userEmail: string, token: string) {
    return this.listsService.acceptInvite(userId, userEmail, token);
  }

  approveMember(userId: string, listId: string, memberId: string) {
    return this.listsService.approveMember(userId, listId, memberId);
  }

  removeMember(userId: string, listId: string, memberId: string) {
    return this.listsService.removeMember(userId, listId, memberId);
  }

  updateMemberRole(userId: string, listId: string, memberId: string, role: SharedRole) {
    return this.listsService.updateMemberRole(userId, listId, memberId, role);
  }
}
