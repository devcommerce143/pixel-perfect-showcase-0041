import assert from "node:assert/strict";
import { test } from "node:test";
import { crc32 } from "node:zlib";
import { buildSampleWorkbook } from "./sample-workbook.ts";

function unpack(data: Uint8Array): Map<string, string> {
  const decoder = new TextDecoder();
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const end = data.length - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  const count = view.getUint16(end + 10, true);
  let offset = view.getUint32(end + 16, true);
  const result = new Map<string, string>();
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    const size = view.getUint32(offset + 24, true);
    const nameSize = view.getUint16(offset + 28, true);
    const name = decoder.decode(data.subarray(offset + 46, offset + 46 + nameSize));
    const local = view.getUint32(offset + 42, true);
    assert.equal(view.getUint32(local, true), 0x04034b50);
    assert.equal(view.getUint16(local + 8, true), 0);
    const start = local + 30 + view.getUint16(local + 26, true);
    const bytes = data.subarray(start, start + size);
    assert.equal(crc32(bytes), view.getUint32(local + 14, true));
    assert.equal(view.getUint32(local + 14, true), view.getUint32(offset + 16, true));
    result.set(name, decoder.decode(bytes));
    offset += 46 + nameSize;
  }
  assert.equal(offset, end);
  return result;
}

test("produces a real XLSX archive with complete workbook, worksheet and style relationships", () => {
  const parts = unpack(
    buildSampleWorkbook([
      ["recipient", "body"],
      ["+966500000001", "Example"],
    ]),
  );
  assert.equal(parts.size, 6);
  assert.match(parts.get("[Content_Types].xml")!, /spreadsheetml\.sheet\.main\+xml/);
  assert.match(parts.get("xl/_rels/workbook.xml.rels")!, /worksheets\/sheet1\.xml/);
  assert.match(parts.get("xl/_rels/workbook.xml.rels")!, /styles\.xml/);
});

test("stores full phone digits, plus prefixes and leading zeros as text rather than numeric cells or formulas", () => {
  const values = ["966553308973", "+966500000001", "001234567890123456789"];
  const parts = unpack(
    buildSampleWorkbook([["recipient", "body"], ...values.map((phone) => [phone, "Example"])]),
  );
  const sheet = parts.get("xl/worksheets/sheet1.xml")!;
  for (const value of values) assert.ok(sheet.includes(`>${value}</t>`));
  assert.match(sheet, /<c r="A2" s="1" t="inlineStr">/);
  assert.match(sheet, /<col min="1" max="1"[^>]*style="1"/);
  assert.match(parts.get("xl/styles.xml")!, /numFmtId="49"/);
  assert.doesNotMatch(sheet, /<f>|<v>|E\+\d/);
});

test("preserves multilingual text and safely escapes template content without creating spreadsheet formulas", () => {
  const sheet = unpack(
    buildSampleWorkbook([
      ["recipient", "body"],
      ["+966500000001", '=1+1 & <hello> "quoted"\nمرحبا'],
    ]),
  ).get("xl/worksheets/sheet1.xml")!;
  assert.match(sheet, /=1\+1 &amp; &lt;hello&gt; &quot;quoted&quot;/);
  assert.ok(sheet.includes("مرحبا"));
  assert.doesNotMatch(sheet, /<f>/);
});
