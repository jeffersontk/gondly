import { structureFoodMeal, type FoodMeal, type FoodOption } from "@gondly/utils";
export type { FoodMeal, FoodOption, ImportedFoodPlan } from "@gondly/utils";
const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const mealPattern = /^(?:(\d{1,2})\s*[:h]\s*(\d{2})\s*[-–—:]?\s*)?(cafe da manha|desjejum|almoco|lanche(?: da (?:manha|tarde|noite))?|jantar|ceia)(?:\s*[-–—:]?\s*(\d{1,2})\s*[:h]\s*(\d{2}))?\s*:?$/;

export function parseFoodPlanText(text: string): FoodMeal[] {
  if (!text.trim()) throw new Error("Não foi encontrado texto no arquivo. Para PDF digitalizado, cole ou digite o conteúdo do plano.");
  if (text.length > 150000) throw new Error("O plano deve conter até 150 mil caracteres.");
  const sections: { name: string; time: string; lines: string[] }[] = [];
  let current: typeof sections[number] | undefined;
  for (const raw of text.replace(/\r/g, "").split(/[\n\f]/)) {
    const line = raw.replace(/\s+/g, " ").trim();
    if (!line) continue;
    const key = normalize(line);
    const heading = key.match(mealPattern);
    if (heading) {
      const hour = heading[1] ?? heading[4], minute = heading[2] ?? heading[5];
      current = { name: line.replace(/\d{1,2}\s*[:h]\s*\d{2}/g, "").replace(/^\s*[-–—:]|[-–—:]\s*$/g, "").trim(), time: hour && Number(hour) <= 23 && Number(minute) <= 59 ? `${hour.padStart(2, "0")}:${minute}` : "", lines: [] };
      sections.push(current);
      continue;
    }
    if (/^(orientacoes|recomendacoes|substituicoes|lista de substituicao|tabela de|observacoes gerais)/.test(key)) { current = undefined; continue; }
    // Exclude common document headers/footers; the editable review remains mandatory.
    if (/@|\bcrn\b|https?:|www\.|^(?:nome|data|paciente|nutricionista)\s*:|^plano alimentar\b|^pagina\s+\d|^\d+\s*\/\s*\d+$/.test(key)) continue;
    if (current) current.lines.push(line);
  }
  const meals = sections.filter(section => section.lines.length).map((section, mealIndex) => {
    const options: FoodOption[] = [];
    let notes = "";
    const prefix: string[] = [];
    for (const line of section.lines) {
      const option = normalize(line).match(/^(?:[-•]\s*)?opcao\s*\d+\s*[-–—:.]?\s*/);
      if (option) {
        if (!options.length && prefix.length) {
          const content = prefix.join("\n");
          if (/\d\s*(?:g|ml|kg|un|fatia|ovo|lata)|macarrao|arroz|pao/i.test(normalize(content))) options.push({ id: `meal-${mealIndex}-option-0`, title: "Opção 1", text: content });
          else notes = content;
        }
        const content = line.slice(option[0].length).trim();
        options.push({ id: `meal-${mealIndex}-option-${options.length + 1}`, title: content.split(":")[0].slice(0, 120) || `Opção ${options.length + 1}`, text: content });
      } else if (/^\+\s/.test(line) && options.length) {
        notes += `${notes ? "\n" : ""}Conferir a quais opções se aplica: ${line}`;
      } else if (options.length) options[options.length - 1].text += `${options[options.length - 1].text ? "\n" : ""}${line}`;
      else prefix.push(line);
    }
    if (!options.length) options.push({ id: `meal-${mealIndex}-option-1`, title: "Montagem prevista no plano", text: prefix.join("\n") });
    return { id: `meal-${mealIndex}`, name: section.name, time: section.time, notes, options: options.map(option => ({ ...option, text: option.text || option.title })) };
  });
  if (!meals.length) throw new Error("Não identifiquei refeições. Use títulos como ‘09:00 Café da manhã’, ‘Almoço’ e ‘Jantar’, ou adicione as refeições manualmente.");
  if (meals.length > 12 || meals.some(meal => meal.options.length > 15)) throw new Error("O plano excedeu o limite de 12 refeições ou 15 opções por refeição. Revise o texto antes de importar.");
  return meals.map(structureFoodMeal);
}

export async function readFoodPlanFile(file: File) {
  if (file.size > 10 * 1024 * 1024) throw new Error("O arquivo deve ter até 10 MB.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "txt") return file.text();
  const buffer = await file.arrayBuffer();
  if (extension === "pdf") { const { extractPdfText } = await import("../../lib/listImport"); return extractPdfText(buffer, 30); }
  if (extension === "docx") { const mammoth = await import("mammoth"); return (await mammoth.extractRawText({ arrayBuffer: buffer })).value; }
  throw new Error("Selecione um arquivo PDF, DOCX ou TXT.");
}
