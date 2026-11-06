import { STATUSES, type GameStatus, type UserGameInsert } from "./games";

/**
 * A game read from an export file (JSON or CSV). Files from the app before the move to IGDB only know the RAWG id
 * (`rawg_id`): those rows have no `igdb_id` until they are matched by title. Only rows with an `igdb_id` can be saved.
 */
export type ImportRow = Omit<UserGameInsert, "user_id" | "igdb_id"> & { igdb_id: number | null; rawg_id: number | null };

/** What goes into the database: the row with its IGDB id (the legacy RAWG id is dropped). */
export function toInsert(row: ImportRow & { igdb_id: number }): Omit<UserGameInsert, "user_id"> {
  const { rawg_id: _legacy, ...rest } = row;
  return rest;
}

export interface ParsedImport {
  rows: ImportRow[];
  /** Entries that could not be read (missing name/id, repeated id, ...). */
  invalid: number;
}

const str = (v: unknown): string | null => {
  if (v == null) return null;
  const s = String(v).trim();
  return s ? s : null;
};

const int = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : Number(str(v));
  return Number.isInteger(n) ? n : null;
};

/** JSON gives arrays; CSV gives "a; b; c". */
const list = (v: unknown): string[] => {
  if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean);
  const s = str(v);
  return s ? s.split(";").map((x) => x.trim()).filter(Boolean) : [];
};

const hours = (v: unknown): number | null => {
  const s = str(v)?.replace(",", ".");
  if (!s || !/^\d{1,5}(\.\d)?$/.test(s)) return null;
  return Number(s);
};

const isoDate = (v: unknown): string | null => {
  const s = str(v);
  return s && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
};

const isoTimestamp = (v: unknown): string | undefined => {
  const s = str(v);
  return s && !Number.isNaN(Date.parse(s)) ? new Date(s).toISOString() : undefined;
};

function toRow(raw: Record<string, unknown>): ImportRow | null {
  // Files from the old app carry only rawg_id; newer exports carry igdb_id. One of them is needed to keep the row.
  const rawgId = int(raw["rawg_id"]);
  const igdbId = int(raw["igdb_id"]);
  const name = str(raw["name"]);
  const hasId = (igdbId != null && igdbId > 0) || (rawgId != null && rawgId > 0);
  if (!hasId || !name) return null;

  const status = (str(raw["status"]) ?? "quero_jogar") as GameStatus;
  const rating = int(raw["rating"]);
  const row: ImportRow = {
    rawg_id: rawgId != null && rawgId > 0 ? rawgId : null,
    igdb_id: igdbId != null && igdbId > 0 ? igdbId : null,
    name,
    status: STATUSES.includes(status) ? status : "quero_jogar",
    played_on: str(raw["played_on"]),
    rating: rating != null && rating >= 1 && rating <= 5 ? rating : null,
    completed_at: isoDate(raw["completed_at"]),
    hours_played: hours(raw["hours_played"]),
    release_year: int(raw["release_year"]),
    genres: list(raw["genres"]),
    platforms: list(raw["platforms"]),
    notes: str(raw["notes"]),
  };
  const cover = str(raw["cover_url"]);
  if (cover && /^https:\/\//.test(cover)) row.cover_url = cover;
  // A completed game with no date (old exports, or "não lembro") is stored as "date unknown".
  row.completed_date_unknown = row.status === "concluido" && !row.completed_at;
  const created = isoTimestamp(raw["created_at"]);
  if (created) row.created_at = created;
  return row;
}

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, newlines inside quotes). */
function parseCsv(text: string): Record<string, string>[] {
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      record.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else field += c;
  }
  if (field !== "" || record.length) {
    record.push(field);
    records.push(record);
  }

  const [header, ...body] = records.filter((r) => r.some((x) => x.trim() !== ""));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, r[i] ?? ""])));
}

/** Parses the text of an exported library file (JSON or CSV). Throws when the format is not recognised. */
export function parseImport(text: string): ParsedImport {
  const clean = text.replace(/^﻿/, "").trim();
  let records: Record<string, unknown>[];

  if (clean.startsWith("[") || clean.startsWith("{")) {
    const data: unknown = JSON.parse(clean);
    const list = Array.isArray(data) ? data : (data as { games?: unknown }).games;
    if (!Array.isArray(list)) throw new Error("format");
    records = list.filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null);
  } else {
    records = parseCsv(clean);
  }
  if (records.length === 0) throw new Error("empty");

  const rows: ImportRow[] = [];
  const seen = new Set<string>();
  let invalid = 0;
  for (const rec of records) {
    const row = toRow(rec);
    const key = row ? (row.igdb_id != null ? `igdb:${row.igdb_id}` : `rawg:${row.rawg_id}`) : "";
    if (!row || seen.has(key)) {
      invalid++;
      continue;
    }
    seen.add(key);
    rows.push(row);
  }
  return { rows, invalid };
}
