/** Read a single-sheet XLSX into the existing CSV validation/acceptance pipeline.
 * Bounds apply before decompression; formulas and ambiguous multi-sheet imports are rejected.
 */
export async function bulkWorkbookCsv(buffer: ArrayBuffer): Promise<string> {
  const bytes = new Uint8Array(buffer),
    view = new DataView(buffer);
  function fail(): never {
    throw new Error("Invalid recipient workbook");
  }
  if (bytes.length > 2 * 1024 * 1024) fail();
  let end = bytes.length - 22;
  while (end >= Math.max(0, bytes.length - 65557) && view.getUint32(end, true) !== 0x06054b50)
    end--;
  if (end < 0 || view.getUint32(end, true) !== 0x06054b50) fail();
  const count = view.getUint16(end + 10, true);
  if (count > 200 || view.getUint16(end + 4, true) || view.getUint16(end + 6, true)) fail();
  let offset = view.getUint32(end + 16, true),
    total = 0;
  const files = new Map<string, { offset: number; size: number; packed: number; method: number }>();
  for (let i = 0; i < count; i++) {
    if (view.getUint32(offset, true) !== 0x02014b50 || view.getUint16(offset + 8, true) & 1) fail();
    const packed = view.getUint32(offset + 20, true),
      size = view.getUint32(offset + 24, true);
    total += size;
    if (total > 8 * 1024 * 1024) fail();
    const length = view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + length));
    if (files.has(name)) fail();
    files.set(name, {
      offset: view.getUint32(offset + 42, true),
      size,
      packed,
      method: view.getUint16(offset + 10, true),
    });
    offset += 46 + length + view.getUint16(offset + 30, true) + view.getUint16(offset + 32, true);
  }
  const xml = async (name: string) => {
    const entry = files.get(name);
    if (!entry) return fail();
    const at = entry.offset;
    if (view.getUint32(at, true) !== 0x04034b50) fail();
    const start = at + 30 + view.getUint16(at + 26, true) + view.getUint16(at + 28, true);
    if (start + entry.packed > bytes.length) fail();
    let data: Uint8Array = bytes.slice(start, start + entry.packed);
    if (entry.method === 8) {
      const reader = new Blob([data as Uint8Array<ArrayBuffer>])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw"))
        .getReader();
      const chunks: Uint8Array[] = [];
      let size = 0;
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        size += item.value.length;
        if (size > entry.size || size > 8 * 1024 * 1024) {
          await reader.cancel();
          fail();
        }
        chunks.push(item.value);
      }
      data = new Uint8Array(size);
      let position = 0;
      for (const chunk of chunks) {
        data.set(chunk, position);
        position += chunk.length;
      }
    } else if (entry.method !== 0) fail();
    if (data.length !== entry.size) fail();
    const text = new TextDecoder().decode(data);
    if (/<!DOCTYPE|<!ENTITY/i.test(text)) fail();
    const doc = new DOMParser().parseFromString(text, "application/xml");
    if (doc.querySelector("parsererror")) fail();
    return doc;
  };
  const workbook = await xml("xl/workbook.xml");
  const sheets = workbook.getElementsByTagName("sheet");
  if (sheets.length !== 1) fail();
  const id = sheets[0]!.getAttribute("r:id");
  const relationships = await xml("xl/_rels/workbook.xml.rels");
  const rel = Array.from(relationships.getElementsByTagName("Relationship")).find(
    (r) => r.getAttribute("Id") === id,
  );
  const target = rel?.getAttribute("Target") ?? "";
  if (rel?.getAttribute("TargetMode") === "External" || target.includes("..")) fail();
  const sheet = await xml(target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  if (sheet.getElementsByTagName("f").length) fail();
  const strings = files.has("xl/sharedStrings.xml")
    ? Array.from((await xml("xl/sharedStrings.xml")).getElementsByTagName("si")).map(
        (s) => s.textContent ?? "",
      )
    : [];
  const rows = Array.from(sheet.getElementsByTagName("row"));
  if (rows.length > 1001) fail();
  return rows
    .map((row) => {
      const values: string[] = [];
      for (const cell of Array.from(row.getElementsByTagName("c"))) {
        const ref = cell.getAttribute("r")?.match(/^([A-Z]+)\d+$/);
        if (!ref) return fail();
        const col = Array.from(ref[1]!).reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        if (col > 10 || values[col] !== undefined) fail();
        const type = cell.getAttribute("t"),
          raw = cell.getElementsByTagName("v")[0]?.textContent ?? "";
        let value =
          type === "inlineStr" ? (cell.getElementsByTagName("is")[0]?.textContent ?? "") : raw;
        if (type === "s") {
          const shared = strings[Number(raw)];
          if (shared === undefined) return fail();
          value = shared;
        }
        // Numeric cells cannot preserve a lost + prefix or leading zero; users must use Text cells.
        if (col === 0 && values.length === 0 && type !== "s" && type !== "inlineStr" && value)
          fail();
        values[col] = value;
      }
      return Array.from(
        { length: values.length },
        (_, i) => `"${(values[i] ?? "").replaceAll('"', '""')}"`,
      ).join(",");
    })
    .join("\n");
}
