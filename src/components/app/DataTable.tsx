import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/i18n";
import { formatNumber } from "@/lib/format";
import { cn } from "@/lib/utils";
import { EmptyState, TableSkeleton } from "./States";

export interface Column<T> {
  id: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

export function DataTable<T>({ columns, rows, rowKey, onRowClick, loading, dense }: {
  columns: Column<T>[];
  rows: T[] | undefined;
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  dense?: boolean;
}) {
  const { t } = useI18n();
  if (loading && !rows) return <TableSkeleton />;
  if (!rows?.length) return <EmptyState icon={SearchX} title={t("common.noResults")} body={t("common.noResultsHint")} />;
  return (
    <div className={cn("overflow-x-auto", loading && "opacity-60 transition-opacity")}>
      <table className="w-full text-table">
        <thead className="bg-surface-subtle">
          <tr className="border-b">
            {columns.map((c) => (
              <th key={c.id} scope="col" className={cn("px-4 py-2 text-start text-label whitespace-nowrap", c.className)}>{c.header}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn("transition-colors", onRowClick && "cursor-pointer hover:bg-accent/50")}
            >
              {columns.map((c) => (
                <td key={c.id} className={cn("px-4 align-middle", dense ? "py-2" : "py-2.5", c.className)}>{c.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function TableToolbar({ search, onSearch, placeholder, children }: {
  search: string; onSearch: (v: string) => void; placeholder: string; children?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center">
      <div className="relative sm:w-80">
        <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input value={search} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="h-8 ps-8" />
      </div>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function TablePagination({ page, pageSize, total, onPage }: { page: number; pageSize: number; total: number; onPage: (p: number) => void }) {
  const { t, locale } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <div className="flex items-center justify-between border-t px-4 py-2.5">
      <span className="text-caption">{t("common.results", { count: formatNumber(total, locale) })}</span>
      <div className="flex items-center gap-2">
        <span className="text-caption">{t("common.page", { page, pages })}</span>
        <Button variant="outline" size="icon" className="size-7" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label={t("common.previous")}>
          <ChevronLeft className="size-4 rtl:rotate-180" />
        </Button>
        <Button variant="outline" size="icon" className="size-7" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label={t("common.next")}>
          <ChevronRight className="size-4 rtl:rotate-180" />
        </Button>
      </div>
    </div>
  );
}
