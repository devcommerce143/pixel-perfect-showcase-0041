import type { Channel } from "./types.ts";

export const BULK_CSV_COLUMNS = {
  sms: ["recipient", "body"],
  email: ["recipient", "subject", "body"],
  whatsapp: ["recipient", "template_key", "language", "variables"],
} as const;
export type PreviewError = "recipient" | "content" | "variables" | "template" | "shared";
export interface RecipientPreviewRow {
  number: number;
  fields: Record<string, string>;
  errors: PreviewError[];
}
export interface RecipientPreview {
  rows: RecipientPreviewRow[];
  issue: "headers" | "malformed" | "limit" | null;
}

export function validBulkRecipient(value: string, channel: Channel) {
  const recipient = value.trim();
  return (
    recipient.length <= 320 &&
    (channel === "email"
      ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)
      : /^\+[1-9]\d{7,14}$/.test(recipient))
  );
}

export function manualRecipientPreview(value: string, channel: Channel): RecipientPreview {
  const recipients = value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  return {
    issue: recipients.length > 1000 ? "limit" : null,
    rows: recipients.map((recipient, index) => ({
      number: index + 1,
      fields: { recipient },
      errors: validBulkRecipient(recipient, channel) ? [] : ["recipient"],
    })),
  };
}

/** Local syntax preview only. The backend remains authoritative for acceptance. */
export function csvRecipientPreview(
  csv: string,
  channel: Channel,
  mode: "SHARED" | "PERSONALIZED",
): RecipientPreview {
  const fail = (issue: RecipientPreview["issue"]): RecipientPreview => ({ rows: [], issue });
  if (new TextEncoder().encode(csv).byteLength > 2 * 1024 * 1024) return fail("limit");
  if (!csv || csv.includes("\0")) return fail("malformed");
  let table: string[][];
  try {
    table = parseCsv(csv.replace(/^\uFEFF/, ""));
  } catch (error) {
    return fail(error instanceof RangeError ? "limit" : "malformed");
  }
  const header = table.shift();
  const expected: readonly string[] = BULK_CSV_COLUMNS[channel];
  if (
    !header ||
    header.length !== expected.length ||
    new Set(header).size !== expected.length ||
    !expected.every((key) => header.includes(key))
  )
    return fail("headers");
  if (!table.length) return fail("malformed");
  if (table.length > 1000) return fail("limit");
  if (table.some((row) => row.length !== header.length)) return fail("malformed");
  const rows = table.map((cells, index): RecipientPreviewRow => {
    const fields = Object.fromEntries(header.map((key, position) => [key, cells[position] ?? ""]));
    const errors: PreviewError[] = [];
    if (!validBulkRecipient(fields["recipient"] ?? "", channel)) errors.push("recipient");
    const filled = (key: string, max: number) =>
      !!fields[key]?.trim() && fields[key]!.length <= max;
    if (channel === "sms" && !filled("body", 1600)) errors.push("content");
    if (channel === "email" && (!filled("subject", 200) || !filled("body", 20000)))
      errors.push("content");
    if (channel === "whatsapp") {
      if (
        !/^[a-z0-9_]{1,64}$/.test(fields["template_key"] ?? "") ||
        !/^[a-z]{2}(?:_[A-Z]{2})?$/.test(fields["language"] ?? "")
      )
        errors.push("template");
      try {
        const variables: unknown = JSON.parse(fields["variables"]?.trim() || "{}");
        if (
          !variables ||
          typeof variables !== "object" ||
          Array.isArray(variables) ||
          Object.keys(variables).length > 20 ||
          !Object.entries(variables).every(
            ([key, value]) =>
              /^[A-Za-z][A-Za-z0-9_]{0,31}$/.test(key) &&
              typeof value === "string" &&
              value.length <= 1000,
          )
        )
          errors.push("variables");
      } catch {
        errors.push("variables");
      }
    }
    return { number: index + 1, fields, errors };
  });
  const first = rows[0]!;
  for (const row of rows) {
    if (
      channel === "whatsapp" &&
      (row.fields["template_key"] !== first.fields["template_key"] ||
        row.fields["language"] !== first.fields["language"])
    )
      row.errors.push("template");
    if (mode === "SHARED") {
      const keys = expected.filter((key) => key !== "recipient");
      const same = keys.every((key) => {
        if (key !== "variables") return row.fields[key] === first.fields[key];
        try {
          const canonical = (text: string) =>
            JSON.stringify(
              Object.entries(JSON.parse(text.trim() || "{}") as Record<string, string>).sort(
                ([a], [b]) => a.localeCompare(b),
              ),
            );
          return canonical(row.fields[key] ?? "") === canonical(first.fields[key] ?? "");
        } catch {
          return false;
        }
      });
      if (!same) row.errors.push("shared");
    }
  }
  return { rows, issue: null };
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false,
    closed = false;
  for (let i = 0; i < csv.length; i++) {
    const char = csv[i]!;
    if (quoted) {
      if (char === '"') {
        if (csv[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else cell += char;
      continue;
    }
    if (closed && char !== "," && char !== "\r" && char !== "\n") throw new Error("Malformed CSV");
    if (char === '"') {
      if (cell || closed) throw new Error("Malformed CSV");
      quoted = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
      closed = false;
    } else if (char === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      closed = false;
      if (rows.length > 1002) throw new RangeError("Too many rows");
    } else if (char !== "\r") cell += char;
  }
  if (quoted) throw new Error("Malformed CSV");
  if (cell || row.length || closed) {
    row.push(cell);
    rows.push(row);
  }
  while (rows.at(-1)?.length === 1 && rows.at(-1)?.[0] === "") rows.pop();
  return rows;
}
