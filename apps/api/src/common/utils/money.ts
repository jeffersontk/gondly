export type NumericLike = number | { toString(): string } | null | undefined;

export function toNumber(value: NumericLike): number {
  if (value === null || value === undefined) {
    return 0;
  }

  if (typeof value === "number") {
    return value;
  }

  return Number(value.toString());
}

export function toOptionalNumber(value: NumericLike): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  return toNumber(value);
}
