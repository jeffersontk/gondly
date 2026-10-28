import assert from "node:assert/strict";
import { it } from "node:test";
import { ListsService } from "../src/lists/lists.service";

it("provides diet metadata and generates suggestions through ListsService", () => {
  const service = new ListsService({} as never, {} as never, {} as never);
  const metadata = service.getDietMetadata();

  assert.ok(metadata.diets.length >= 6);
  assert.ok(metadata.restrictions.length >= 8);

  const suggestion = service.getDietSuggestion({
    dietType: "vegetarian",
    familySize: 3,
    periodDays: 14,
    restrictions: ["no_dairy"],
  });

  assert.equal(suggestion.dietType, "vegetarian");
  assert.equal(suggestion.familySize, 3);
  assert.equal(suggestion.periodDays, 14);
  assert.ok(suggestion.items.length > 5);
  // Ensured dairy restriction is respected
  assert.equal(suggestion.items.some((i) => i.productName.toLowerCase().includes("queijo")), false);
  assert.ok(suggestion.premises.includes("sem constituir prescrição médica"));
});

it("creates list and items from diet plan atomically in transaction", async () => {
  let createdList: any = null;
  const createdMembers: any[] = [];
  let createdItems: any[] = [];

  const prismaMock = {
    marketList: {
      create: async ({ data }: any) => {
        createdList = { id: "list-diet-1", ...data };
        return createdList;
      },
      findUnique: async () => ({
        ...createdList,
        items: createdItems,
        members: createdMembers,
      }),
    },
    listMember: {
      create: async ({ data }: any) => {
        createdMembers.push(data);
        return data;
      },
    },
    marketListItem: {
      createMany: async ({ data }: any) => {
        createdItems = data;
        return { count: data.length };
      },
    },
    $transaction: async (fn: any) => fn(prismaMock),
  };

  const service = new ListsService(prismaMock as never, {} as never, {} as never);
  const result = await service.createFromDietPlan("user-1", {
    name: "Compras da Semana - Família",
    description: "Planejado com base na dieta equilibrada",
    items: [
      { productName: "Banana prata", category: "Hortifrúti", unit: "kg" as const, expectedQuantity: 2 },
      { productName: "Ovos", category: "Laticínios & Ovos", unit: "un" as const, expectedQuantity: 12 },
    ],
  });

  assert.ok(result);
  assert.equal(result.id, "list-diet-1");
  assert.equal(createdList.name, "Compras da Semana - Família");
  assert.equal(createdMembers[0].role, "owner");
  assert.equal(createdItems.length, 2);
  assert.equal(createdItems[0].productName, "Banana prata");
});
