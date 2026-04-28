/** Split a single CSV line respecting double-quoted fields. */
export function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((c === "," || c === "\t") && !inQuotes) {
      out.push(unquote(cur.trim()));
      cur = "";
    } else {
      cur += c;
    }
  }
  out.push(unquote(cur.trim()));
  return out;
}

function unquote(s: string): string {
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    return s.slice(1, -1).replaceAll('""', '"');
  }
  return s;
}

function lower(s: string): string {
  return s.trim().toLowerCase();
}

/** Heuristic: first row looks like a header (question+answer, front+back, or q+a). */
function isHeaderRow(cells: string[]): boolean {
  if (cells.length < 2) return false;
  const a = lower(cells[0]!);
  const b = lower(cells[1]!);
  if (a === "question" && b === "answer") return true;
  if (a === "front" && b === "back") return true;
  if (a === "q" && b === "a") return true; /* question / answer (short) */
  if (a === "term" && b === "definition") return true;
  if (a === "prompt" && b === "answer") return true;
  return false;
}

function mapHeaderIndices(header: string[]): { q: number; a: number } {
  if (lower(header[0]!) === "q" && lower(header[1]!) === "a")
    return { q: 0, a: 1 };

  let q = 0;
  let a = 1;
  for (let i = 0; i < header.length; i++) {
    const h = lower(header[i]!);
    if (h === "question" || h === "q" || h === "front" || h === "term" || h === "prompt")
      q = i;
  }
  for (let i = 0; i < header.length; i++) {
    const h = lower(header[i]!);
    if (h === "answer" || h === "back" || h === "definition" || h === "b" || h === "a2") a = i;
  }
  if (q === a && header.length >= 2) {
    q = 0;
    a = 1;
  }
  return { q, a };
}

export function parseCardCSV(
  text: string,
):
  | { ok: true; rows: { question: string; answer: string }[]; warnings: string[] }
  | { ok: false; error: string } {
  const rawLines = text
    .split(/\r?\n/)
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (rawLines.length === 0) {
    return { ok: false, error: "File is empty." };
  }

  const lines = rawLines.map((l) => parseCSVLine(l));
  const warnings: string[] = [];

  let startRow = 0;
  let qCol = 0;
  let aCol = 1;
  if (isHeaderRow(lines[0]!)) {
    const m = mapHeaderIndices(lines[0]!);
    qCol = m.q;
    aCol = m.a;
    startRow = 1;
  }

  if (qCol === aCol && lines[0]!.length >= 2) {
    qCol = 0;
    aCol = 1;
  }

  const rows: { question: string; answer: string }[] = [];
  for (let i = startRow; i < lines.length; i++) {
    const parts = lines[i]!;
    if (parts.length < 2) {
      warnings.push(`Line ${i + 1}: skipped (need at least 2 columns).`);
      continue;
    }
    const q = (parts[qCol] ?? "").trim();
    const a = (parts[aCol] ?? "").trim();
    if (q === "" && a === "") continue;
    rows.push({ question: q, answer: a });
  }

  if (rows.length === 0) {
    return {
      ok: false,
      error: "No rows imported. Use two columns (e.g. question,answer) or front,back with a header row.",
    };
  }
  return { ok: true, rows, warnings };
}
