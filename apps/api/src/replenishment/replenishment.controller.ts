import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import { DismissSuggestionDto, ReplenishmentDto } from "./dto";
import { ReplenishmentService } from "./replenishment.service";
@UseGuards(JwtAuthGuard)
@Controller("lists/:listId/replenishment")
export class ReplenishmentController {
    constructor(private readonly service: ReplenishmentService) { }
    @Get()
    get(
    @CurrentUser()
    user: JwtUser,
    @Param("listId")
    id: string) { return this.service.get(user.id, id); }
    @Put()
    save(
    @CurrentUser()
    user: JwtUser,
    @Param("listId")
    id: string,
    @Body()
    dto: ReplenishmentDto) { return this.service.save(user.id, id, dto); }
    @Delete()
    cancel(
    @CurrentUser()
    user: JwtUser,
    @Param("listId")
    id: string) { return this.service.cancel(user.id, id); }
    @Get("suggestions")
    suggestions(
    @CurrentUser()
    user: JwtUser,
    @Param("listId")
    id: string) { return this.service.suggestions(user.id, id); }
    @Post("accept")
    accept(
    @CurrentUser()
    user: JwtUser,
    @Param("listId")
    id: string,
    @Body()
    dto: DismissSuggestionDto) { return this.service.accept(user.id, id, dto.key); }
    @Post("dismiss")
    dismiss(
    @CurrentUser()
    user: JwtUser,
    @Param("listId")
    id: string,
    @Body()
    dto: DismissSuggestionDto) { return this.service.dismiss(user.id, id, dto.key); }
}
