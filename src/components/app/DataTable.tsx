import type { ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
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
  onRowClick?: ((row: T) => void) | undefined;
  loading?: boolean | undefined;
  dense?: boolean | undefined;
}) {
  const { t, dir } = useI18n();
  if (loading && !rows) return <TableSkeleton />;
  if (!rows?.length) return <EmptyState icon={SearchX} title={t("common.noResults")} body={t("common.noResultsHint")} />;
  return (
    <div dir="ltr" className={cn("overflow-x-auto", loading && "opacity-60 transition-opacity")}>
      <table dir={dir} className="w-full text-table">
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

export function SortableHeader({ label, field, sortBy, sortDirection, onSort }: {
  label: ReactNode;
  field: string;
  sortBy: string;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
}) {
  const { t } = useI18n();
  const active = sortBy === field;
  const Icon = active ? sortDirection === "asc" ? ArrowUp : ArrowDown : ArrowUpDown;
  const textLabel = typeof label === "string" ? label : "";
  return (
    <button type="button" onClick={() => onSort(field)} aria-pressed={active} aria-label={active ? t("table.sortedBy", { column: textLabel, direction: t(sortDirection === "asc" ? "table.ascending" : "table.descending") }) : t("table.sortBy", { column: textLabel })} className="inline-flex items-center gap-1.5 whitespace-nowrap hover:text-foreground">
      {label}<Icon className="size-3.5" aria-hidden />
    </button>
  );
}

export function ListPagination({ page, pageSize, total, onPage, onPageSizeChange }: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSizeChange: (pageSize: 10 | 20 | 50) => void;
}) {
  const { t, locale } = useI18n();
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(page, 1), pageCount);
  const start = total ? (currentPage - 1) * pageSize + 1 : 0;
  const end = Math.min(currentPage * pageSize, total);
  const pages: (number | "startEllipsis" | "endEllipsis")[] = pageCount <= 7
    ? Array.from({ length: pageCount }, (_, index) => index + 1)
    : [1, ...(currentPage > 4 ? ["startEllipsis" as const] : []), ...Array.from({ length: 3 }, (_, index) => currentPage + index - 1).filter((value) => value > 1 && value < pageCount), ...(currentPage < pageCount - 3 ? ["endEllipsis" as const] : []), pageCount];
  return (
    <div className="flex flex-col gap-3 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-caption">{t("table.showingRange", { start: formatNumber(start, locale), end: formatNumber(end, locale), total: formatNumber(total, locale) })}</p>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-caption">
          {t("table.rowsPerPage")}
          <Select value={String(pageSize)} onValueChange={(value) => onPageSizeChange(Number(value) as 10 | 20 | 50)}>
            <SelectTrigger className="h-8 w-20" aria-label={t("table.rowsPerPage")}><SelectValue /></SelectTrigger>
            <SelectContent>{([10, 20, 50] as const).map((size) => <SelectItem key={size} value={String(size)}>{size}</SelectItem>)}</SelectContent>
          </Select>
        </label>
        {total > pageSize && <nav aria-label={t("table.pagination")} className="flex flex-wrap items-center gap-1">
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)}>
            <ChevronLeft className="size-4 rtl:rotate-180" />{t("common.previous")}
          </Button>
          {pages.map((pageNumber) => typeof pageNumber === "number"
            ? <Button key={pageNumber} variant={pageNumber === currentPage ? "outline" : "ghost"} size="icon" className="size-8" aria-label={t("table.goToPage", { page: pageNumber })} aria-current={pageNumber === currentPage ? "page" : undefined} onClick={() => onPage(pageNumber)}>{formatNumber(pageNumber, locale)}</Button>
            : <span key={pageNumber} className="px-1 text-muted-foreground" aria-hidden>…</span>)}
          <Button variant="outline" size="sm" className="h-8 gap-1 px-2" disabled={currentPage >= pageCount} onClick={() => onPage(currentPage + 1)}>
            {t("common.next")}<ChevronRight className="size-4 rtl:rotate-180" />
          </Button>
        </nav>}
      </div>
    </div>
  );
}
