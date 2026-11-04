export type DemoItem = { name: string; quantity: number; price: number; unit: string };
export const demoItems: DemoItem[];
export function demoTotal(items: DemoItem[]): number | null;
