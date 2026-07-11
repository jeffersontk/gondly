import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import type { JwtUser } from "../common/auth.types";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { CreateInviteDto, CreateListMessageDto, UpdateMemberRoleDto } from "../lists/dto";
import { SharingService } from "./sharing.service";

@ApiTags("Sharing")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("lists")
export class SharingController {
  constructor(private readonly sharingService: SharingService) {}

  @Get(":id/members")
  members(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.sharingService.members(user.id, id);
  }

  @Post(":id/invites")
  invite(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: CreateInviteDto) {
    return this.sharingService.invite(user.id, id, dto);
  }

  @Post(":id/share-link")
  createShareLink(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.sharingService.createShareLink(user.id, id);
  }

  @Get("share-links/:token")
  shareLink(@CurrentUser() user: JwtUser, @Param("token") token: string) {
    return this.sharingService.shareLink(user.id, token);
  }

  @Post("share-links/:token/request")
  requestAccess(@CurrentUser() user: JwtUser, @Param("token") token: string) {
    return this.sharingService.requestAccess(user.id, token);
  }

  @Post("invites/:token/accept")
  acceptInvite(@CurrentUser() user: JwtUser, @Param("token") token: string) {
    return this.sharingService.acceptInvite(user.id, user.email, token);
  }

  @Put(":id/members/:memberId/approve")
  approveMember(@CurrentUser() user: JwtUser, @Param("id") id: string, @Param("memberId") memberId: string) {
    return this.sharingService.approveMember(user.id, id, memberId);
  }

  @Delete(":id/members/:memberId")
  removeMember(@CurrentUser() user: JwtUser, @Param("id") id: string, @Param("memberId") memberId: string) {
    return this.sharingService.removeMember(user.id, id, memberId);
  }

  @Put(":id/members/:memberId/role")
  updateMemberRole(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Param("memberId") memberId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    return this.sharingService.updateMemberRole(user.id, id, memberId, dto.role);
  }

  @Get(":id/messages")
  messages(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.sharingService.messages(user.id, id);
  }

  @Post(":id/messages")
  addMessage(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: CreateListMessageDto) {
    return this.sharingService.addMessage(user.id, id, dto.body);
  }
}
