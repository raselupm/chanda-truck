// Cloudflare Worker: the leaderboard API under /api/*. Every other path is served from dist/ (static assets).
// Data lives in the D1 database bound as DB (see migrations/ and wrangler.jsonc).

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

interface PlayerRow {
  id: string;
  name: string;
  total_points: number;
  best_points: number;
  runs: number;
  deliveries: number;
  total_profit: number;
}

const TOP_N = 20;
/** a run can't finish faster than this, so faster submits from one player are rejected */
const MIN_SECONDS_BETWEEN_RUNS = 20;
const MAX_PROFIT = maxProfit();
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

/** 1, 2, 3… — every player gets their own position. */
async function rankOf(db: D1Database, playerId: string): Promise<number> {
  const row = await db
    .prepare(`SELECT pos FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY ${ORDER}) AS pos FROM players WHERE runs > 0) WHERE id = ?`)
    .bind(playerId)
    .first<{ pos: number }>();
  return row?.pos ?? 0;
}

const publicRow = (p: PlayerRow, rank: number) => ({
  rank,
  name: p.name,
  total: p.total_points,
  best: p.best_points,
  runs: p.runs,
  deliveries: p.deliveries,
});

/** POST /api/player {playerId, name} — create the player or rename them. */
async function savePlayer(req: Request, db: D1Database): Promise<Response> {
  const body = await readJson(req);
  const id = body?.playerId;
  const name = cleanName(body?.name);
  if (typeof id !== 'string' || !ID_RE.test(id)) return bad('invalid playerId');
  if (!name) return bad('invalid name');
  const now = Date.now();
  await db
    .prepare(
      `INSERT INTO players (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)
       ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
    )
    .bind(id, name, now)
    .run();
  return json({ ok: true, name });
}

/** POST /api/runs — record a finished run; the server computes the points itself. */
async function saveRun(req: Request, db: D1Database): Promise<Response> {
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

  const now = Date.now();
  const dup = await db.prepare('SELECT points FROM runs WHERE id = ?').bind(runId).first<{ points: number }>();
  if (!dup) {
    const last = await db
      .prepare('SELECT MAX(created_at) AS t FROM runs WHERE player_id = ?')
      .bind(playerId)
      .first<{ t: number | null }>();
    if (last?.t && now - last.t < MIN_SECONDS_BETWEEN_RUNS * 1000) return bad('too many runs', 429);

    const arrived = outcome === 'arrived';
    const { points } = computeScore({ arrived, profit, driveTime, distance });
    await db.batch([
      db
        .prepare(
          `INSERT INTO players (id, name, created_at, updated_at) VALUES (?1, ?2, ?3, ?3)
           ON CONFLICT (id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at`,
        )
        .bind(playerId, name, now),
      db
        .prepare(
          `INSERT INTO runs (id, player_id, start_id, outcome, profit, drive_time, distance, points, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(runId, playerId, startId, outcome, Math.round(profit), driveTime, Math.round(distance), points, now),
      db
        .prepare(
          `UPDATE players SET total_points = total_points + ?1, best_points = MAX(best_points, ?1), runs = runs + 1,
             deliveries = deliveries + ?2, total_profit = total_profit + ?3 WHERE id = ?4`,
        )
        .bind(points, arrived ? 1 : 0, Math.round(profit), playerId),
    ]);
  }

  const me = await db.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first<PlayerRow>();
  if (!me) return bad('player missing', 500);
  const points = dup?.points ?? (await db.prepare('SELECT points FROM runs WHERE id = ?').bind(runId).first<{ points: number }>())?.points ?? 0;
  return json({ points, me: publicRow(me, await rankOf(db, playerId)) });
}

/** GET /api/leaderboard?player=<id> — the top players, plus the asking player's own row. */
async function leaderboard(url: URL, db: D1Database): Promise<Response> {
  const { results } = await db
    .prepare(`SELECT * FROM players WHERE runs > 0 ORDER BY ${ORDER} LIMIT ?`)
    .bind(TOP_N)
    .all<PlayerRow>();
  const playerId = url.searchParams.get('player');
  const top = results.map((p, i) => ({ ...publicRow(p, i + 1), mine: p.id === playerId }));

  let me = null;
  if (playerId && ID_RE.test(playerId)) {
    const row = await db.prepare('SELECT * FROM players WHERE id = ?').bind(playerId).first<PlayerRow>();
    if (row) me = publicRow(row, await rankOf(db, row.id));
  }
  return json({ top, me });
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (url.pathname === '/api/leaderboard' && req.method === 'GET') return await leaderboard(url, env.DB);
      if (url.pathname === '/api/player' && req.method === 'POST') return await savePlayer(req, env.DB);
      if (url.pathname === '/api/runs' && req.method === 'POST') return await saveRun(req, env.DB);
      return bad('not found', 404);
    } catch (e) {
      console.error(e);
      return bad('server error', 500);
    }
  },
};
