import { formatBRL as formatSharedBRL, parseMoneyToNumber } from "@gondly/utils";

export function formatBRL(value: number | string | null | undefined) {
  return formatSharedBRL(value);
}

export function parseMoneyInput(value: string) {
  return parseMoneyToNumber(value);
}
