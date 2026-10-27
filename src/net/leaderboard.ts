// Player identity (kept in localStorage) and calls to the leaderboard API (worker/index.ts).
// Every call fails soft: the game is fully playable offline, it just doesn't rank you.

const ID_KEY = 'sobjir-truck.playerId';
const NAME_KEY = 'sobjir-truck.playerName';
const TIMEOUT_MS = 8000;

export interface BoardRow {
  rank: number;
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
  if (playerName) void api('player', { method: 'POST', body: JSON.stringify({ playerId, name: playerName }) });
  return playerName;
}

export function fetchBoard(): Promise<Board | null> {
  return api<Board>(`leaderboard?player=${encodeURIComponent(playerId)}`);
}

/** Records a finished run; the server computes the points. Retries once (same runId, so it can't double count). */
export async function submitRun(run: RunSubmit): Promise<{ points: number; me: BoardRow } | null> {
  if (!playerName) return null;
  const body = JSON.stringify({ ...run, playerId, name: playerName, runId: newId() });
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await api<{ points: number; me: BoardRow }>('runs', { method: 'POST', body });
    if (res) return res;
  }
  return null;
}
