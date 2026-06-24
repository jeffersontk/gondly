import { Body, Controller, Delete, Get, Param, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { JwtUser } from "../common/auth.types";
import {
  CreateListDto,
  CreateListItemDto,
  ImportListItemsDto,
  SetListItemStateDto,
  UpdateListDto,
  UpdateListItemDto,
} from "./dto";
import { ListsService } from "./lists.service";

@ApiTags("Lists")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("lists")
export class ListsController {
  constructor(private readonly listsService: ListsService) {}

  @Get()
  list(@CurrentUser() user: JwtUser) {
    return this.listsService.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: JwtUser, @Body() dto: CreateListDto) {
    return this.listsService.create(user.id, dto);
  }

  @Get(":id")
  get(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.listsService.get(user.id, id);
  }

  @Put(":id")
  update(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: UpdateListDto) {
    return this.listsService.update(user.id, id, dto);
  }

  @Delete(":id")
  remove(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.listsService.remove(user.id, id);
  }

  @Post(":id/archive")
  archive(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.listsService.archive(user.id, id);
  }

  @Post(":id/duplicate")
  duplicate(@CurrentUser() user: JwtUser, @Param("id") id: string) {
    return this.listsService.duplicate(user.id, id);
  }

  @Post(":id/items")
  addItem(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: CreateListItemDto) {
    return this.listsService.addItem(user.id, id, dto);
  }

  @Post(":id/items/import")
  importItems(@CurrentUser() user: JwtUser, @Param("id") id: string, @Body() dto: ImportListItemsDto) {
    return this.listsService.importItems(user.id, id, dto);
  }

  @Put(":id/items/:itemId")
  updateItem(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: UpdateListItemDto,
  ) {
    return this.listsService.updateItem(user.id, id, itemId, dto);
  }

  @Delete(":id/items/:itemId")
  removeItem(@CurrentUser() user: JwtUser, @Param("id") id: string, @Param("itemId") itemId: string) {
    return this.listsService.removeItem(user.id, id, itemId);
  }

  @Patch(":id/items/:itemId/state")
  setItemState(
    @CurrentUser() user: JwtUser,
    @Param("id") id: string,
    @Param("itemId") itemId: string,
    @Body() dto: SetListItemStateDto,
  ) {
    return this.listsService.setItemState(user.id, id, itemId, dto.status);
  }
}
