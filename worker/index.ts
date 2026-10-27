// Cloudflare Worker: the leaderboard API under /api/*. Every other path is served from dist/ (static assets).
// Data lives in the D1 database bound as DB (see migrations/ and wrangler.jsonc): just the top 100 players.

import { START_POINTS } from '../src/config/route';
import { computeScore, maxProfit, minDriveTime } from '../src/game/Score';

// Minimal D1 / assets typings, so the worker needs no extra type packages.
interface D1Result<T> {
  results: T[];
}
interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
interface D1Database {
  prepare(sql: string): D1PreparedStatement;
  batch(statements: D1PreparedStatement[]): Promise<unknown>;
}
interface Env {
  DB: D1Database;
  ASSETS: { fetch(req: Request): Promise<Response> };
}
interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

interface LeaderRow {
  id: string;
  name: string;
  total_points: number;
  best_points: number;
  runs: number;
  deliveries: number;
  total_profit: number;
  best_route: string | null;
  created_at: number;
  last_run_id: string | null;
  last_run_at: number;
}

/** A player's running totals (the browser keeps them; the board only holds the top players). */
interface Totals {
  total: number;
  best: number;
  runs: number;
  deliveries: number;
  profit: number;
  route: string | null;
}

const TOP_N = 100;
/** a run can't finish faster than this, so faster submits from one player are rejected */
const MIN_SECONDS_BETWEEN_RUNS = 20;
const MAX_PROFIT = maxProfit();
/** most points one run can earn: the best possible profit, driven at the fastest bonus */
const MAX_RUN_POINTS = computeScore({ arrived: true, profit: MAX_PROFIT, driveTime: 1, distance: 1e9 }).points;
const DISTANCE_RANGE = [5_000, 60_000] as const;
const ID_RE = /^[a-zA-Z0-9-]{16,64}$/;
const OUTCOMES = ['arrived', 'crash', 'toll', 'helper'];

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
const bad = (error: string, status = 400) => json({ error }, status);

/** Trim, drop control characters, collapse spaces, max 24 characters. */
function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const name = [...raw.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, 24).join('');
  return name.length > 0 ? name : null;
}

async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Leaderboard order: points, then best run, deliveries, profit; whoever got there first wins a full tie. */
const ORDER = 'total_points DESC, best_points DESC, deliveries DESC, total_profit DESC, created_at ASC';

/** Totals the browser claims for a player not on the board: must be ones real runs could add up to. */
function claimedTotals(raw: unknown): Totals | null {
  if (!raw || typeof raw !== 'object') return null;
  const t = raw as Record<string, unknown>;
  const [total, best, runs, deliveries, profit] = [t.total, t.best, t.runs, t.deliveries, t.profit].map(Number);
  if (![total, best, runs, deliveries].every((n) => Number.isInteger(n) && n >= 0)) return null;
  if (!Number.isFinite(profit) || deliveries > runs || best > total || best > MAX_RUN_POINTS) return null;
  if (total > deliveries * MAX_RUN_POINTS || profit > deliveries * MAX_PROFIT) return null;
  const route = typeof t.route === 'string' && START_POINTS.some((p) => p.id === t.route) ? t.route : null;
  return { total, best, runs, deliveries, profit: Math.round(profit), route };
}

const totalsOf = (r: LeaderRow): Totals => ({
  total: r.total_points,
  best: r.best_points,
  runs: r.runs,
  deliveries: r.deliveries,
  profit: r.total_profit,
  route: r.best_route,
});

const publicRow = (r: LeaderRow, rank: number) => ({
  rank,
  route: r.best_route,
  name: r.name,
  total: r.total_points,
  best: r.best_points,
  runs: r.runs,
  deliveries: r.deliveries,
});

/** POST /api/player {playerId, name}: rename a player (only matters while they're on the board). */
async function savePlayer(req: Request, db: D1Database, ctx: Ctx): Promise<Response> {
  const body = await readJson(req);
  const id = body?.playerId;
  const name = cleanName(body?.name);
  if (typeof id !== 'string' || !ID_RE.test(id)) return bad('invalid playerId');
  if (!name) return bad('invalid name');
  await db.prepare('UPDATE leaders SET name = ?2 WHERE id = ?1 AND name <> ?2').bind(id, name).run();
  ctx.waitUntil(topCache().delete(TOP_CACHE_KEY));
  return json({ ok: true, name });
}

/**
 * POST /api/runs: a finished run that scored points, with the player's totals before it. The server
 * computes the points itself. Runs without points never reach here: they can't change the board.
 */
async function saveRun(req: Request, db: D1Database, ctx: Ctx): Promise<Response> {
  const b = await readJson(req);
  if (!b) return bad('invalid body');
  const { playerId, runId, startId, outcome } = b;
  const name = cleanName(b.name);
  const profit = Number(b.profit);
  const driveTime = Number(b.driveTime);
  const distance = Number(b.distance);
  if (typeof playerId !== 'string' || !ID_RE.test(playerId)) return bad('invalid playerId');
  if (typeof runId !== 'string' || !ID_RE.test(runId)) return bad('invalid runId');
  if (!name) return bad('invalid name');
  if (typeof startId !== 'string' || !START_POINTS.some((p) => p.id === startId)) return bad('invalid startId');
  if (typeof outcome !== 'string' || !OUTCOMES.includes(outcome)) return bad('invalid outcome');
  if (![profit, driveTime, distance].every(Number.isFinite)) return bad('invalid numbers');
  // Reject runs no real game could produce
  if (profit > MAX_PROFIT || profit < -1_000_000) return bad('impossible profit');
  if (distance < DISTANCE_RANGE[0] || distance > DISTANCE_RANGE[1]) return bad('impossible distance');
  // A crash can end a run early, but an arrival covered the whole highway
  const minTime = outcome === 'arrived' ? minDriveTime(distance) : 0;
  if (driveTime < minTime || driveTime > 24 * 3600) return bad('impossible drive time');

  // The whole board is at most 100 rows: read it, work out the new standing here
  const { results: board } = await db.prepare(`SELECT * FROM leaders ORDER BY ${ORDER}`).all<LeaderRow>();
  const row = board.find((r) => r.id === playerId);
  const { points } = computeScore({ arrived: outcome === 'arrived', profit, driveTime, distance });
  const now = Date.now();

  // On the board, the server's totals count; off it, the browser's (checked for plausibility)
  const before = row ? totalsOf(row) : claimedTotals(b.before);
  if (!before) return bad('invalid totals');
  if (row?.last_run_id === runId) return json({ points, me: { ...totalsOf(row), rank: board.indexOf(row) + 1 }, top: listed(board, playerId) });
  if (row && now - row.last_run_at < MIN_SECONDS_BETWEEN_RUNS * 1000) return bad('too many runs', 429);

  const after: Totals = {
    total: before.total + points,
    best: Math.max(before.best, points),
    runs: before.runs + 1,
    deliveries: before.deliveries + (outcome === 'arrived' ? 1 : 0),
    profit: before.profit + Math.round(profit),
    route: points > before.best || !before.route ? startId : before.route,
  };
  const me: LeaderRow = {
    id: playerId,
    name,
    total_points: after.total,
    best_points: after.best,
    runs: after.runs,
    deliveries: after.deliveries,
    total_profit: after.profit,
    best_route: after.route,
    created_at: row?.created_at ?? now,
    last_run_id: runId,
    last_run_at: now,
  };
  const others = board.filter((r) => r !== row);
  const ranked = [...others, me].sort(compare);
  const rank = ranked.indexOf(me) + 1;
  if (points <= 0 || rank > TOP_N) return json({ points, me: { ...after, rank: null }, top: listed(board, playerId) });

  await db.batch([
    db
      .prepare(
        `INSERT INTO leaders (id, name, total_points, best_points, runs, deliveries, total_profit, best_route, created_at, last_run_id, last_run_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
         ON CONFLICT (id) DO UPDATE SET name = ?2, total_points = ?3, best_points = ?4, runs = ?5, deliveries = ?6,
           total_profit = ?7, best_route = ?8, last_run_id = ?10, last_run_at = ?11`,
      )
      .bind(me.id, me.name, me.total_points, me.best_points, me.runs, me.deliveries, me.total_profit, me.best_route, me.created_at, runId, now),
    // whoever fell off the bottom is gone
    db.prepare(`DELETE FROM leaders WHERE id NOT IN (SELECT id FROM leaders ORDER BY ${ORDER} LIMIT ?)`).bind(TOP_N),
  ]);
  ctx.waitUntil(topCache().delete(TOP_CACHE_KEY));
  // the new board goes back with the answer, so the browser needn't download it again
  return json({ points, me: { ...after, rank }, top: listed(ranked.slice(0, TOP_N), playerId) });
}

/** Same order as ORDER, for rows in memory. */
function compare(a: LeaderRow, b: LeaderRow): number {
  return (
    b.total_points - a.total_points ||
    b.best_points - a.best_points ||
    b.deliveries - a.deliveries ||
    b.total_profit - a.total_profit ||
    a.created_at - b.created_at
  );
}

/** The top list is the same for everybody: kept in Cloudflare's edge cache for a minute. */
const TOP_CACHE_KEY = 'https://leaderboard.internal/top';
const TOP_CACHE_SECONDS = 60;
const topCache = () => (caches as unknown as { default: Cache }).default;

async function topPlayers(db: D1Database, ctx: Ctx): Promise<LeaderRow[]> {
  const hit = await topCache().match(TOP_CACHE_KEY);
  if (hit) return hit.json();
  const { results } = await db.prepare(`SELECT * FROM leaders ORDER BY ${ORDER} LIMIT ?`).bind(TOP_N).all<LeaderRow>();
  const res = new Response(JSON.stringify(results), { headers: { 'Cache-Control': `max-age=${TOP_CACHE_SECONDS}` } });
  ctx.waitUntil(topCache().put(TOP_CACHE_KEY, res));
  return results;
}

/** The board as players see it (ids stay private), the asking player's row marked. */
const listed = (rows: LeaderRow[], playerId: string | null) => rows.map((r, i) => ({ ...publicRow(r, i + 1), mine: r.id === playerId }));

/** GET /api/leaderboard?player=<id>: the top players. Browsers keep it for an hour (src/net/leaderboard.ts). */
async function leaderboard(url: URL, db: D1Database, ctx: Ctx): Promise<Response> {
  return json({ top: listed(await topPlayers(db, ctx), url.searchParams.get('player')) });
}

export default {
  async fetch(req: Request, env: Env, ctx: Ctx): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') return await leaderboard(url, env.DB, ctx);
      if (url.pathname === '/api/player' && req.method === 'POST') return await savePlayer(req, env.DB, ctx);
      if (url.pathname === '/api/runs' && req.method === 'POST') return await saveRun(req, env.DB, ctx);
      return bad('not found', 404);
    } catch (e) {
      console.error(e);
      return bad('server error', 500);
    }
  },
};
