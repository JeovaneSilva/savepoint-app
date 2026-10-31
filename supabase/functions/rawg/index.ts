// Supabase Edge Function: RAWG proxy with a shared cache and a monthly request guard.
//
// - RAWG_API_KEY stays server-side (secret).
// - Responses are cached in the `rawg_cache` table (see migrations/0001_rawg_cache.sql), so friends
//   opening the same games cost a single RAWG request in total.
// - Every real RAWG call is counted in `rawg_usage`; past RAWG_MONTHLY_LIMIT (default 18000) the
//   function only answers from cache and reports error "quota".
// - If the cache tables are missing, the function still works (just without caching/counting).
// - verify_jwt is on by default, so only signed-in users can call it.

import { createClient } from "npm:@supabase/supabase-js@2";

const RAWG_BASE = "https://api.rawg.io/api";
const MONTHLY_LIMIT = Number(Deno.env.get("RAWG_MONTHLY_LIMIT") ?? "18000");

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

/* ---------------- Cache + quota ---------------- */

class QuotaError extends Error {}

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

/** Cheap housekeeping: now and then, drop entries that haven't been refreshed in 60 days. */
async function maybeCleanup() {
  if (!admin || Math.random() > 0.02) return;
  try {
    await admin.from("rawg_cache").delete().lt("fetched_at", new Date(Date.now() - 60 * DAY).toISOString());
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

async function rawgFetch<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const key = Deno.env.get("RAWG_API_KEY");
  if (!key) throw new Error("missing_key");
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

function errorCode(e: unknown): "missing_key" | "not_found" | "quota" | "unavailable" {
  if (e instanceof QuotaError) return "quota";
  if (e instanceof Error && (e.message === "missing_key" || e.message === "not_found")) return e.message;
  return "unavailable";
}

/* ---------------- Handlers ---------------- */

// Only these query params are forwarded to RAWG /games.
const ALLOWED_PARAMS = ["page", "page_size", "ordering", "dates", "search", "platforms", "parent_platforms"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

const getGame = (id: number) => cached(`game:${id}`, TTL.game, () => rawgFetch<RawgGame>(`/games/${id}`));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  let body: { action?: string; params?: Record<string, unknown>; trending?: boolean; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  void maybeCleanup();

  if (body.action === "search") {
    const params: Record<string, string> = {};
    for (const k of ALLOWED_PARAMS) {
      const v = body.params?.[k];
      if (typeof v === "string" && v.length <= 200) params[k] = v;
    }
    const sorted = Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b)));
    const trending = !params["search"];
    try {
      const res = await cached(
        `search:${JSON.stringify(sorted)}`,
        trending ? TTL.trending : TTL.search,
        async () => {
          const r = await rawgFetch<{ count: number; next: string | null; results: RawgGame[] }>("/games", params);
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
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: "bad_request" }, 400);
    try {
      if (body.action === "cover") return json({ game: toSummary(await getGame(id)) });

      const [g, shots] = await Promise.all([
        getGame(id),
        cached(`shots:${id}`, TTL.shots, () =>
          rawgFetch<{ results: { image: string }[] }>(`/games/${id}/screenshots`, { page_size: "6" }),
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
