import type { Unit } from "@gondly/types";

const MAX_IMPORT_FILE_SIZE = 15 * 1024 * 1024;
const MAX_IMPORT_ITEMS = 500;
const UNCATEGORIZED_SECTOR = "Sem setor";

const sectorAliases = new Map<string, string>([
  ["mercearia", "Mercearia"],
  ["condimento", "Condimentos"],
  ["condimentos", "Condimentos"],
  ["molhos e condimentos", "Condimentos"],
  ["laticinios", "Laticínios & Frios"],
  ["frios", "Laticínios & Frios"],
  ["laticinios e frios", "Laticínios & Frios"],
  ["doces", "Doces"],
  ["proteina", "Proteínas"],
  ["proteinas", "Proteínas"],
  ["carnes", "Proteínas"],
  ["acougue", "Proteínas"],
  ["hortifruti", "Sacolão"],
  ["hortifrutigranjeiros", "Sacolão"],
  ["frutas legumes e verduras", "Sacolão"],
  ["sacolao", "Sacolão"],
  ["descartaveis", "Descartáveis"],
  ["higiene", "Higiene pessoal"],
  ["higiene pessoal", "Higiene pessoal"],
  ["limpeza", "Materiais de limpeza"],
  ["material de limpeza", "Materiais de limpeza"],
  ["materiais de limpeza", "Materiais de limpeza"],
  ["bebes", "Bebês"],
  ["itens para bebes", "Bebês"],
  ["bebidas", "Bebidas"],
  ["padaria", "Padaria"],
  ["congelados", "Congelados"],
  ["pet", "Pet"],
  ["outros", "Outros"],
  ["sem setor", UNCATEGORIZED_SECTOR],
]);

const unitAliases: Record<string, Unit> = {
  un: "un",
  und: "un",
  unidade: "un",
  unidades: "un",
  kg: "kg",
  quilo: "kg",
  quilos: "kg",
  g: "g",
  grama: "g",
  gramas: "g",
  l: "l",
  litro: "l",
  litros: "l",
  ml: "ml",
  pacote: "pacote",
  pacotes: "pacote",
  pct: "pacote",
  caixa: "caixa",
  caixas: "caixa",
  cx: "caixa",
};

export type ImportedListItem = {
  productName: string;
  category: string;
  expectedQuantity: number;
  unit: Unit;
};

export type ParsedShoppingList = {
  fileName: string;
  items: ImportedListItem[];
  sectors: string[];
};

export async function parseShoppingListFile(file: File): Promise<ParsedShoppingList> {
  if (file.size > MAX_IMPORT_FILE_SIZE) {
    throw new Error("O arquivo deve ter no máximo 15 MB.");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const buffer = await file.arrayBuffer();
  let text: string;

  if (extension === "docx") {
    text = await extractDocxText(buffer);
  } else if (extension === "pdf") {
    text = await extractPdfText(buffer);
  } else {
    throw new Error("Formato não suportado. Selecione um arquivo DOCX ou PDF.");
  }

  const items = parseShoppingListText(text);
  if (!items.length) {
    throw new Error("Nenhum item de compra foi identificado no arquivo.");
  }
  if (items.length > MAX_IMPORT_ITEMS) {
    throw new Error(`O arquivo possui mais de ${MAX_IMPORT_ITEMS} itens. Divida a lista antes de importar.`);
  }

  return {
    fileName: file.name,
    items,
    sectors: [...new Set(items.map((item) => item.category))],
  };
}

export function parseShoppingListText(text: string): ImportedListItem[] {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const items: ImportedListItem[] = [];
  const seen = new Set<string>();
  let currentSector = UNCATEGORIZED_SECTOR;

  for (const line of lines) {
    if (isDocumentTitle(line)) continue;

    const sector = sectorFromHeading(line);
    if (sector) {
      currentSector = sector;
      continue;
    }

    const item = parseItemLine(line, currentSector);
    if (item.productName.length < 2) continue;

    const key = `${normalizeText(item.category)}:${normalizeText(item.productName)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }

  return items;
}

function cleanLine(value: string) {
  return value
    .replace(/^[\s\u00a0]*(?:[-–—•▪◦*]|\[[ xX]?\]|☐|☑|✓)\s*/, "")
    .replace(/^\s*\d+[.)]\s+/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isDocumentTitle(line: string) {
  const normalized = normalizeText(line);
  return normalized === "lista de compras" || normalized === "lista compras" || normalized === "compras";
}

function sectorFromHeading(line: string) {
  const withoutColon = line.replace(/:\s*$/, "").trim();
  const normalized = normalizeText(withoutColon.replace(/&/g, " e "));
  const knownSector = sectorAliases.get(normalized);
  if (knownSector) return knownSector;

  const letters = withoutColon.replace(/[^A-Za-zÀ-ÿ]/g, "");
  const isUppercase =
    Boolean(letters) &&
    withoutColon === withoutColon.toLocaleUpperCase("pt-BR") &&
    withoutColon.split(/\s+/).length <= 5 &&
    withoutColon.length <= 50;

  if (line.endsWith(":") || isUppercase) {
    return titleCase(withoutColon);
  }

  return null;
}

function parseItemLine(line: string, category: string): ImportedListItem {
  const quantityMatch = line.match(
    /^(\d+(?:[.,]\d+)?)\s*(?:x\s*)?(?:(un|und|unidades?|kg|quilos?|g|gramas?|l|litros?|ml|pacotes?|pct|caixas?|cx)\s+)?(?:de\s+)?(.+)$/i,
  );

  if (!quantityMatch) {
    return { productName: line, category, expectedQuantity: 1, unit: "un" };
  }

  const quantity = Number(quantityMatch[1].replace(",", "."));
  const unit = unitAliases[normalizeText(quantityMatch[2] ?? "un")] ?? "un";
  const productName = quantityMatch[3].trim();

  return {
    productName,
    category,
    expectedQuantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
    unit,
  };
}

async function extractDocxText(buffer: ArrayBuffer) {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value;
}

async function extractPdfText(buffer: ArrayBuffer) {
  const [pdfjs, workerModule] = await Promise.all([
    import("pdfjs-dist"),
    import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
  ]);
  pdfjs.GlobalWorkerOptions.workerSrc = workerModule.default;

  const document = await pdfjs.getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: string[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(pdfItemsToLines(content.items as unknown[]).join("\n"));
  }

  return pages.join("\n");
}

function pdfItemsToLines(items: unknown[]) {
  const rows: Array<{ y: number; fragments: Array<{ x: number; text: string }> }> = [];

  for (const value of items) {
    if (!isPdfTextItem(value) || !value.str.trim()) continue;
    const x = value.transform[4] ?? 0;
    const y = value.transform[5] ?? 0;
    let row = rows.find((entry) => Math.abs(entry.y - y) <= 2);
    if (!row) {
      row = { y, fragments: [] };
      rows.push(row);
    }
    row.fragments.push({ x, text: value.str.trim() });
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.fragments
        .sort((a, b) => a.x - b.x)
        .map((fragment) => fragment.text)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

function isPdfTextItem(value: unknown): value is { str: string; transform: number[] } {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { str?: unknown; transform?: unknown };
  return typeof candidate.str === "string" && Array.isArray(candidate.transform);
}

function normalizeText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function titleCase(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(/(^|\s)\p{L}/gu, (letter) => letter.toLocaleUpperCase("pt-BR"));
}
