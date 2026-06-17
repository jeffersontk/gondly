export function formatBRL(value: number | string | null | undefined) {
  const numeric = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(numeric ?? 0);
}

export function parseMoneyInput(value: string) {
  return Number(value.replace(/\./g, "").replace(",", "."));
}
