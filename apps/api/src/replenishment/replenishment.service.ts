import { RealtimeService } from "../realtime/realtime.service";
import { BadRequestException, ForbiddenException, Injectable, NotFoundException, Optional } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ReplenishmentDto } from "./dto";
import { suggestionKey } from "./rules";
@Injectable()
export class ReplenishmentService {
    constructor(private readonly prisma: PrismaService,
    @Optional()
    private readonly realtime?: RealtimeService) { }
    private async access(userId: string, listId: string) {
        const list = await this.prisma.marketList.findFirst({ where: { id: listId, deletedAt: null, OR: [{ userId }, { members: { some: { userId, status: "accepted" } } }] }, include: { items: true } });
        if (!list)
            throw new NotFoundException("Lista não encontrada.");
        return list;
    }
    async get(userId: string, listId: string) {
        await this.access(userId, listId);
        return this.prisma.listReplenishment.findUnique({ where: { userId_listId: { userId, listId } } });
    }
    async save(userId: string, listId: string, dto: ReplenishmentDto) {
        await this.access(userId, listId);
        try {
            new Intl.DateTimeFormat("en-US", { timeZone: dto.timeZone }).format();
        }
        catch {
            throw new BadRequestException("Fuso horário inválido.");
        }
        const date = new Date(dto.nextReminderAt);
        if (dto.enabled && date.getTime() <= Date.now())
            throw new BadRequestException("Escolha uma data futura.");
        const data = { ...dto, nextReminderAt: date };
        return this.prisma.listReplenishment.upsert({ where: { userId_listId: { userId, listId } }, create: { userId, listId, ...data }, update: data });
    }
    async cancel(userId: string, listId: string) {
        await this.access(userId, listId);
        await this.prisma.listReplenishment.updateMany({ where: { userId, listId }, data: { enabled: false } });
        return { enabled: false };
    }
    async suggestions(userId: string, listId: string) {
        const list = await this.access(userId, listId);
        const setting = await this.prisma.listReplenishment.findUnique({ where: { userId_listId: { userId, listId } } });
        // Only this user's completed purchases; no shared or aggregated shopping history.
        const purchases = await this.prisma.purchase.findMany({ where: { userId, status: "completed", deletedAt: null }, orderBy: { completedAt: "desc" }, take: 20, include: { items: true } });
        const excluded = new Set([...list.items.map(suggestionKey), ...(setting?.dismissedKeys ?? [])]);
        const counts = new Map<string, {
            item: typeof purchases[number]["items"][number];
            count: number;
        }>();
        for (const purchase of purchases) {
            const seen = new Set<string>();
            for (const item of purchase.items) {
                if (!(item.quantity > 0 && Number(item.pricePaid) > 0))
                    continue;
                const key = suggestionKey(item);
                if (seen.has(key) || excluded.has(key))
                    continue;
                seen.add(key);
                const entry = counts.get(key);
                counts.set(key, { item: entry?.item ?? item, count: (entry?.count ?? 0) + 1 });
            }
        }
        return [...counts].filter(([, v]) => v.count >= 2).sort((a, b) => b[1].count - a[1].count).slice(0, 10).map(([key, { item, count }]) => ({ key, productName: item.productName, brand: item.brandNameSnapshot ?? item.brand, unit: item.unit, packageSize: item.packageSize, packageUnit: item.packageUnit, expectedQuantity: item.quantity, explanation: `Presente em ${count} das suas últimas ${purchases.length} compras finalizadas.` }));
    }
    async accept(userId: string, listId: string, key: string) {
        const suggestion = (await this.suggestions(userId, listId)).find(item => item.key === key);
        if (!suggestion)
            throw new BadRequestException("Sugestão indisponível ou já adicionada.");
        const item = await this.prisma.$transaction(async (tx) => {
            // Serialize accepts for this list, including simultaneous clicks from two devices.
            await tx.$queryRaw `SELECT "id" FROM "MarketList" WHERE "id" = ${listId} FOR UPDATE`;
            const list = await tx.marketList.findFirst({ where: { id: listId, deletedAt: null }, include: { members: true, items: true } });
            if (!list || (list.userId !== userId && !list.members.some(m => m.userId === userId && m.status === "accepted" && m.role !== "viewer")))
                throw new ForbiddenException("Sem permissão para editar esta lista.");
            const existing = list.items.find(item => suggestionKey(item) === key);
            if (existing)
                return existing;
            const active = await tx.purchase.findFirst({ where: { sourceListId: listId, status: "in_progress", deletedAt: null }, select: { id: true } });
            if (active)
                throw new BadRequestException("Finalize a compra em andamento antes de preparar a próxima lista.");
            return tx.marketListItem.create({ data: { listId, productName: suggestion.productName, brand: suggestion.brand, brandNameSnapshot: suggestion.brand, unit: suggestion.unit, packageSize: suggestion.packageSize, packageUnit: suggestion.packageUnit, expectedQuantity: suggestion.expectedQuantity } });
        });
        this.realtime?.emitToList(listId, "listItemUpdated", { listId, item, action: "created", byUserId: userId });
        return item;
    }
    async dismiss(userId: string, listId: string, key: string) {
        await this.access(userId, listId);
        // Atomic array append; duplicate dismissals are harmless and never create items.
        return this.prisma.listReplenishment.upsert({ where: { userId_listId: { userId, listId } }, create: { userId, listId, enabled: false, nextReminderAt: new Date(), dismissedKeys: [key] }, update: { dismissedKeys: { push: key } } });
    }
}
