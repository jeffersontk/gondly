import { readFile } from "node:fs/promises";
import { validateRecipeCatalog, importRecipeCatalog } from "./recipe-catalog.mjs";
const args = process.argv.slice(2);
const write = args.includes("--write");
const files = args.filter(arg => arg !== "--write");
if (files.length !== 1 || files[0].startsWith("--")) throw new Error("Uso: npm run recipes:import -- arquivo.json [--write]. Sem --write apenas valida.");
const raw = await readFile(files[0], "utf8");
if (Buffer.byteLength(raw) > 5_000_000) throw new Error("Catálogo excede 5 MB.");
const data = validateRecipeCatalog(JSON.parse(raw.replace(/^\uFEFF/, "")));
if (!write) console.log(`Catálogo válido: ${data.ingredients.length} ingredientes e ${data.recipes.length} receitas. Nenhum dado gravado.`);
else {
  if (!process.env.DATABASE_URL) throw new Error("Defina DATABASE_URL explicitamente para o banco de destino.");
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try { console.log(await importRecipeCatalog(prisma, data)); }
  finally { await prisma.$disconnect(); }
}
