// Supabase Edge Function: RAWG proxy with a shared cache, request limits and an account check.
//
// - RAWG_API_KEY stays server-side (secret).
// - Responses are cached in the `rawg_cache` table (see migrations/0001_rawg_cache.sql), so friends
//   opening the same games cost a single RAWG request in total.
// - Every real RAWG call (a cache miss) is counted twice:
//     * per user, per hour, in `rawg_user_usage`: past RAWG_USER_HOURLY_LIMIT (default 300) that user gets
//       error "rate_limited", so one person can't burn the shared monthly quota;
//     * per month, in `rawg_usage`: past RAWG_MONTHLY_LIMIT (default 18000) everyone gets error "quota".
//   Answers that come from the cache are always free.
// - Search parameters are validated (format and range); anything unexpected is rejected with 400.
// - If the cache/usage tables are missing, the function still works (just without caching/counting).
// - verify_jwt is on by default, so only signed-in users can call it.
// - Only APPROVED accounts (see migrations/0007_account_approval.sql) may use it, so a pending or blocked
//   account can't spend the RAWG quota. (If that table doesn't exist yet, the check is skipped.)

import { createClient } from "npm:@supabase/supabase-js@2";

const RAWG_BASE = "https://api.rawg.io/api";
const MONTHLY_LIMIT = Number(Deno.env.get("RAWG_MONTHLY_LIMIT") ?? "18000");
const USER_HOURLY_LIMIT = Number(Deno.env.get("RAWG_USER_HOURLY_LIMIT") ?? "300");

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const TTL = { trending: 6 * HOUR, search: DAY, game: 30 * DAY, shots: 30 * DAY };

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const admin = supabaseUrl && serviceKey ? createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } }) : null;

type Named = { name: string; slug?: string };
interface RawgGame {
  id: number;
  name: string;
  background_image: string | null;
  released: string | null;
  metacritic: number | null;
  platforms?: { platform: Named }[] | null;
  parent_platforms?: { platform: Named }[] | null;
  genres?: Named[] | null;
  description_raw?: string;
  developers?: Named[];
  publishers?: Named[];
  website?: string;
}

function toSummary(g: RawgGame) {
  return {
    id: g.id,
    name: g.name,
    cover: g.background_image ?? null,
    year: g.released ? Number(g.released.slice(0, 4)) : null,
    platforms: (g.platforms ?? []).map((p) => p.platform.name),
    parentPlatforms: (g.parent_platforms ?? []).map((p) => p.platform.slug ?? p.platform.name),
    genres: (g.genres ?? []).map((x) => x.name),
    metacritic: g.metacritic ?? null,
  };
}

/* ---------------- Cache + quotas ---------------- */

class QuotaError extends Error {}
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
    console.warn("[rawg] cache write failed", e);
  }
}

/** Cheap housekeeping: now and then, drop stale cache entries (60 days) and old per-user counters (2 days). */
async function maybeCleanup() {
  if (!admin || Math.random() > 0.02) return;
  try {
    await admin.from("rawg_cache").delete().lt("fetched_at", new Date(Date.now() - 60 * DAY).toISOString());
    await admin.from("rawg_user_usage").delete().lt("hour", new Date(Date.now() - 2 * DAY).toISOString());
  } catch {
    /* ignore */
  }
}

async function bumpUsage() {
  if (!admin) return;
  try {
    const month = new Date().toISOString().slice(0, 7);
    const { data, error } = await admin.rpc("rawg_bump_usage", { p_month: month, p_n: 1 });
    if (error) throw error;
    if (typeof data === "number" && data > MONTHLY_LIMIT) throw new QuotaError("quota");
  } catch (e) {
    if (e instanceof QuotaError) throw e;
    console.warn("[rawg] usage counter unavailable", e);
  }
}

/** Counts one RAWG-bound request for this user in the current hour; throws when they are over the limit. */
async function bumpUser(userId: string | null) {
  if (!admin || !userId) return;
  try {
    const { data, error } = await admin.rpc("rawg_bump_user", { p_user: userId, p_limit: USER_HOURLY_LIMIT });
    if (error) throw error;
    if (data === false) throw new RateLimitError("rate_limited");
  } catch (e) {
    if (e instanceof RateLimitError) throw e;
    console.warn("[rawg] per-user limit unavailable", e); // e.g. migration 0008 not applied: keep working
  }
}

/** Fresh cache hit -> no RAWG call. Otherwise fetch, store, and fall back to a stale copy if RAWG fails. */
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

async function rawgFetch<T>(userId: string | null, path: string, params: Record<string, string> = {}): Promise<T> {
  const key = Deno.env.get("RAWG_API_KEY");
  if (!key) throw new Error("missing_key");
  await bumpUser(userId);
  await bumpUsage();
  const url = new URL(RAWG_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("key", key);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`[rawg] ${path} failed with status ${res.status}`);
    throw new Error(res.status === 404 ? "not_found" : "rawg_error");
  }
  return (await res.json()) as T;
}

function errorCode(e: unknown): "missing_key" | "not_found" | "quota" | "rate_limited" | "unavailable" {
  if (e instanceof QuotaError) return "quota";
  if (e instanceof RateLimitError) return "rate_limited";
  if (e instanceof Error && (e.message === "missing_key" || e.message === "not_found")) return e.message;
  return "unavailable";
}

/* ---------------- Who is calling, and are they approved? ---------------- */

const approvalCache = new Map<string, { ok: boolean; at: number }>();
const APPROVAL_TTL_MS = 60_000;

interface Caller {
  id: string | null;
  approved: boolean;
}

/** Looks the user up from the JWT (already verified by the gateway) and checks that the account is approved. */
async function authenticate(req: Request): Promise<Caller> {
  if (!admin) return { id: null, approved: true }; // can't check: don't lock everyone out
  const token = req.headers.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return { id: null, approved: false };
  try {
    const { data, error } = await admin.auth.getUser(token);
    if (error || !data.user) return { id: null, approved: false };
    const id = data.user.id;

    const hit = approvalCache.get(id);
    if (hit && Date.now() - hit.at < APPROVAL_TTL_MS) return { id, approved: hit.ok };

    const { data: row, error: dbError } = await admin
      .from("account_approvals")
      .select("status")
      .eq("user_id", id)
      .maybeSingle();
    if (dbError) {
      // Migration 0007 not applied yet: keep working. Any other DB error: stay closed.
      if (dbError.code === "42P01" || dbError.code === "PGRST205") return { id, approved: true };
      console.warn("[rawg] approval lookup failed", dbError.message);
      return { id, approved: false };
    }
    const ok = row?.status === "approved";
    approvalCache.set(id, { ok, at: Date.now() });
    return { id, approved: ok };
  } catch (e) {
    console.warn("[rawg] approval check failed", e);
    return { id: null, approved: false };
  }
}

/* ---------------- Input validation ---------------- */

const RULES: Record<string, (v: string) => boolean> = {
  // The app only searches with 2+ characters (shorter terms mean "trending", sent without `search`).
  search: (v) => v.length >= 2 && v.length <= 100 && !/[\u0000-\u001f]/.test(v),
  page: (v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 50,
  page_size: (v) => /^\d{1,2}$/.test(v) && Number(v) >= 1 && Number(v) <= 24,
  ordering: (v) => v === "-added",
  dates: (v) => /^\d{4}-\d{2}-\d{2},\d{4}-\d{2}-\d{2}$/.test(v),
  platforms: (v) => /^\d{1,4}(,\d{1,4}){0,39}$/.test(v),
  parent_platforms: (v) => /^\d{1,2}$/.test(v),
};

/** Keeps only known params with valid values. Returns null if any param is unknown or invalid. */
function sanitizeParams(raw: unknown): Record<string, string> | null {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    const rule = RULES[k];
    if (!rule || typeof v !== "string" || !rule(v)) return null;
    out[k] = v;
  }
  return out;
}

/* ---------------- Handlers ---------------- */

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const validId = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 && n <= 100_000_000 ? n : null;
};

const getGame = (userId: string | null, id: number) =>
  cached(`game:${id}`, TTL.game, () => rawgFetch<RawgGame>(userId, `/games/${id}`));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { action?: string; params?: unknown; trending?: boolean; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  const caller = await authenticate(req);
  if (!caller.approved) return json({ error: "not_approved" }, 403);
  const userId = caller.id;

  void maybeCleanup();

  if (body.action === "search") {
    const params = sanitizeParams(body.params);
    if (!params) return json({ error: "bad_request" }, 400);

    const sorted = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
    const trending = !params["search"];
    try {
      const res = await cached(
        `search:${JSON.stringify(sorted)}`,
        trending ? TTL.trending : TTL.search,
        async () => {
          const r = await rawgFetch<{ count: number; next: string | null; results: RawgGame[] }>(userId, "/games", params);
          return { results: r.results.map(toSummary), next: !!r.next, count: r.count };
        },
      );
      return json({ results: res.results, hasMore: !body.trending && res.next, count: res.count });
    } catch (e) {
      const error = errorCode(e);
      return json({ results: [], hasMore: false, count: 0, error: error === "not_found" ? "unavailable" : error });
    }
  }

  if (body.action === "cover" || body.action === "details") {
    const id = validId(body.id);
    if (id === null) return json({ error: "bad_request" }, 400);
    try {
      if (body.action === "cover") return json({ game: toSummary(await getGame(userId, id)) });

      const [g, shots] = await Promise.all([
        getGame(userId, id),
        cached(`shots:${id}`, TTL.shots, () =>
          rawgFetch<{ results: { image: string }[] }>(userId, `/games/${id}/screenshots`, { page_size: "6" }),
        ).catch(() => ({ results: [] as { image: string }[] })),
      ]);
      return json({
        game: {
          ...toSummary(g),
          released: g.released ?? null,
          description: g.description_raw ?? "",
          developers: (g.developers ?? []).map((d) => d.name),
          publishers: (g.publishers ?? []).map((p) => p.name),
          website: g.website || null,
          screenshots: shots.results.map((s) => s.image),
        },
      });
    } catch (e) {
      return json({ game: null, error: errorCode(e) });
    }
  }

  return json({ error: "bad_request" }, 400);
});
