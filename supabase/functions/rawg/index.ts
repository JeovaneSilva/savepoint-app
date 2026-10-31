// Supabase Edge Function: RAWG proxy. Keeps RAWG_API_KEY server-side.
// Deploy:  supabase functions deploy rawg
// Secret:  supabase secrets set RAWG_API_KEY=<sua chave>
// verify_jwt is on by default, so only signed-in users can call it.

const RAWG_BASE = "https://api.rawg.io/api";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

// Small per-instance cache so repeated searches/details don't hit RAWG again.
const TTL_MS = 10 * 60_000;
const MAX = 200;
const cache = new Map<string, { at: number; value: unknown }>();

async function rawgGet<T>(key: string, path: string, params: Record<string, string> = {}): Promise<T> {
  const url = new URL(RAWG_BASE + path);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const cacheKey = url.toString();
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T;

  url.searchParams.set("key", key);
  const res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
  if (!res.ok) {
    console.error(`[rawg] ${path} failed with status ${res.status}`);
    throw new Error(res.status === 404 ? "not_found" : "rawg_error");
  }
  const value = (await res.json()) as T;
  if (cache.size >= MAX) cache.delete(cache.keys().next().value as string);
  cache.set(cacheKey, { at: Date.now(), value });
  return value;
}

// Only these query params are forwarded to RAWG /games.
const ALLOWED_PARAMS = ["page", "page_size", "ordering", "dates", "search", "platforms", "parent_platforms"];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });

  const key = Deno.env.get("RAWG_API_KEY");
  let body: { action?: string; params?: Record<string, unknown>; trending?: boolean; id?: unknown };
  try {
    body = await req.json();
  } catch {
    return json({ error: "bad_request" }, 400);
  }

  if (body.action === "search") {
    if (!key) return json({ results: [], hasMore: false, count: 0, error: "missing_key" });
    const params: Record<string, string> = {};
    for (const k of ALLOWED_PARAMS) {
      const v = body.params?.[k];
      if (typeof v === "string" && v.length <= 200) params[k] = v;
    }
    try {
      const res = await rawgGet<{ count: number; next: string | null; results: RawgGame[] }>(key, "/games", params);
      return json({
        results: res.results.map(toSummary),
        hasMore: !body.trending && !!res.next,
        count: res.count,
      });
    } catch {
      return json({ results: [], hasMore: false, count: 0, error: "unavailable" });
    }
  }

  if (body.action === "details") {
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) return json({ error: "bad_request" }, 400);
    if (!key) return json({ game: null, error: "missing_key" });
    try {
      const [g, shots] = await Promise.all([
        rawgGet<
          RawgGame & { description_raw?: string; developers?: Named[]; publishers?: Named[]; website?: string }
        >(key, `/games/${id}`),
        rawgGet<{ results: { image: string }[] }>(key, `/games/${id}/screenshots`, { page_size: "6" }).catch(() => ({
          results: [],
        })),
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
      return json({ game: null, error: e instanceof Error && e.message === "not_found" ? "not_found" : "unavailable" });
    }
  }

  return json({ error: "bad_request" }, 400);
});
