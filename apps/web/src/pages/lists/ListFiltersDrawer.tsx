import { useEffect } from "react";
import { Filter, SlidersHorizontal, Tags, X } from "lucide-react";
import { AppButton, SearchBar } from "../../components";
import type { ListSortFilter, ListStatusFilter } from "../shared";

export function ListFiltersDrawer({
  open,
  sectors,
  itemSearch,
  sectorFilter,
  statusFilter,
  sortFilter,
  activeFiltersCount,
  onClose,
  onSearchChange,
  onSectorChange,
  onStatusChange,
  onSortChange,
  onClear,
}: {
  open: boolean;
  sectors: string[];
  itemSearch: string;
  sectorFilter: string;
  statusFilter: ListStatusFilter;
  sortFilter: ListSortFilter;
  activeFiltersCount: number;
  onClose: () => void;
  onSearchChange: (value: string) => void;
  onSectorChange: (value: string) => void;
  onStatusChange: (value: ListStatusFilter) => void;
  onSortChange: (value: ListSortFilter) => void;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-labelledby="list-filters-title">
      <button type="button" className="absolute inset-0 bg-ink/45 backdrop-blur-[2px]" onClick={onClose} aria-label="Fechar filtros" />
      <div className="absolute inset-x-0 bottom-0 mx-auto w-full max-w-xl rounded-t-3xl border-x border-t border-line bg-white px-4 pb-[calc(20px+env(safe-area-inset-bottom))] pt-3 shadow-lift">
        <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-line" />
        <div className="flex items-center justify-between gap-3">
          <div>
            <p id="list-filters-title" className="text-lg font-bold tracking-tight text-ink">Filtros da lista</p>
            <p className="text-xs font-medium text-ink/60">Busque, filtre por setor/status e defina a ordem.</p>
          </div>
          <button type="button" className="grid h-10 w-10 flex-none place-items-center rounded-xl border border-line bg-white text-ink shadow-sm" onClick={onClose} aria-label="Fechar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-3">
          <SearchBar placeholder="Buscar produto, marca ou setor" value={itemSearch} onChange={(event) => onSearchChange(event.target.value)} />
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink/60"><Tags className="h-3.5 w-3.5" /> Setor</span>
            <select className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint" value={sectorFilter} onChange={(event) => onSectorChange(event.target.value)}>
              <option value="all">Todos</option>
              {sectors.map((sector) => <option key={sector} value={sector}>{sector}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink/60"><Filter className="h-3.5 w-3.5" /> Status</span>
            <select className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint" value={statusFilter} onChange={(event) => onStatusChange(event.target.value as ListStatusFilter)}>
              <option value="all">Todos</option>
              <option value="pending">Não tenho em casa</option>
              <option value="at_home">Tenho em casa</option>
              <option value="not_needed">Não precisa esse mês</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 flex items-center gap-1 text-xs font-semibold text-ink/60"><SlidersHorizontal className="h-3.5 w-3.5" /> Ordenação</span>
            <select className="h-11 w-full rounded-xl border border-line bg-white px-3 text-sm text-ink outline-none focus:border-mint" value={sortFilter} onChange={(event) => onSortChange(event.target.value as ListSortFilter)}>
              <option value="default">Padrão da lista</option>
              <option value="important">Importantes primeiro</option>
              <option value="name_asc">Nome A-Z</option>
              <option value="name_desc">Nome Z-A</option>
              <option value="sector">Setor</option>
              <option value="status">Status</option>
            </select>
          </label>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_1.25fr] gap-2">
          <AppButton variant="secondary" onClick={onClear} disabled={!activeFiltersCount}>
            Limpar
          </AppButton>
          <AppButton onClick={onClose}>
            Aplicar filtros
          </AppButton>
        </div>
      </div>
    </div>
  );
}
