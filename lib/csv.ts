export type ParsedCsv = {
  headers: string[];
  rows: string[][];
  /** 1-indexed row numbers from the original input, aligned with `rows`. Header is row 1. */
  rowNumbers: number[];
  errors: { row: number; message: string }[];
};

/**
 * Parse CSV text into headers + rows. Accepts CRLF or LF line endings,
 * quoted fields with embedded commas/quotes (RFC 4180 style: "" escapes ").
 * Empty input or input with only a header row returns an empty `rows` array.
 */
export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const errors: ParsedCsv["errors"] = [];
  const records: { values: string[]; lineNumber: number }[] = [];

  let i = 0;
  let line = 1;
  let recordStartLine = 1;
  let cell = "";
  let row: string[] = [];
  let inQuotes = false;

  const pushCell = () => {
    row.push(cell);
    cell = "";
  };
  const pushRow = () => {
    pushCell();
    records.push({ values: row, lineNumber: recordStartLine });
    row = [];
    recordStartLine = line;
  };

  while (i < text.length) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      if (ch === "\n") line += 1;
      cell += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ",") {
      pushCell();
      i += 1;
      continue;
    }
    if (ch === "\r") {
      // CRLF: skip the \n on next iteration
      if (text[i + 1] === "\n") i += 1;
      pushRow();
      line += 1;
      i += 1;
      continue;
    }
    if (ch === "\n") {
      pushRow();
      line += 1;
      i += 1;
      continue;
    }
    cell += ch;
    i += 1;
  }
  // Final cell/row if input did not end in newline
  if (cell.length > 0 || row.length > 0) pushRow();
  if (inQuotes) errors.push({ row: recordStartLine, message: "Unterminated quoted field." });

  if (records.length === 0) {
    return { headers: [], rows: [], rowNumbers: [], errors };
  }

  const headerRecord = records[0];
  const headers = headerRecord.values.map((h) => h.trim());
  const dataRecords = records.slice(1).filter((rec) => rec.values.some((v) => v.trim().length > 0));
  const rows = dataRecords.map((rec) => {
    const padded = [...rec.values];
    while (padded.length < headers.length) padded.push("");
    return padded.slice(0, headers.length).map((c) => c.trim());
  });
  const rowNumbers = dataRecords.map((rec) => rec.lineNumber);

  return { headers, rows, rowNumbers, errors };
}

/** Header strings that the wizard recognises as common aliases. Lowercased, punctuation-stripped. */
export const normalizeHeader = (header: string): string =>
  header.toLowerCase().replace(/[^a-z0-9]+/g, "");
