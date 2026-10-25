import { MessageAlert } from "@/components/app/MessageAlert";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queries, contentTemplateMutations } from "@/lib/api/queries";
import { contentTemplateKey } from "@/lib/api/content-template";
import type { RenderedContentTemplate } from "@/lib/api/content-template";
import type { SenderIdentityActor } from "@/lib/api/types";
import { useI18n } from "@/lib/i18n/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ErrorState, TableSkeleton } from "./States";

export function ReusableContentPicker({
  actor,
  tenantId,
  channel,
  locked,
  onUse,
}: {
  actor: SenderIdentityActor;
  tenantId: string | undefined;
  channel: "sms" | "email";
  locked: boolean;
  onUse: (content: RenderedContentTemplate) => void;
}) {
  const { t } = useI18n();
  const [page, setPage] = useState(1),
    [selected, setSelected] = useState("");
  const list = useQuery(
    queries.contentTemplates(
      actor,
      { page, pageSize: 20, channel, registryStatus: "ready" },
      tenantId,
    ),
  );
  return (
    <div className="space-y-3 rounded-md border p-3 md:col-span-2">
      <h3 className="font-medium">{t("content.choose")}</h3>
      <p className="text-caption">{t("content.copyNote")}</p>
      {list.isLoading ? (
        <TableSkeleton rows={2} />
      ) : list.isError ? (
        <ErrorState error={list.error} onRetry={() => void list.refetch()} />
      ) : (
        <>
          <Select value={selected} disabled={locked} onValueChange={setSelected}>
            <SelectTrigger aria-label={t("content.choose")}>
              <SelectValue placeholder={t("content.choose")} />
            </SelectTrigger>
            <SelectContent>
              {(list.data?.items ?? []).map((row) => (
                <SelectItem key={row.id} value={row.id}>
                  {row.templateKey} · {row.language} · {t("content.version")} {row.version}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Button
              variant="outline"
              disabled={locked || page <= 1 || list.isFetching}
              onClick={() => {
                setPage(page - 1);
                setSelected("");
              }}
            >
              {t("common.previous")}
            </Button>
            <Button
              variant="outline"
              disabled={locked || list.isFetching || page * 20 >= (list.data?.total ?? 0)}
              onClick={() => {
                setPage(page + 1);
                setSelected("");
              }}
            >
              {t("common.next")}
            </Button>
          </div>
        </>
      )}
      {selected && (
        <PickedVersion
          key={selected}
          actor={actor}
          tenantId={tenantId}
          id={selected}
          channel={channel}
          locked={locked}
          onUse={onUse}
        />
      )}
    </div>
  );
}
function PickedVersion({
  actor,
  tenantId,
  id,
  channel,
  locked,
  onUse,
}: {
  actor: SenderIdentityActor;
  tenantId: string | undefined;
  id: string;
  channel: "sms" | "email";
  locked: boolean;
  onUse: (content: RenderedContentTemplate) => void;
}) {
  const { t } = useI18n(),
    detail = useQuery(queries.contentTemplate(actor, id, tenantId));
  const [values, setValues] = useState<Record<string, string>>({});
  const render = useMutation({
    mutationKey: [...contentTemplateKey(actor, tenantId).slice(0, 5), id, "message-preview"],
    retry: false,
    gcTime: 0,
    mutationFn: () => contentTemplateMutations.render(actor, id, values, tenantId),
  });
  if (detail.isLoading) return <TableSkeleton rows={2} />;
  if (detail.isError)
    return <ErrorState error={detail.error} onRetry={() => void detail.refetch()} />;
  const row = detail.data;
  if (!row || row.channel !== channel || row.registryStatus !== "ready")
    return <MessageAlert>{t("content.failed")}</MessageAlert>;
  const eligible = row.parameters.every((name) => Object.hasOwn(values, name));
  const receipt =
    render.data?.channel === channel && render.data.version === row.version ? render.data : null;
  return (
    <div className="space-y-3">
      {row.parameters.map((name) => (
        <div key={name}>
          <Label htmlFor={`message-template-${name}`}>{name}</Label>
          <Input
            id={`message-template-${name}`}
            dir="auto"
            value={values[name] ?? ""}
            maxLength={1000}
            disabled={locked || render.isPending}
            onChange={(event) => {
              setValues((previous) => ({ ...previous, [name]: event.target.value }));
              render.reset();
            }}
          />
        </div>
      ))}
      <Button
        variant="outline"
        disabled={!eligible || locked || render.isPending}
        onClick={() => render.mutate()}
      >
        {t("content.render")}
      </Button>
      {render.isError && <MessageAlert>{t("content.failed")}</MessageAlert>}
      {receipt && (
        <>
          <p className="whitespace-pre-wrap" dir="auto">
            {receipt.subject}
          </p>
          <p
            className="max-h-48 overflow-y-auto whitespace-pre-wrap break-words border p-3"
            dir="auto"
          >
            {receipt.body}
          </p>
          <Button
            variant="outline"
            disabled={locked || render.isPending}
            onClick={() => onUse(receipt)}
          >
            {t("content.use")}
          </Button>
        </>
      )}
    </div>
  );
}
