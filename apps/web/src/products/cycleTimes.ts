import type { CycleTime, Project } from '@factory-sim/schema';

export interface CycleTimeEntry {
  productId: string;
  stationId: string;
  seconds: number;
}

export interface MissingCycleTime {
  productId: string;
  stationId: string;
}

export interface ImportResult {
  entries: CycleTimeEntry[];
  /** One human-readable line per cell, row or column that was skipped. */
  errors: string[];
}

const SECONDS = '(\\d+(?:\\.\\d+)?)';
const PLAIN = new RegExp(`^${SECONDS}$`);
const MIN_SEC = new RegExp(`^(\\d+):([0-5]?\\d(?:\\.\\d+)?)$`);
const HOUR_MIN_SEC = new RegExp(`^(\\d+):([0-5]\\d):([0-5]\\d(?:\\.\\d+)?)$`);

/** Seconds from "45", "1.5", "m:ss" or "h:mm:ss"; null if it isn't a positive duration. */
export function parseDuration(text: string): number | null {
  const t = text.trim();
  let seconds: number | null = null;
  let m: RegExpMatchArray | null;
  if ((m = t.match(PLAIN))) seconds = Number(m[1]);
  else if ((m = t.match(MIN_SEC))) seconds = Number(m[1]) * 60 + Number(m[2]);
  else if ((m = t.match(HOUR_MIN_SEC)))
    seconds = Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  return seconds !== null && seconds > 0 ? seconds : null;
}

/** The distinct stations a product's routing visits, in routing order. */
export function stationsOf(product: Project['products'][number]): string[] {
  return [...new Set(product.routing.map((s) => s.stationId))];
}

/** (product, station) pairs a routing uses that have no cycle time yet. */
export function missingCycleTimes(
  project: Pick<Project, 'products'> & { cycleTimes: CycleTime[] },
): MissingCycleTime[] {
  const have = new Set(project.cycleTimes.map((c) => `${c.productId}\u0000${c.stationId}`));
  return project.products.flatMap((p) =>
    stationsOf(p)
      .filter((stationId) => !have.has(`${p.id}\u0000${stationId}`))
      .map((stationId) => ({ productId: p.id, stationId })),
  );
}

/** Splits CSV or tab-separated text into rows of cells; quotes may wrap delimiters and newlines. */
function splitTable(text: string): string[][] {
  const firstLine = text.split(/\r?\n/).find((l) => l.trim() !== '') ?? '';
  const delimiter = firstLine.includes('\t') ? '\t' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((c) => c.trim() !== '')) rows.push(row);
    row = [];
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch !== '"') cell += ch;
      else if (text[i + 1] === '"') {
        cell += '"';
        i++;
      } else quoted = false;
    } else if (ch === '"' && cell === '') quoted = true;
    else if (ch === delimiter) endCell();
    else if (ch === '\n') endRow();
    else if (ch !== '\r') cell += ch;
  }
  endRow();
  return rows;
}

/**
 * Parses pasted Excel / CSV text: a header row of station names, then one row per part number,
 * each cell a time (seconds or mm:ss). Blank cells are left alone. Anything that can't be applied
 * is reported and skipped; the rest still imports.
 */
export function parseCycleTimeTable(
  text: string,
  project: Pick<Project, 'products' | 'equipment'>,
): ImportResult {
  const rows = splitTable(text);
  if (rows.length < 2)
    return {
      entries: [],
      errors: ['Paste a header row of station names, then one row per part number.'],
    };

  const errors: string[] = [];
  const stations = project.equipment.filter((e) => e.behavior === 'workstation');
  const columns = rows[0]!.slice(1).map((raw) => {
    const name = raw.trim();
    const matches = stations.filter((s) => s.name.trim().toLowerCase() === name.toLowerCase());
    if (matches.length === 1) return matches[0]!;
    if (name !== '')
      errors.push(
        matches.length > 1 ? `Station "${name}" is ambiguous` : `Unknown station "${name}"`,
      );
    return null;
  });

  const entries: CycleTimeEntry[] = [];
  for (const row of rows.slice(1)) {
    const part = row[0]!.trim();
    const product = project.products.find((p) => p.partNumber === part);
    if (!product) {
      errors.push(`Unknown part number "${part}"`);
      continue;
    }
    const used = new Set(stationsOf(product));
    columns.forEach((station, i) => {
      const cell = (row[i + 1] ?? '').trim();
      if (!station || cell === '') return;
      if (!used.has(station.id))
        return errors.push(`${part} does not route through ${station.name}; skipped`);
      const seconds = parseDuration(cell);
      if (seconds === null)
        return errors.push(
          `"${cell}" is not a time (${part} at ${station.name}); use seconds or mm:ss`,
        );
      entries.push({ productId: product.id, stationId: station.id, seconds });
    });
  }
  return { entries, errors };
}
