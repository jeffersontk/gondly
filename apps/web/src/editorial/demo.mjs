export const demoItems = [
  { name: "Arroz", quantity: 2, price: 6, unit: "pacote de 1 kg" },
  { name: "Feijão", quantity: 2, price: 8, unit: "pacote de 1 kg" },
  { name: "Óleo", quantity: 1, price: 7, unit: "litro" },
  { name: "Leite", quantity: 2, price: 5, unit: "litro" },
  { name: "Tomate", quantity: 1.5, price: 8, unit: "kg" },
];
export function demoTotal(items) {
  if (items.some(item => !Number.isFinite(item.quantity) || item.quantity < 0 || !Number.isFinite(item.price) || item.price < 0)) return null;
  return items.reduce((sum, item) => sum + Math.round(item.quantity * item.price * 100), 0) / 100;
}
