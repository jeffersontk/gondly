import { useRef, type ChangeEvent } from "react";
import { FileText, FileUp, X } from "lucide-react";
import { AppButton, unitLabels } from "../../components";
import { ItemFeedback } from "../../components/ItemFeedback";
import type { ParsedShoppingList } from "../../lib/listImport";

export function ListImportPanel({
  preview,
  parsing,
  importing,
  error,
  onFile,
  onClear,
  onImport,
}: {
  preview: ParsedShoppingList | null;
  parsing: boolean;
  importing: boolean;
  error: string | null;
  onFile: (file: File) => Promise<void>;
  onClear: () => void;
  onImport: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void onFile(file);
  }

  return (
    <div className="rounded-xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-sky/12 text-sky">
          <FileText className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-black text-ink">Importar lista DOCX ou PDF</span>
          <span className="mt-1 block text-xs text-ink/55">Os títulos do arquivo viram setores e cada linha vira um item.</span>
        </span>
      </div>

      <input ref={inputRef} type="file" accept=".docx,.pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf" className="hidden" onChange={handleFileChange} />
      <AppButton className="mt-3" type="button" full variant="secondary" icon={<FileUp className="h-4 w-4" />} loading={parsing} loadingLabel="Lendo arquivo" onClick={() => inputRef.current?.click()}>
        Selecionar arquivo
      </AppButton>

      {error ? <div className="mt-3"><ItemFeedback tone="error" message={error} /></div> : null}

      {preview ? (
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-3 rounded-xl bg-mint/10 p-3">
            <span className="min-w-0">
              <span className="block truncate text-sm font-black text-ink">{preview.fileName}</span>
              <span className="block text-xs font-semibold text-ink/55">
                {preview.items.length} itens em {preview.sectors.length} setores
              </span>
            </span>
            <button type="button" className="grid h-8 w-8 flex-none place-items-center rounded-xl text-ink/45 hover:bg-white" onClick={onClear} aria-label="Remover arquivo">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
            {preview.sectors.map((sector) => {
              const items = preview.items.filter((item) => item.category === sector);
              return (
                <details key={sector} className="rounded-xl border border-line bg-paper px-3 py-2">
                  <summary className="cursor-pointer text-sm font-black text-ink">
                    {sector} <span className="text-xs text-ink/45">({items.length})</span>
                  </summary>
                  <ul className="mt-2 space-y-1 border-t border-line pt-2 text-xs text-ink/65">
                    {items.map((item) => (
                      <li key={`${sector}:${item.productName}`} className="flex justify-between gap-3">
                        <span>{item.productName}</span>
                        <span className="flex-none font-semibold">{item.expectedQuantity} {unitLabels[item.unit]}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              );
            })}
          </div>

          <AppButton type="button" full icon={<FileUp className="h-4 w-4" />} loading={importing} loadingLabel="Importando itens" onClick={onImport}>
            Importar {preview.items.length} itens
          </AppButton>
        </div>
      ) : null}
    </div>
  );
}
