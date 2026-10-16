import type { Prisma } from "@prisma/client";

/**
 * Who can see a purchase:
 * - its owner;
 * - current accepted members of the source list;
 * - past participants, but only for purchases without a list or already ended (history). A member removed from the
 *   list therefore stops seeing, and receiving realtime events of, the purchase still in progress.
 */
export function purchaseAccessWhere(userId: string): Prisma.PurchaseWhereInput {
  return {
    OR: [
      { userId },
      { sourceList: { members: { some: { userId, status: "accepted" } } } },
      {
        participants: { some: { userId } },
        OR: [{ sourceListId: null }, { status: { not: "in_progress" } }],
      },
    ],
  };
}
