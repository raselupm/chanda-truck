// Player identity and running totals (kept in localStorage) and calls to the leaderboard API (worker/index.ts).
// The server only keeps the top 100, so each player's own progress lives here in the browser. The board
// is downloaded at most once an hour, and a run is sent only when it would get onto it.
// Every call fails soft: the game is fully playable offline, it just doesn't rank you.

import { computeScore } from '../game/Score';

const ID_KEY = 'sobjir-truck.playerId';
const NAME_KEY = 'sobjir-truck.playerName';
const TOTALS_KEY = 'sobjir-truck.totals';
const BOARD_KEY = 'sobjir-truck.board';
/** a downloaded board is used for this long before it's fetched again */
const BOARD_TTL_MS = 60 * 60 * 1000;
/** the server keeps this many players */
const BOARD_SIZE = 100;
const TIMEOUT_MS = 8000;

export interface BoardRow {
  /** null: not in the top 100 */
  rank: number | null;
  /** start point id of the player's best run */
  route: string | null;
  name: string;
  total: number;
  best: number;
  runs: number;
  deliveries: number;
}

export interface Board {
  top: (BoardRow & { mine: boolean })[];
  me: BoardRow | null;
}

/** A player's running totals across all their runs. */
export interface Totals {
  total: number;
  best: number;
  runs: number;
  deliveries: number;
  profit: number;
  /** start point id of the best run */
  route: string | null;
}

export interface RunSubmit {
  startId: string;
  outcome: string;
  profit: number;
  driveTime: number;
  distance: number;
}

function load(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: identity lasts for this session only */
  }
}

export function newId(): string {
  if (crypto.randomUUID) return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
}

let playerId = load(ID_KEY) ?? '';
if (!playerId) {
  playerId = newId();
  store(ID_KEY, playerId);
}
let playerName = load(NAME_KEY) ?? '';

let totals: Totals = { total: 0, best: 0, runs: 0, deliveries: 0, profit: 0, route: null };
try {
  totals = { ...totals, ...JSON.parse(load(TOTALS_KEY) ?? '{}') };
} catch {
  /* unreadable: start over */
}
function saveTotals(t: Totals): void {
  totals = t;
  store(TOTALS_KEY, JSON.stringify(t));
}

type TopRow = Board['top'][number];
/** the last downloaded board and when it was fetched */
let cached: { at: number; top: TopRow[] } | null = null;
try {
  cached = JSON.parse(load(BOARD_KEY) ?? 'null');
} catch {
  /* unreadable: download again */
}
function saveBoard(top: TopRow[], at = Date.now()): void {
  cached = { at, top };
  store(BOARD_KEY, JSON.stringify(cached));
}

export const player = {
  get id(): string {
    return playerId;
  },
  get name(): string {
    return playerName;
  },
};

/** Same cleaning the server does: no control characters, single spaces, max 24 characters. */
export function cleanName(raw: string): string {
  return [...raw.replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim()].slice(0, 24).join('');
}

async function api<T>(path: string, init?: RequestInit): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`/api/${path}`, {
      ...init,
      signal: ctrl.signal,
      headers: init?.body ? { 'Content-Type': 'application/json' } : undefined,
    });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Save the name locally right away and on the server in the background. */
export function setPlayerName(raw: string): string {
  playerName = cleanName(raw);
  store(NAME_KEY, playerName);
  // the name only lives on the server while the player is on the board
  const mine = cached?.top.find((r) => r.mine);
  if (playerName && mine) {
    mine.name = playerName;
    saveBoard(cached!.top, cached!.at);
    void api('player', { method: 'POST', body: JSON.stringify({ playerId, name: playerName }) });
  }
  return playerName;
}

/** This player's row from their own totals (ranked only when they're in the top list). */
function myRow(rank: number | null): BoardRow {
  return { rank, name: playerName, ...totals };
}

/** The board, downloaded at most once an hour (the copy on this device is used in between). */
export async function fetchBoard(): Promise<Board | null> {
  if (!cached || Date.now() - cached.at > BOARD_TTL_MS) {
    const res = await api<Pick<Board, 'top'>>(`leaderboard?player=${encodeURIComponent(playerId)}`);
    if (res) saveBoard(res.top);
    else if (!cached) return null;
  }
  const top = cached!.top;
  return { top, me: top.find((r) => r.mine) ?? myRow(null) };
}

/** Whether these totals would make the board (or the player is on it already, so their row must change). */
function makesBoard(t: Totals): boolean {
  if (!cached || cached.top.some((r) => r.mine) || cached.top.length < BOARD_SIZE) return true;
  const last = cached.top[cached.top.length - 1];
  return t.total > last.total || (t.total === last.total && t.best > last.best);
}

/**
 * Adds a finished run to the player's totals and, if it scored, sends it to the leaderboard (the server
 * computes the points itself). Retries once (same runId, so it can't double count). Null: not saved.
 */
export async function submitRun(run: RunSubmit): Promise<{ points: number; me: BoardRow } | null> {
  if (!playerName) return null;
  const before = totals;
  const { points } = computeScore({ arrived: run.outcome === 'arrived', ...run });
  saveTotals({
    total: before.total + points,
    best: Math.max(before.best, points),
    runs: before.runs + 1,
    deliveries: before.deliveries + (run.outcome === 'arrived' ? 1 : 0),
    profit: before.profit + Math.round(run.profit),
    route: points > before.best || !before.route ? run.startId : before.route,
  });
  // no points, or still below the last place on the board: nothing to send
  if (points <= 0 || !makesBoard(totals)) return { points, me: myRow(null) };

  const body = JSON.stringify({ ...run, playerId, name: playerName, runId: newId(), before });
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await api<{ points: number; me: Totals & { rank: number | null }; top: TopRow[] }>('runs', { method: 'POST', body });
    if (res) {
      // the answer carries the fresh board: no need to download it again
      saveBoard(res.top);
      // the board's record of a top player wins (e.g. playing from a second browser)
      const { rank, ...t } = res.me;
      saveTotals(t);
      return { points: res.points, me: myRow(rank) };
    }
  }
  return null;
}
