import { crc32, deflateRawSync } from "node:zlib";

/** Excel-style compressed fixtures derived from the real downloaded sample. */
export function workbookFixture(sample, kind) {
  const files = new Map();
  let at = 0;
  while (sample.readUInt32LE(at) === 0x04034b50) {
    const length = sample.readUInt16LE(at + 26);
    const start = at + 30 + length + sample.readUInt16LE(at + 28);
    const size = sample.readUInt32LE(at + 18);
    files.set(
      sample.toString("utf8", at + 30, at + 30 + length),
      sample.toString("utf8", start, start + size),
    );
    at = start + size;
  }
  const sheet = "xl/worksheets/sheet1.xml";
  const cell =
    kind === "numeric"
      ? '<c r="A2"><v>966500000001</v></c>'
      : kind === "formula"
        ? '<c r="A2" t="str"><f>"+966500000001"</f><v>+966500000001</v></c>'
        : '<c r="A2" t="s"><v>0</v></c>';
  files.set(sheet, files.get(sheet).replace(/<c r="A2"[^>]*>.*?<\/c>/s, cell));
  files.set(
    "xl/sharedStrings.xml",
    '<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><si><t>+966500000001</t></si></sst>',
  );
  const locals = [],
    central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const filename = Buffer.from(name),
      data = Buffer.from(text),
      packed = deflateRawSync(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, packed);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50);
    header.writeUInt16LE(20, 4);
    local.copy(header, 6, 4, 28);
    header.writeUInt32LE(offset, 42);
    central.push(header, filename);
    offset += local.length + filename.length + packed.length;
  }
  const directory = Buffer.concat(central),
    end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
