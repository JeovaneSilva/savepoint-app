import type { Database } from "./database.types";

export type UserGame = Database["public"]["Tables"]["user_games"]["Row"];
export type UserGameInsert = Database["public"]["Tables"]["user_games"]["Insert"];
export type UserGameUpdate = Database["public"]["Tables"]["user_games"]["Update"];
export type GameStatus = Database["public"]["Enums"]["game_status"];

export const STATUSES: GameStatus[] = ["concluido", "jogando", "quero_jogar", "abandonado"];

export const STATUS_LABEL: Record<GameStatus, string> = {
  concluido: "Concluído",
  jogando: "Jogando",
  quero_jogar: "Quero jogar",
  abandonado: "Abandonado",
};

export const STATUS_TAB_LABEL: Record<GameStatus, string> = {
  concluido: "Concluídos",
  jogando: "Jogando",
  quero_jogar: "Quero Jogar",
  abandonado: "Abandonados",
};

/** Shape returned by the game search (IGDB proxy). */
export interface GameSummary {
  /** IGDB id. */
  id: number;
  name: string;
  cover: string | null;
  year: number | null;
  /** Release date (YYYY-MM-DD), when IGDB has it. */
  released: string | null;
  platforms: string[];
  /** Short platform labels shown as chips (PS5, PC, SNES...). */
  parentPlatforms: string[];
  genres: string[];
  /** Critics' score 0-100 (IGDB aggregated rating), when known. */
  criticScore: number | null;
}

/** Average hours to beat a game (IGDB "time to beat"); any of the three can be missing. */
export interface TimeToBeat {
  rushed: number | null;
  normal: number | null;
  complete: number | null;
  /** How many players the average comes from (0 = unknown). */
  count: number;
}

export interface GameDetails extends GameSummary {
  description: string;
  developers: string[];
  publishers: string[];
  website: string | null;
  screenshots: string[];
  timeToBeat: TimeToBeat | null;
  /** Other games of the same series, oldest first. */
  series: GameSummary[];
  /** Similar games (not in the series). */
  similar: GameSummary[];
}

/** "12" / "12,5" + "h". */
export const formatHours = (h: number): string => `${String(h).replace(".", ",")}h`;

/** The hours suggested for the "hours to finish" field: the usual way to beat it, else the closest number IGDB has. */
export function suggestedHours(t: TimeToBeat | null | undefined): number | null {
  return t ? (t.normal ?? t.rushed ?? t.complete ?? null) : null;
}

/** Has this release date (YYYY-MM-DD) not happened yet? */
export function isUnreleased(released: string | null | undefined, today = new Date()): boolean {
  if (!released) return false;
  const tz = today.getTimezoneOffset() * 60000;
  return released > new Date(today.getTime() - tz).toISOString().slice(0, 10);
}

export type PlatformGroup = "pc" | "playstation" | "xbox" | "nintendo" | "retro";

export const PLATFORM_GROUPS: { value: PlatformGroup; label: string }[] = [
  { value: "pc", label: "PC" },
  { value: "playstation", label: "PlayStation" },
  { value: "xbox", label: "Xbox" },
  { value: "nintendo", label: "Nintendo" },
  { value: "retro", label: "Retrô/Clássicos" },
];

export const DECADES = [1970, 1980, 1990, 2000, 2010, 2020] as const;

/** Genres offered in the search filter (IGDB genre ids). */
export const GENRE_FILTERS: { id: number; label: string }[] = [
  { id: 12, label: "RPG" },
  { id: 31, label: "Aventura" },
  { id: 5, label: "Tiro" },
  { id: 8, label: "Plataforma" },
  { id: 4, label: "Luta" },
  { id: 10, label: "Corrida" },
  { id: 14, label: "Esportes" },
  { id: 13, label: "Simulação" },
  { id: 15, label: "Estratégia" },
  { id: 16, label: "Estratégia por turnos" },
  { id: 11, label: "Estratégia em tempo real" },
  { id: 24, label: "Tático" },
  { id: 25, label: "Hack and slash" },
  { id: 9, label: "Quebra-cabeça" },
  { id: 33, label: "Arcade" },
  { id: 32, label: "Indie" },
  { id: 34, label: "Visual novel" },
  { id: 2, label: "Point-and-click" },
  { id: 7, label: "Música" },
  { id: 35, label: "Cartas e tabuleiro" },
  { id: 26, label: "Quiz" },
  { id: 30, label: "Pinball" },
];

/** Specific platforms per group, for the second filter (IGDB platform ids; PC has only one). */
export const PLATFORM_CHOICES: Partial<Record<PlatformGroup, { id: number; label: string }[]>> = {
  playstation: [
    { id: 167, label: "PlayStation 5" },
    { id: 48, label: "PlayStation 4" },
    { id: 9, label: "PlayStation 3" },
    { id: 8, label: "PlayStation 2" },
    { id: 7, label: "PlayStation" },
    { id: 38, label: "PSP" },
    { id: 46, label: "PS Vita" },
  ],
  xbox: [
    { id: 169, label: "Xbox Series X|S" },
    { id: 49, label: "Xbox One" },
    { id: 12, label: "Xbox 360" },
    { id: 11, label: "Xbox" },
  ],
  nintendo: [
    { id: 508, label: "Switch 2" },
    { id: 130, label: "Switch" },
    { id: 41, label: "Wii U" },
    { id: 5, label: "Wii" },
    { id: 37, label: "3DS" },
    { id: 20, label: "DS" },
    { id: 21, label: "GameCube" },
    { id: 4, label: "Nintendo 64" },
    { id: 19, label: "Super Nintendo" },
    { id: 18, label: "NES" },
    { id: 24, label: "Game Boy Advance" },
    { id: 22, label: "Game Boy Color" },
    { id: 33, label: "Game Boy" },
  ],
  retro: [
    { id: 18, label: "NES" },
    { id: 19, label: "Super Nintendo" },
    { id: 4, label: "Nintendo 64" },
    { id: 33, label: "Game Boy" },
    { id: 24, label: "Game Boy Advance" },
    { id: 7, label: "PlayStation" },
    { id: 8, label: "PlayStation 2" },
    { id: 29, label: "Mega Drive/Genesis" },
    { id: 64, label: "Master System" },
    { id: 35, label: "Game Gear" },
    { id: 32, label: "Saturn" },
    { id: 23, label: "Dreamcast" },
    { id: 59, label: "Atari 2600" },
    { id: 15, label: "Commodore 64" },
    { id: 16, label: "Amiga" },
  ],
};

export interface SearchFilters {
  search: string;
  platform?: PlatformGroup | null | undefined;
  platformId?: number | null | undefined;
  genre?: number | null | undefined;
  upcoming?: boolean | undefined;
  decade?: number | null | undefined;
  page: number;
}

/** Results per page when the user searches by name. */
export const PAGE_SIZE = 12;
/** How many "em alta" games to show when nothing is typed (single page, no infinite scroll). */
export const TRENDING_SIZE = 12;
/** Shorter terms don't hit the API (avoids a request per keystroke on 1 letter). */
export const MIN_SEARCH_LENGTH = 2;

/** Normalizes the typed term: too-short terms count as "no search" (trending mode). */
export function effectiveSearch(term: string): string {
  const t = term.trim();
  return t.length >= MIN_SEARCH_LENGTH ? t : "";
}

/** Trending mode = no name search: show a small, single page of popular games. */
export function isTrendingMode(f: Pick<SearchFilters, "search">): boolean {
  return !effectiveSearch(f.search);
}

/** The "#r=<width/height>" hint the igdb function adds to image URLs (the real aspect ratio), if present. */
export function imageRatio(url: string | null | undefined): number | null {
  const m = url?.match(/[#&]r=([\d.]+)/);
  const r = m ? Number(m[1]) : NaN;
  return Number.isFinite(r) && r > 0 ? r : null;
}

/**
 * Version of the image-selection rules (kept in sync with IMAGE_V in the igdb function). Covers saved by an older version
 * are refreshed automatically.
 */
export const IMAGE_VERSION = 3;

/** True when a saved cover was chosen by older rules (or is missing) and should be looked up again. */
export const needsCoverRefresh = (url: string | null | undefined): boolean =>
  !new RegExp(`[#&]v=${IMAGE_VERSION}(&|$)`).test(url ?? "");

/** Is this image roughly 16:9? Anything else (posters, squares) should be shown whole, not cropped to a wide card. */
export const isLandscapeRatio = (r: number | null): boolean => r == null || (r >= 1.35 && r <= 2.4);

/**
 * IGDB image URLs carry a size token (t_720p). Swap it for the size the screen needs. Covers are 3:4 posters: the
 * cover sizes keep that exact shape (t_cover_big 264x352, t_cover_big_2x 528x704); t_720p keeps any aspect ratio.
 */
export function igdbThumb(url: string | null | undefined, width = 640): string | null {
  if (!url) return null;
  if (!url.includes("images.igdb.com/igdb/image/upload/")) return url;
  const ratio = imageRatio(url);
  const poster = ratio != null && ratio < 0.95;
  let size = "t_720p";
  if (width <= 100) size = "t_thumb";
  else if (poster && width <= 260) size = "t_cover_big";
  else if (poster && width <= 1000) size = "t_cover_big_2x";
  else if (width <= 1000 && ratio != null && ratio >= 1.4 && ratio <= 2.4) size = width <= 640 ? "t_screenshot_med" : "t_screenshot_big";
  return url.replace(/\/t_[a-z0-9_]+\//, `/${size}/`);
}

/* ---------- Library helpers ---------- */

export type SortKey = "recent" | "name" | "year" | "rating" | "completed";

export const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "recent", label: "Adicionados recentemente" },
  { value: "name", label: "Nome" },
  { value: "year", label: "Ano de lançamento" },
  { value: "rating", label: "Nota" },
  { value: "completed", label: "Data de conclusão" },
];

export interface LibraryFilters {
  status: GameStatus | "all";
  playedOn: string | "all";
  genre: string | "all";
  minRating: number; // 0 = any
  query: string;
  sort: SortKey;
}

export function filterAndSortLibrary(games: UserGame[], f: LibraryFilters): UserGame[] {
  const q = f.query.trim().toLowerCase();
  const out = games.filter((g) => {
    if (f.status !== "all" && g.status !== f.status) return false;
    if (f.playedOn !== "all" && g.played_on !== f.playedOn) return false;
    if (f.genre !== "all" && !g.genres.includes(f.genre)) return false;
    if (f.minRating > 0 && (g.rating ?? 0) < f.minRating) return false;
    if (q && !g.name.toLowerCase().includes(q)) return false;
    return true;
  });
  const byDesc = (a: number | null | undefined, b: number | null | undefined) => (b ?? -Infinity) - (a ?? -Infinity);
  out.sort((a, b) => {
    switch (f.sort) {
      case "name":
        return a.name.localeCompare(b.name, "pt-BR");
      case "year":
        return byDesc(a.release_year, b.release_year);
      case "rating":
        return byDesc(a.rating, b.rating);
      case "completed":
        return byDesc(
          a.completed_at ? Date.parse(a.completed_at) : null,
          b.completed_at ? Date.parse(b.completed_at) : null,
        );
      case "recent":
      default:
        return Date.parse(b.created_at) - Date.parse(a.created_at);
    }
  });
  return out;
}

/* ---------- Stats ---------- */

export interface LibraryStats {
  total: number;
  counts: Record<GameStatus, number>;
  averageRating: number | null;
  completedByYear: { year: number; count: number }[];
  /** Completed games with no date ("não lembro"): counted in totals, absent from the per-year chart. */
  completedWithoutDate: number;
  byPlatform: { name: string; count: number }[];
  byGenre: { name: string; count: number }[];
  lastCompleted: UserGame[];
}

function topCounts(values: string[], limit: number): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const v of values) map.set(v, (map.get(v) ?? 0) + 1);
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

export function computeStats(games: UserGame[]): LibraryStats {
  const counts: Record<GameStatus, number> = { concluido: 0, jogando: 0, quero_jogar: 0, abandonado: 0 };
  for (const g of games) counts[g.status]++;

  const rated = games.filter((g) => g.rating != null);
  const averageRating = rated.length
    ? Math.round((rated.reduce((s, g) => s + (g.rating ?? 0), 0) / rated.length) * 10) / 10
    : null;

  const completed = games.filter((g) => g.status === "concluido");
  const yearMap = new Map<number, number>();
  for (const g of completed) {
    if (!g.completed_at) continue;
    const y = Number(g.completed_at.slice(0, 4));
    yearMap.set(y, (yearMap.get(y) ?? 0) + 1);
  }
  const completedByYear = [...yearMap.entries()]
    .map(([year, count]) => ({ year, count }))
    .sort((a, b) => a.year - b.year);

  // "Last completed" only makes sense for games with a known date.
  const lastCompleted = completed
    .filter((g) => !!g.completed_at)
    .sort((a, b) => Date.parse(b.completed_at ?? "") - Date.parse(a.completed_at ?? ""))
    .slice(0, 5);

  return {
    total: games.length,
    counts,
    averageRating,
    completedByYear,
    completedWithoutDate: completed.filter((g) => !g.completed_at).length,
    byPlatform: topCounts(
      games.map((g) => g.played_on).filter((p): p is string => !!p),
      8,
    ),
    byGenre: topCounts(
      games.flatMap((g) => g.genres),
      8,
    ),
    lastCompleted,
  };
}

/* ---------- Export ---------- */

const EXPORT_FIELDS = [
  "name",
  "status",
  "played_on",
  "rating",
  "completed_at",
  "completed_date_unknown",
  "hours_played",
  "release_year",
  "genres",
  "platforms",
  "notes",
  "igdb_id",
  "cover_url",
  "created_at",
] as const;

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(games: UserGame[]): string {
  const header = EXPORT_FIELDS.join(",");
  const rows = games.map((g) => EXPORT_FIELDS.map((k) => csvCell(g[k])).join(","));
  return [header, ...rows].join("\n");
}

export function toExportJson(games: UserGame[]): string {
  return JSON.stringify(
    games.map((g) => Object.fromEntries(EXPORT_FIELDS.map((k) => [k, g[k]]))),
    null,
    2,
  );
}
