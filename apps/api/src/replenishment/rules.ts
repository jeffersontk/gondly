export function isQuietHour(now: Date, start: number, end: number, timeZone: string) {
    const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
    return start === end ? false : start < end ? hour >= start && hour < end : hour >= start || hour < end;
}
export function nextOccurrence(due: Date, days: number, now: Date) {
    const period = days * 86400000;
    return new Date(due.getTime() + Math.max(1, Math.floor((now.getTime() - due.getTime()) / period) + 1) * period);
}
export function suggestionKey(item: {
    productName: string;
    brand?: string | null;
    brandNameSnapshot?: string | null;
    unit: string;
    packageSize?: number | null;
    packageUnit?: string | null;
}) {
    return JSON.stringify([item.productName.trim().toLocaleLowerCase("pt-BR"), (item.brandNameSnapshot ?? item.brand ?? "").trim().toLocaleLowerCase("pt-BR"), item.unit, item.packageSize ?? null, item.packageUnit ?? null]);
}
