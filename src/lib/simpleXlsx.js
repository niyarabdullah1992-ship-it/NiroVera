const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let crc = i;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc & 1) ? (0xEDB88320 ^ (crc >>> 1)) : (crc >>> 1);
    table[i] = crc >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function u16(value) {
  const out = new Uint8Array(2);
  new DataView(out.buffer).setUint16(0, value, true);
  return out;
}

function u32(value) {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function concat(parts) {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  parts.forEach((part) => {
    out.set(part, offset);
    offset += part.length;
  });
  return out;
}

function zipStore(files) {
  const encoder = new TextEncoder();
  const locals = [];
  const centrals = [];
  let offset = 0;
  files.forEach((file) => {
    const name = encoder.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0),
      name, data,
    ]);
    const central = concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(data.length), u32(data.length), u16(name.length), u16(0), u16(0),
      u16(0), u16(0), u32(0), u32(offset), name,
    ]);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  });
  const center = concat(centrals);
  const end = concat([
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(center.length), u32(offset), u16(0),
  ]);
  return concat([...locals, center, end]);
}

function xmlEsc(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function colLetter(index) {
  let n = index + 1;
  let out = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sheetXml(rows, extra = "", options = {}) {
  const body = (rows || []).map((row, rowIndex) => {
    const cells = (row || []).map((value, colIndex) => {
      const ref = `${colLetter(colIndex)}${rowIndex + 1}`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join("");
  const pane = options.freeze
    ? `<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>`
    : "";
  const views = `<sheetViews><sheetView workbookViewId="0"${options.rtl ? ' rightToLeft="1"' : ""}>${pane}</sheetView></sheetViews>`;
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`
    + `${views}<sheetData>${body}</sheetData>${extra}</worksheet>`;
}

function workbookXml(sheetNames, definedNames = []) {
  const sheets = sheetNames.map((name, index) =>
    `<sheet name="${xmlEsc(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join("");
  const names = (definedNames || []).filter((item) => item?.name && item?.ref).map((item) =>
    `<definedName name="${xmlEsc(item.name)}">${xmlEsc(item.ref)}</definedName>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">`
    + `<sheets>${sheets}</sheets>`
    + `${names ? `<definedNames>${names}</definedNames>` : ""}`
    + `</workbook>`;
}

function workbookRels(count) {
  const rels = Array.from({ length: count }, (_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}</Relationships>`;
}

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>`
  + `</Relationships>`;

function contentTypes(count) {
  const overrides = Array.from({ length: count }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
    + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
    + `<Default Extension="xml" ContentType="application/xml"/>`
    + `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>`
    + `${overrides}</Types>`;
}

function utf8(text) {
  return new TextEncoder().encode(text);
}

export function listValidation(sqref, formula, extras = {}) {
  if (!sqref || !formula) return "";
  const prompt = extras.prompt
    ? ` showInputMessage="1" promptTitle="${xmlEsc(extras.promptTitle || " ")}" prompt="${xmlEsc(extras.prompt)}"`
    : "";
  const error = extras.error
    ? ` showErrorMessage="1" errorStyle="warning" errorTitle="${xmlEsc(extras.errorTitle || " ")}" error="${xmlEsc(extras.error)}"`
    : " showErrorMessage=\"0\"";
  return `<dataValidation type="list" allowBlank="1"${prompt}${error} sqref="${sqref}"><formula1>${xmlEsc(formula)}</formula1></dataValidation>`;
}

export function namedRange(name, sheet, startRow, count, col = "A") {
  const last = Math.max(Number(startRow) || 2, (Number(startRow) || 2) + Math.max(Number(count) || 1, 1) - 1);
  const first = Number(startRow) || 2;
  return { name, ref: `'${sheet}'!$${col}$${first}:$${col}$${last}` };
}

export function buildXlsx(sheets, options = {}) {
  const names = sheets.map((sheet) => sheet.name || "Sheet");
  const files = [
    { name: "[Content_Types].xml", data: utf8(contentTypes(sheets.length)) },
    { name: "_rels/.rels", data: utf8(ROOT_RELS) },
    { name: "xl/workbook.xml", data: utf8(workbookXml(names, options.definedNames || [])) },
    { name: "xl/_rels/workbook.xml.rels", data: utf8(workbookRels(sheets.length)) },
  ];
  sheets.forEach((sheet, index) => {
    files.push({
      name: `xl/worksheets/sheet${index + 1}.xml`,
      data: utf8(sheetXml(sheet.rows || [], sheet.extra || "", {
        rtl: sheet.rtl,
        freeze: sheet.freeze,
      })),
    });
  });
  return zipStore(files);
}

export function downloadXlsx(filename, sheets, options = {}) {
  const blob = new Blob([buildXlsx(sheets, options)], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = String(filename || "template").replace(/\.xlsx$/i, "") + ".xlsx";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

function isZip(bytes) {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4B;
}

function decodeXml(value) {
  return String(value || "")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => {
      const code = parseInt(hex, 16);
      return code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec) => {
      const code = Number(dec);
      return code >= 0 && code <= 0x10FFFF ? String.fromCodePoint(code) : "";
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function excelSerialToIso(serial) {
  const n = Number(serial);
  if (!Number.isFinite(n) || n < 1 || n > 80000) return "";
  const utc = Date.UTC(1899, 11, 30) + Math.round(n) * 86400000;
  const date = new Date(utc);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function inflateWith(bytes, format) {
  if (typeof DecompressionStream === "undefined") throw new Error("ZIP_INFLATE");
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format));
  const buffer = await new Response(stream).arrayBuffer();
  return new Uint8Array(buffer);
}

async function inflateRaw(bytes) {
  try {
    return await inflateWith(bytes, "deflate-raw");
  } catch {
    return inflateWith(bytes, "deflate");
  }
}

function zipFile(files, path) {
  const wanted = String(path || "").replace(/^\/+/, "").replace(/\\/g, "/");
  if (files[wanted]) return files[wanted];
  const hit = Object.keys(files).find((name) => name.replace(/^\/+/, "").replace(/\\/g, "/") === wanted);
  return hit ? files[hit] : null;
}

function decodeBytes(bytes) {
  return new TextDecoder().decode(bytes || new Uint8Array());
}

async function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("ZIP");
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const files = {};
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOff = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen));
    const localNameLen = view.getUint16(localOff + 26, true);
    const localExtra = view.getUint16(localOff + 28, true);
    const startData = localOff + 30 + localNameLen + localExtra;
    const chunk = bytes.slice(startData, startData + compressed);
    files[name.replace(/\\/g, "/")] = method === 0 ? chunk : await inflateRaw(chunk);
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

function cellRef(ref) {
  const match = String(ref || "").match(/^([A-Z]+)(\d+)$/i);
  if (!match) return { col: 0, row: 0 };
  const letters = match[1].toUpperCase();
  let col = 0;
  for (let i = 0; i < letters.length; i += 1) col = col * 26 + (letters.charCodeAt(i) - 64);
  return { col: col - 1, row: Number(match[2]) - 1 };
}

function parseSharedStrings(xml) {
  const out = [];
  const blocks = String(xml || "").match(/<(?:\w+:)?si[\s>][\s\S]*?<\/(?:\w+:)?si>/g) || [];
  blocks.forEach((block) => {
    const texts = [...block.matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)].map((match) => decodeXml(match[1]));
    out.push(texts.join(""));
  });
  return out;
}

function parseDateStyleFlags(xml) {
  const dateFmt = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57]);
  [...String(xml || "").matchAll(/<(?:\w+:)?numFmt\b([^>]*)\/?>/g)].forEach((match) => {
    const id = Number((match[1].match(/numFmtId="(\d+)"/) || [])[1]);
    const code = decodeXml((match[1].match(/formatCode="([^"]*)"/) || [])[1] || "");
    if (id && /[ymdhs]/i.test(code)) dateFmt.add(id);
  });
  const block = String(xml || "").match(/<(?:\w+:)?cellXfs\b[\s\S]*?<\/(?:\w+:)?cellXfs>/)?.[0] || "";
  return [...block.matchAll(/<(?:\w+:)?xf\b([^>]*)\/?>/g)].map((match) => {
    const id = Number((match[1].match(/numFmtId="(\d+)"/) || [])[1] || 0);
    return dateFmt.has(id);
  });
}

function cellText(body, type, shared, isDate) {
  let value = "";
  if (type === "inlineStr" || type === "str") {
    value = [...String(body || "").matchAll(/<(?:\w+:)?t\b[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/g)]
      .map((match) => match[1])
      .join("");
  } else if (type === "s") {
    const index = Number((String(body || "").match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1]);
    value = shared[index] || "";
  } else {
    value = (String(body || "").match(/<(?:\w+:)?v\b[^>]*>([\s\S]*?)<\/(?:\w+:)?v>/) || [])[1] || "";
  }
  value = decodeXml(value);
  if (isDate) {
    const iso = excelSerialToIso(value);
    if (iso) return iso;
  }
  return value;
}

function parseSheetRows(xml, shared, dateStyles = []) {
  const rows = [];
  const rowBlocks = String(xml || "").match(/<(?:\w+:)?row\b[\s\S]*?<\/(?:\w+:)?row>/g) || [];
  rowBlocks.forEach((block) => {
    const row = [];
    const cells = [...block.matchAll(/<(?:\w+:)?c\b([^>]*)(?:\/>|>([\s\S]*?)<\/(?:\w+:)?c>)/g)];
    cells.forEach((cell) => {
      const attrs = cell[1];
      const body = cell[2] || "";
      const ref = (attrs.match(/\br="([^"]+)"/) || [])[1];
      const type = (attrs.match(/\bt="([^"]+)"/) || [])[1] || "";
      const style = Number((attrs.match(/\bs="(\d+)"/) || [])[1]);
      const { col } = cellRef(ref);
      row[col] = cellText(body, type, shared, Boolean(dateStyles[style]));
    });
    rows.push(row.map((cell) => cell || ""));
  });
  return rows;
}

function relTarget(files, rid) {
  const rels = decodeBytes(zipFile(files, "xl/_rels/workbook.xml.rels"));
  const match = [...rels.matchAll(/<(?:\w+:)?Relationship\b([^>]*)\/?>/g)].find((item) => {
    return (item[1].match(/\bId="([^"]+)"/) || [])[1] === rid;
  });
  const target = decodeXml((match?.[1].match(/\bTarget="([^"]+)"/) || [])[1] || "");
  if (!target) return "";
  if (target.startsWith("/")) return target.replace(/^\/+/, "");
  if (target.startsWith("xl/")) return target;
  return `xl/${target.replace(/^\.\//, "")}`;
}

function sheetBytes(files, preferredName) {
  const workbook = decodeBytes(zipFile(files, "xl/workbook.xml"));
  const sheets = [...workbook.matchAll(/<(?:\w+:)?sheet\b([^>]*)\/?>/g)].map((match) => ({
    name: decodeXml((match[1].match(/\bname="([^"]+)"/) || [])[1] || ""),
    rid: (match[1].match(/\br:id="([^"]+)"/) || match[1].match(/\bId="([^"]+)"/) || [])[1] || "",
  }));
  const wanted = sheets.find((sheet) => sheet.name === preferredName) || sheets[0];
  const path = relTarget(files, wanted?.rid) || "xl/worksheets/sheet1.xml";
  return zipFile(files, path) || zipFile(files, "xl/worksheets/sheet1.xml");
}

export async function parseXlsxFirstSheet(buffer, preferredSheet = "") {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (!isZip(bytes)) return [];
  const files = await unzip(bytes);
  const shared = parseSharedStrings(decodeBytes(zipFile(files, "xl/sharedStrings.xml")));
  const dateStyles = parseDateStyleFlags(decodeBytes(zipFile(files, "xl/styles.xml")));
  const sheet = sheetBytes(files, preferredSheet);
  if (!sheet) return [];
  return parseSheetRows(decodeBytes(sheet), shared, dateStyles);
}

export function isZipBuffer(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return isZip(bytes);
}
