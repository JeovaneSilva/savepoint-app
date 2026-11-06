// Supabase Edge Function: IGDB (Twitch) game database proxy.
//
// Replaces the RAWG proxy. Same ideas: secrets stay server-side, answers are cached in `rawg_cache` (key prefix
// "igdb:"), only APPROVED accounts may call it (migration 0007), and each user is limited per hour (migration 0008).
//
// Secrets (Edge Functions -> Secrets): TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET
// (IGDB_CLIENT_ID / IGDB_CLIENT_SECRET are accepted as aliases).
//
// Actions (POST, JSON body):
//   search   { search?, platform?, decade?, page }   list/search games
//   details  { id }                                  one game with description, companies, screenshots
//   match    { items: [{ name, year?, platforms? }] } find the IGDB game for each title (importer of old files)
//
// Never calls IGDB more than needed: fresh cache hits are free, stale cache is served if IGDB is failing,
// calls have an 8s timeout and a short circuit breaker.

import { createClient } from "npm:@supabase/supabase-js@2";

const IGDB_URL = "https://api.igdb.com/v4";
const TOKEN_URL = "https://id.twitch.tv/oauth2/token";
const CLIENT_ID = Deno.env.get("TWITCH_CLIENT_ID") ?? Deno.env.get("IGDB_CLIENT_ID");
const CLIENT_SECRET = Deno.env.get("TWITCH_CLIENT_SECRET") ?? Deno.env.get("IGDB_CLIENT_SECRET");
const USER_HOURLY_LIMIT = Number(Deno.env.get("IGDB_USER_HOURLY_LIMIT") ?? Deno.env.get("RAWG_USER_HOURLY_LIMIT") ?? "300");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
/** Bump when the shape of cached answers changes, so older cached copies are ignored. */
const CACHE_V = "v2";
const TTL = { trending: 6 * HOUR, search: DAY, game: 30 * DAY, find: 30 * DAY };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

/* ==================== PURE:START (no Deno/network APIs below: unit-tested in Node) ==================== */

interface IgdbImage { image_id?: string }
interface IgdbGame {
  id: number;
  name: string;
  first_release_date?: number;
  cover?: IgdbImage;
  artworks?: IgdbImage[];
  screenshots?: IgdbImage[];
  genres?: { name: string }[];
  platforms?: { id?: number; name: string; abbreviation?: string }[];
  aggregated_rating?: number;
  total_rating_count?: number;
  summary?: string;
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: { name: string } }[];
  websites?: { url?: string; category?: number }[];
}

type PlatformGroup = "pc" | "playstation" | "xbox" | "nintendo" | "retro";

/** IGDB platform ids per filter group (all confirmed to exist in IGDB). */
const PLATFORM_IDS: Record<PlatformGroup, number[]> = {
  pc: [6],
  playstation: [7, 8, 9, 38, 46, 48, 167],
  xbox: [11, 12, 49, 169],
  nintendo: [4, 5, 18, 19, 20, 21, 22, 24, 33, 37, 41, 130, 508],
  // Atari 2600/5200/7800, NES, SNES, N64, Game Boy (+Color/Advance), GameCube, PS1, PS2, Xbox, Master System,
  // Genesis, Game Gear, Saturn, Dreamcast, Neo Geo (AES/MVS), Commodore 64, Amiga
  retro: [59, 66, 60, 18, 19, 4, 33, 22, 24, 21, 7, 8, 11, 64, 29, 35, 32, 23, 80, 79, 15, 16],
};
const DECADES = [1970, 1980, 1990, 2000, 2010, 2020];

const PAGE_SIZE = 12;
const LIST_FIELDS =
  "name,first_release_date,cover.image_id,artworks.image_id,screenshots.image_id,genres.name,platforms.id,platforms.name,platforms.abbreviation,aggregated_rating,total_rating_count";
const DETAIL_FIELDS =
  LIST_FIELDS + ",summary,involved_companies.developer,involved_companies.publisher,involved_companies.company.name";
/** Website fields vary between IGDB API revisions: the function tries these in order until one is accepted. */
const WEBSITE_VARIANTS = [",websites.url,websites.category", ",websites.url", ""];

/** Names shown in the app: keep the short ones the library already uses (they came from RAWG). */
const DISPLAY_PLATFORM: Record<string, string> = {
  "PC (Microsoft Windows)": "PC",
  Mac: "macOS",
  "Super Nintendo Entertainment System": "SNES",
  "Nintendo Entertainment System": "NES",
  "Sega Mega Drive/Genesis": "Genesis",
  "Xbox Series X|S": "Xbox Series S/X",
  "Sega Saturn": "SEGA Saturn",
  "Sega Master System/Mark III": "SEGA Master System",
  "Sega Game Gear": "Game Gear",
  "Nintendo GameCube": "GameCube",
  "PlayStation Portable": "PSP",
  "PlayStation Vita": "PS Vita",
};
const displayPlatform = (name: string): string => DISPLAY_PLATFORM[name] ?? name;

/** IGDB returns platforms in no useful order: show current/popular ones first (ids confirmed against IGDB). */
const PLATFORM_PRIORITY = [167, 169, 508, 130, 48, 49, 6, 9, 12, 5, 41, 37, 20, 8, 7, 11, 46, 38, 19, 18, 4, 21, 24, 22, 33, 29, 32, 23, 64, 35];

/** Short chip labels by platform id (IGDB abbreviations are inconsistent: "fds", "WiiU", "neogeoaes"...). */
const CHIP_LABEL: Record<number, string> = {
  6: "PC", 7: "PS1", 8: "PS2", 9: "PS3", 38: "PSP", 46: "Vita", 48: "PS4", 167: "PS5",
  11: "Xbox", 12: "X360", 49: "XONE", 169: "XSX",
  4: "N64", 5: "Wii", 18: "NES", 19: "SNES", 20: "DS", 21: "GC", 22: "GBC", 24: "GBA", 33: "GB", 37: "3DS", 41: "Wii U", 130: "Switch", 508: "Switch 2",
  51: "FDS", 99: "Famicom",
  59: "2600", 66: "5200", 60: "7800", 64: "SMS", 29: "Genesis", 35: "GG", 32: "Saturn", 23: "DC", 80: "Neo Geo", 79: "Neo Geo", 15: "C64", 16: "Amiga",
  14: "Mac", 3: "Linux", 34: "Android", 39: "iOS",
};

function chipLabel(p: { id?: number; name: string; abbreviation?: string }): string {
  if (p.id != null && CHIP_LABEL[p.id]) return CHIP_LABEL[p.id]!;
  const a = (p.abbreviation ?? "").trim();
  if (a) return a === a.toLowerCase() ? a.toUpperCase() : a;
  return displayPlatform(p.name);
}

function sortedPlatforms(g: IgdbGame) {
  const rank = (p: { id?: number }) => {
    const i = p.id != null ? PLATFORM_PRIORITY.indexOf(p.id) : -1;
    return i === -1 ? 999 : i;
  };
  return [...(g.platforms ?? [])].sort((a, b) => rank(a) - rank(b));
}

/** Shorter genre names, matching the ones the library already has (they came from RAWG). */
const DISPLAY_GENRE: Record<string, string> = {
  "Role-playing (RPG)": "RPG",
  Platform: "Platformer",
  Simulator: "Simulation",
  Sport: "Sports",
  "Real Time Strategy (RTS)": "RTS",
  "Turn-based strategy (TBS)": "Turn-based Strategy",
  "Hack and slash/Beat 'em up": "Beat 'em up",
  "Card & Board Game": "Card & Board",
  "Quiz/Trivia": "Quiz",
};
const displayGenre = (name: string): string => DISPLAY_GENRE[name] ?? name;

/** Image URLs keep a size token (t_720p) that the app swaps for the size it needs. */
const imageUrl = (id: string | undefined | null): string | null =>
  id ? `https://images.igdb.com/igdb/image/upload/t_720p/${id}.jpg` : null;

/** Cards are landscape: prefer promo art, then a screenshot, then the (portrait) cover. */
function bestImage(g: IgdbGame): string | null {
  return imageUrl(g.artworks?.[0]?.image_id) ?? imageUrl(g.screenshots?.[0]?.image_id) ?? imageUrl(g.cover?.image_id);
}

const yearOf = (unix: number | undefined): number | null => (unix ? new Date(unix * 1000).getUTCFullYear() : null);

function toSummary(g: IgdbGame) {
  const ordered = sortedPlatforms(g);
  const platforms = [...new Set(ordered.map((p) => displayPlatform(p.name)))];
  const badges = [...new Set(ordered.map(chipLabel))];
  return {
    id: g.id,
    name: g.name,
    cover: bestImage(g),
    year: yearOf(g.first_release_date),
    platforms,
    parentPlatforms: badges, // short labels shown as chips (PS5, PC, SNES...)
    genres: [...new Set((g.genres ?? []).map((x) => displayGenre(x.name)))],
    criticScore: typeof g.aggregated_rating === "number" ? Math.round(g.aggregated_rating) : null,
  };
}

const NOT_OFFICIAL = /(steampowered|gog\.com|epicgames|wikipedia|twitter\.com|x\.com|facebook|youtube|youtu\.be|twitch|reddit|discord|instagram|itch\.io|apple\.com|play\.google|microsoft\.com|xbox\.com|playstation\.com|nintendo\.com)/i;

function officialSite(g: IgdbGame): string | null {
  const sites = g.websites ?? [];
  const flagged = sites.find((w) => w.category === 1 && w.url);
  if (flagged?.url) return flagged.url;
  return sites.find((w) => w.url && !NOT_OFFICIAL.test(w.url))?.url ?? null;
}

function toDetails(g: IgdbGame) {
  const companies = g.involved_companies ?? [];
  const names = (flag: "developer" | "publisher") => [
    ...new Set(companies.filter((c) => c[flag] && c.company?.name).map((c) => c.company!.name)),
  ];
  const shots = (g.screenshots ?? []).map((s) => imageUrl(s.image_id)).filter((u): u is string => !!u);
  return {
    ...toSummary(g),
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    description: g.summary ?? "",
    developers: names("developer"),
    publishers: names("publisher"),
    website: officialSite(g),
    screenshots: shots.slice(0, 6),
  };
}

/* ---------- query building (Apicalypse) ---------- */

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\u0000-\u001f]/g, " ");

interface ListFilters {
  search: string;
  platform: PlatformGroup | null;
  decade: number | null;
  page: number;
}

/**
 * Search by name, or (no search) a popular-games list. Without a search or decade the list is "trending":
 * games released in the last 12 months, ranked by how many people rated them. Trending is a single page.
 */
function buildListQuery(f: ListFilters, nowMs: number): { body: string; trending: boolean } {
  const day = Math.floor(nowMs / 86_400_000) * 86_400; // rounded to the day so the cache key stays stable
  const term = f.search.trim();
  const searching = term.length >= 2;

  const where = ["parent_game = null", "version_parent = null"];
  if (f.platform) where.push(`platforms = (${PLATFORM_IDS[f.platform].join(",")})`);
  if (f.decade) {
    where.push(`first_release_date >= ${Date.UTC(f.decade, 0, 1) / 1000}`);
    where.push(`first_release_date <= ${Date.UTC(f.decade + 9, 11, 31, 23, 59, 59) / 1000}`);
  }
  if (!searching) {
    where.push("total_rating_count != null");
    if (!f.decade && f.platform !== "retro") {
      where.push(`first_release_date >= ${day - 365 * 86_400}`, `first_release_date <= ${day}`);
    }
  }

  const parts = [
    searching ? `search "${esc(term)}";` : "",
    `fields ${LIST_FIELDS};`,
    `where ${where.join(" & ")};`,
    searching ? "" : "sort total_rating_count desc;",
    `limit ${searching ? PAGE_SIZE + 1 : PAGE_SIZE};`, // one extra row tells us if there is a next page
    `offset ${searching ? (Math.max(1, f.page) - 1) * PAGE_SIZE : 0};`,
  ];
  return { body: parts.filter(Boolean).join(" "), trending: !searching };
}

/* ---------- matching an old (RAWG) game to an IGDB game ---------- */

const EDITION_WORDS = /\b(game of the year|goty|deluxe|definitive|complete|remastered|remaster|hd|edition|collection|anniversary|ultimate)\b/g;

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/^the /, "");
}
const stripEditions = (n: string) => n.replace(EDITION_WORDS, " ").replace(/\s+/g, " ").trim();

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(a.split(" ").filter(Boolean));
  const tb = new Set(b.split(" ").filter(Boolean));
  if (!ta.size || !tb.size) return 0;
  let common = 0;
  for (const t of ta) if (tb.has(t)) common++;
  return common / (ta.size + tb.size - common);
}

interface OldGame { name: string; year?: number | null; platforms?: string[] }
interface Candidate { id: number; name: string; year: number | null; platforms: string[]; score?: number }

function scoreCandidate(old: OldGame, cand: Candidate): number {
  const a = normalizeTitle(old.name);
  const b = normalizeTitle(cand.name);
  let score: number;
  if (a === b) score = 100;
  else if (stripEditions(a) === stripEditions(b)) score = 96;
  else score = tokenOverlap(a, b) * 85 + (a.startsWith(b) || b.startsWith(a) ? 8 : 0);

  if (old.year && cand.year) {
    const d = Math.abs(old.year - cand.year);
    score += d === 0 ? 8 : d === 1 ? 3 : d >= 4 ? -25 : 0;
  }
  const oldPlatforms = new Set((old.platforms ?? []).map((p) => p.toLowerCase()));
  if (cand.platforms.some((p) => oldPlatforms.has(p.toLowerCase()))) score += 4;
  return score;
}

type MatchStatus = "matched" | "doubt" | "none";

/** Ranks candidates; only an unambiguous top result counts as "matched" (the rest goes to manual review). */
function pickMatch(old: OldGame, candidates: Candidate[]): { status: MatchStatus; best: Candidate | null; candidates: Candidate[] } {
  const ranked = candidates
    .map((c) => ({ ...c, score: scoreCandidate(old, c) }))
    .sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
  const top = ranked[0];
  if (!top) return { status: "none", best: null, candidates: [] };
  const lead = (top.score ?? 0) - (ranked[1]?.score ?? 0);
  const matched = ((top.score ?? 0) >= 100 && lead >= 5) || ((top.score ?? 0) >= 92 && lead >= 8);
  const status: MatchStatus = matched ? "matched" : (top.score ?? 0) >= 60 ? "doubt" : "none";
  return { status, best: matched ? top : null, candidates: ranked.slice(0, 3) };
}

/* ---------- input validation ---------- */

function parseFilters(body: Record<string, unknown>): ListFilters | null {
  const rawSearch = body["search"];
  if (rawSearch !== undefined && rawSearch !== null && typeof rawSearch !== "string") return null;
  const search = (rawSearch as string | null | undefined) ?? "";
  const platform = body["platform"] ?? null;
  const decade = body["decade"] ?? null;
  const page = body["page"] ?? 1;
  if (search.length > 100 || /[\u0000-\u001f]/.test(search)) return null;
  if (search.trim() !== "" && search.trim().length < 2) return null;
  if (platform !== null && !(typeof platform === "string" && platform in PLATFORM_IDS)) return null;
  if (decade !== null && !(typeof decade === "number" && DECADES.includes(decade))) return null;
  if (!(typeof page === "number" && Number.isInteger(page) && page >= 1 && page <= 50)) return null;
  return { search, platform: platform as PlatformGroup | null, decade: decade as number | null, page };
}

const validId = (v: unknown): number | null => (typeof v === "number" && Number.isInteger(v) && v > 0 && v < 100_000_000 ? v : null);

/* ==================== PURE:END ==================== */

/* ---------------- Cache + per-user limit (same design as the rawg function) ---------------- */

class RateLimitError extends Error {}

async function readCache(key: string): Promise<{ payload: unknown; at: number } | null> {
  if (!admin) return null;
  try {
    const { data, error } = await admin.from("rawg_cache").select("payload, fetched_at").eq("key", key).maybeSingle();
    if (error || !data) return null;
    return { payload: data.payload, at: Date.parse(data.fetched_at) };
  } catch {
    return null;
  }
}

async function writeCache(key: string, payload: unknown) {
  if (!admin) return;
  try {
    await admin.from("rawg_cache").upsert({ key, payload, fetched_at: new Date().toISOString() });
  } catch (e) {
    console.warn("[igdb] cache write failed", e);
  }
}

async function bumpUser(userId: string | null) {
  if (!admin || !userId) return;
  try {
    const { data, error } = await admin.rpc("rawg_bump_user", { p_user: userId, p_limit: USER_HOURLY_LIMIT });
    if (error) throw error;
    if (data === false) throw new RateLimitError("rate_limited");
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    console.warn("[igdb] per-user limit unavailable", e);
  }
}

/** Fresh cache hit -> no IGDB call. Otherwise fetch, store, and fall back to a stale copy if IGDB fails. */
async function cached<T>(key: string, ttl: number, fetcher: () => Promise<T>): Promise<T> {
  const hit = await readCache(key);
  if (hit && Date.now() - hit.at < ttl) return hit.payload as T;
  try {
    const value = await fetcher();
    await writeCache(key, value);
    return value;
  } catch (e) {
    if (hit && !(e instanceof Error && e.message === "not_found")) return hit.payload as T;
    throw e;
  }
}

/* ---------------- Twitch token + IGDB calls ---------------- */

let memoryToken: { token: string; exp: number } | null = null;
let failures = 0;
let downUntil = 0; // circuit breaker: after 3 failures in a row, skip IGDB for a minute

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getToken(force = false): Promise<string> {
  if (!CLIENT_ID || !CLIENT_SECRET) throw new Error("missing_key");
  if (!force && memoryToken && Date.now() < memoryToken.exp) return memoryToken.token;
  if (!force) {
    const hit = await readCache("igdb:token");
    const p = hit?.payload as { token?: string; exp?: number } | undefined;
    if (p?.token && p.exp && p.exp > Date.now() + 60_000) {
      memoryToken = { token: p.token, exp: p.exp };
      return p.token;
    }
  }
  const url = `${TOKEN_URL}?client_id=${encodeURIComponent(CLIENT_ID)}&client_secret=${encodeURIComponent(CLIENT_SECRET)}&grant_type=client_credentials`;
  const res = await fetch(url, { method: "POST", signal: AbortSignal.timeout(8000) });
  if (!res.ok) {
    console.error("[igdb] token request failed with status", res.status);
    throw new Error("auth_failed");
  }
  const j = (await res.json()) as { access_token: string; expires_in: number };
  const exp = Date.now() + Math.max(60, j.expires_in - 300) * 1000;
  memoryToken = { token: j.access_token, exp };
  await writeCache("igdb:token", { token: j.access_token, exp });
  return j.access_token;
}

/** POST an Apicalypse query to an IGDB endpoint. `userId` null = no per-user counting (admin work). */
async function igdb<T>(userId: string | null, endpoint: string, body: string): Promise<T> {
  if (Date.now() < downUntil) throw new Error("upstream_down");
  await bumpUser(userId);
  let token = await getToken();
  for (let attempt = 0; attempt < 3; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${IGDB_URL}/${endpoint}`, {
        method: "POST",
        headers: { "Client-ID": CLIENT_ID!, Authorization: `Bearer ${token}`, Accept: "application/json", "Content-Type": "text/plain" },
        body,
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      failures++;
      if (failures >= 3) downUntil = Date.now() + 60_000;
      console.error("[igdb] request failed", endpoint, e instanceof Error ? e.message : e);
      throw new Error("igdb_error");
    }
    if (res.status === 401 && attempt === 0) {
      token = await getToken(true); // token revoked/expired
      continue;
    }
    if (res.status === 429) {
      await sleep(400 * (attempt + 1));
      continue;
    }
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error(`[igdb] ${endpoint} failed with status ${res.status}: ${text.slice(0, 200)}`);
      if (res.status === 400) throw new Error(`bad_query:${text.slice(0, 160)}`);
      failures++;
      if (failures >= 3) downUntil = Date.now() + 60_000;
      throw new Error("igdb_error");
    }
    failures = 0;
    return (await res.json()) as T;
  }
  throw new Error("igdb_error");
}

let websiteVariant = 0; // index into WEBSITE_VARIANTS that IGDB accepted last time

async function fetchDetails(userId: string | null, id: number): Promise<IgdbGame | null> {
  for (let i = websiteVariant; i < WEBSITE_VARIANTS.length; i++) {
    try {
      const rows = await igdb<IgdbGame[]>(userId, "games", `fields ${DETAIL_FIELDS}${WEBSITE_VARIANTS[i]}; where id = ${id};`);
      websiteVariant = i;
      return rows[0] ?? null;
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("bad_query") && i < WEBSITE_VARIANTS.length - 1) continue;
      throw e;
    }
  }
  return null;
}

/** Candidates for a title (cached): used by the importer and the migration. */
async function findCandidates(userId: string | null, name: string): Promise<Candidate[]> {
  const key = `igdb:${CACHE_V}:find:${normalizeTitle(name)}`;
  return cached(key, TTL.find, async () => {
    const rows = await igdb<IgdbGame[]>(
      userId,
      "games",
      `search "${esc(name.slice(0, 100))}"; fields ${LIST_FIELDS}; where parent_game = null & version_parent = null; limit 8;`,
    );
    return rows.map((g) => {
      const s = toSummary(g);
      return { id: s.id, name: s.name, year: s.year, platforms: s.platforms, cover: s.cover, genres: s.genres };
    });
  });
}

function errorCode(e: unknown): "missing_key" | "not_found" | "rate_limited" | "unavailable" {
  if (e instanceof RateLimitError) return "rate_limited";
  if (e instanceof Error && (e.message === "missing_key" || e.message === "not_found")) return e.message;
  return "unavailable";
}

/* ---------------- Who is calling ---------------- */

const approvalCache = new Map<string, { ok: boolean; at: number }>();

interface Caller { id: string | null; approved: boolean }

async function authenticate(req: Request): Promise<Caller> {
  if (!admin) return { id: null, approved: true };
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { id: null, approved: false };
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return { id: null, approved: false };
    const id = data.user.id;
    const hit = approvalCache.get(id);
    if (hit && Date.now() - hit.at < 60_000) return { id, approved: hit.ok };
    const { data: row, error: dbError } = await admin.from("account_approvals").select("status").eq("user_id", id).maybeSingle();
    if (dbError) {
      if (dbError.code === "42P01" || dbError.code === "PGRST205") return { id, approved: true };
      console.warn("[igdb] approval lookup failed", dbError.message);
      return { id, approved: false };
    }
    const ok = row?.status === "approved";
    approvalCache.set(id, { ok, at: Date.now() });
    return { id, approved: ok };
  } catch (e) {
    console.warn("[igdb] approval check failed", e);
    return { id: null, approved: false };
  }
}

/* ---------------- Handlers ---------------- */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

async function maybeCleanup() {
  if (!admin || Math.random() > 0.02) return;
  try {
    await admin.from("rawg_cache").delete().lt("fetched_at", new Date(Date.now() - 60 * DAY).toISOString());
    await admin.from("rawg_user_usage").delete().lt("hour", new Date(Date.now() - 2 * DAY).toISOString());
  } catch {
    /* ignore */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return json({ error: "bad_request" }, 400);
    body = parsed as Record<string, unknown>;
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const caller = await authenticate(req);
  if (!caller.approved) return json({ error: "not_approved" }, 403);
  const userId = caller.id;
  void maybeCleanup();

  const action = body["action"];

  if (action === "search") {
    const f = parseFilters(body);
    if (!f) return json({ error: "bad_request" }, 400);
    const q = buildListQuery(f, Date.now());
    try {
      const res = await cached(`igdb:${CACHE_V}:search:${q.body}`, q.trending ? TTL.trending : TTL.search, async () => {
        const rows = await igdb<IgdbGame[]>(userId, "games", q.body);
        return { results: rows.slice(0, PAGE_SIZE).map(toSummary), hasMore: rows.length > PAGE_SIZE };
      });
      return json({ results: res.results, hasMore: !q.trending && res.hasMore, count: res.results.length });
    } catch (e) {
      const error = errorCode(e);
      return json({ results: [], hasMore: false, count: 0, error: error === "not_found" ? "unavailable" : error });
    }
  }

  if (action === "details") {
    const id = validId(body["id"]);
    if (id === null) return json({ error: "bad_request" }, 400);
    try {
      const game = await cached(`igdb:${CACHE_V}:game:${id}`, TTL.game, async () => {
        const g = await fetchDetails(userId, id);
        if (!g) throw new Error("not_found");
        return toDetails(g);
      });
      return json({ game });
    } catch (e) {
      return json({ game: null, error: errorCode(e) });
    }
  }

  if (action === "match") {
    const items = Array.isArray(body["items"]) ? (body["items"] as unknown[]) : null;
    if (!items || items.length === 0 || items.length > 20) return json({ error: "bad_request" }, 400);
    const results = [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i] as { name?: unknown; year?: unknown; platforms?: unknown };
      if (typeof it?.name !== "string" || it.name.trim().length < 2 || it.name.length > 100) {
        results.push({ index: i, status: "none", best: null, candidates: [] });
        continue;
      }
      try {
        const cands = await findCandidates(userId, it.name);
        const old: OldGame = {
          name: it.name,
          year: typeof it.year === "number" ? it.year : null,
          platforms: Array.isArray(it.platforms) ? it.platforms.filter((p): p is string => typeof p === "string") : [],
        };
        const m = pickMatch(old, cands);
        const full = m.best ? (cands.find((c) => c.id === m.best!.id) as Record<string, unknown> | undefined) : undefined;
        results.push({
          index: i,
          status: m.status,
          best: m.best ? { id: m.best.id, name: m.best.name, year: m.best.year, platforms: m.best.platforms, cover: full?.["cover"] ?? null, genres: full?.["genres"] ?? [] } : null,
          candidates: m.candidates.map((c) => ({ id: c.id, name: c.name, year: c.year })),
        });
        await sleep(120);
      } catch (e) {
        const error = errorCode(e);
        if (error === "rate_limited" || error === "missing_key") return json({ results, error });
        results.push({ index: i, status: "none", best: null, candidates: [], error });
      }
    }
    return json({ results });
  }

  return json({ error: "bad_request" }, 400);
});
