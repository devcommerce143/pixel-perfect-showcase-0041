import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DataTable, ListPagination, type Column } from "./DataTable";
import { StatusBadge } from "./StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useI18n, type MessageKey } from "@/lib/i18n/i18n";
import {
  BULK_CSV_COLUMNS,
  manualRecipientPreview,
  type RecipientPreview,
  type RecipientPreviewRow,
} from "@/lib/api/bulk-recipient-preview";
import type { Channel } from "@/lib/api/types";

export function BulkRecipientTable({
  preview,
  channel,
  csv = false,
  onRemove,
}: {
  preview: RecipientPreview;
  channel: Channel;
  csv?: boolean;
  onRemove?: ((number: number) => void) | undefined;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<10 | 20 | 50>(10);
  const currentPage = Math.min(page, Math.max(1, Math.ceil(preview.rows.length / pageSize)));
  const columns: Column<RecipientPreviewRow>[] = [
    { id: "row", header: t("bulkHistory.row"), cell: (row) => row.number },
    ...(csv ? BULK_CSV_COLUMNS[channel] : ["recipient"]).map(
      (key): Column<RecipientPreviewRow> => ({
        id: key,
        header: t(`bulkPreview.column.${key}` as MessageKey),
        cell: (row) => (
          <div
            dir={key === "recipient" ? "ltr" : "auto"}
            className="max-h-28 min-w-40 max-w-sm overflow-auto whitespace-pre-wrap break-words"
          >
            {row.fields[key]}
          </div>
        ),
      }),
    ),
    {
      id: "status",
      header: t("common.status"),
      cell: (row) => (
        <div className="min-w-36 space-y-1">
          <StatusBadge status={row.errors.length ? "invalid" : "ready"} />
          {row.errors.map((error, index) => (
            <p key={`${error}:${index}`} className="text-xs text-danger">
              {t(`bulkPreview.error.${error}`)}
            </p>
          ))}
        </div>
      ),
    },
    ...(onRemove
      ? [
          {
            id: "remove",
            header: t("common.actions"),
            cell: (row: RecipientPreviewRow) => (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t("bulkPreview.remove", { row: row.number })}
                onClick={() => onRemove(row.number)}
              >
                <Trash2 className="size-4" aria-hidden="true" />
              </Button>
            ),
          },
        ]
      : []),
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium">{t("bulkPreview.title")}</h3>
        <p role="status" className="text-caption">
          {t("bulkPreview.counts", {
            total: preview.rows.length,
            invalid: preview.rows.filter((row) => row.errors.length).length,
          })}
        </p>
      </div>
      <p className="text-caption">{t("bulkPreview.localOnly")}</p>
      {preview.issue && (
        <div
          role="alert"
          className="rounded-md border border-danger/30 bg-danger-soft p-3 text-sm text-danger"
        >
          {t(`bulkPreview.issue.${preview.issue}`)}
          {preview.issue === "headers" && (
            <p className="mt-1 font-mono" dir="ltr">
              {BULK_CSV_COLUMNS[channel].join(",")}
            </p>
          )}
        </div>
      )}
      <div className="overflow-hidden rounded-md border">
        <DataTable
          columns={columns}
          rows={preview.rows.slice((currentPage - 1) * pageSize, currentPage * pageSize)}
          rowKey={(row) => String(row.number)}
        />
        <ListPagination
          page={currentPage}
          pageSize={pageSize}
          total={preview.rows.length}
          onPage={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      </div>
    </div>
  );
}

export function BulkManualRecipients({
  value,
  onChange,
  channel,
  locked,
}: {
  value: string;
  onChange: (value: string) => void;
  channel: Channel;
  locked: boolean;
}) {
  const { t } = useI18n();
  const [entry, setEntry] = useState("");
  const [pasted, setPasted] = useState("");
  const preview = useMemo(() => manualRecipientPreview(value, channel), [value, channel]);
  const append = (text: string) => {
    const next = [value, text].filter(Boolean).join("\n");
    onChange(next);
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-52 flex-1 space-y-2">
          <Label htmlFor="bulk-add-recipient">{t("bulkPreview.column.recipient")}</Label>
          <Input
            id="bulk-add-recipient"
            dir="ltr"
            maxLength={320}
            value={entry}
            disabled={locked}
            placeholder={t(
              channel === "email" ? "bulkPreview.emailPlaceholder" : "bulkPreview.phonePlaceholder",
            )}
            onChange={(event) => setEntry(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                if (!locked && entry.trim() && preview.rows.length < 1000) {
                  append(entry.trim());
                  setEntry("");
                }
              }
            }}
          />
        </div>
        <Button
          type="button"
          variant="outline"
          disabled={locked || !entry.trim() || preview.rows.length >= 1000}
          onClick={() => {
            append(entry.trim());
            setEntry("");
          }}
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("bulkPreview.add")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={locked || !value}
          onClick={() => {
            onChange("");
            setEntry("");
            setPasted("");
          }}
        >
          {t("bulkPreview.clear")}
        </Button>
      </div>
      <details className="rounded-md border p-3">
        <summary className="cursor-pointer text-sm font-medium">{t("bulkPreview.paste")}</summary>
        <div className="mt-3 space-y-2">
          <Textarea
            aria-label={t("bulkPreview.paste")}
            dir="ltr"
            maxLength={321000}
            value={pasted}
            disabled={locked}
            onChange={(event) => setPasted(event.target.value)}
          />
          <p className="text-caption">{t("bulkPreview.pasteHelp")}</p>
          <Button
            type="button"
            variant="outline"
            disabled={locked || !pasted.trim()}
            onClick={() => {
              append(pasted);
              setPasted("");
            }}
          >
            {t("bulkPreview.addList")}
          </Button>
        </div>
      </details>
      <BulkRecipientTable
        preview={preview}
        channel={channel}
        onRemove={
          locked
            ? undefined
            : (number) =>
                onChange(
                  preview.rows
                    .filter((row) => row.number !== number)
                    .map((row) => row.fields["recipient"])
                    .join("\n"),
                )
        }
      />
    </div>
  );
}
