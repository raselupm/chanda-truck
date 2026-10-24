// Routes: the player picks a starting district; each start has an ordered list of legal toll stops.
// Illegal chanda barriers are scattered randomly between them every run (generateRoute).
// Distances (s, metres along the track) are compressed for gameplay.

import { ECONOMY, type FeeKey } from './economy';
import { RAIL, SLOW_ZONES } from './tuning';
import type { VegId } from './vegetables';
import { toBnDigits } from '../utils/bnNumber';
import { mulberry32, range, type Rng } from '../utils/rng';

interface EventBase {
  id: string;
  s: number;
  nameBn: string;
  icon: string;
}

export interface FarmEvent extends EventBase {
  type: 'farm';
  /** -1 = field on the left of the road, 1 = right */
  side: -1 | 1;
  vegetables: VegId[];
  farmerLineBn: string;
}

export interface BarrierEvent extends EventBase {
  type: 'barrier';
  /** ৳ demanded at this barrier */
  chanda: number;
  workers: number;
}

export type BridgeStyle = 'jamuna' | 'padma' | 'lalon';

export interface TollEvent extends EventBase {
  /** roadTax = ROAD_TAX ledger category; roadToll / bridgeToll = TOLL */
  type: 'roadTax' | 'roadToll' | 'bridgeToll';
  feeKey: FeeKey;
  /** single-booth plaza instead of the full canopy */
  small?: boolean;
  bridge?: {
    nameBn: string;
    style: BridgeStyle;
    /** metres from the toll stop line to the bridge start */
    offset: number;
    length: number;
  };
}

/** Railway level crossing: sometimes the gates close and a train passes. */
export interface RailEvent extends EventBase {
  type: 'rail';
}

export interface MarketEvent extends EventBase {
  type: 'market';
}

export type RouteEvent = FarmEvent | BarrierEvent | TollEvent | RailEvent | MarketEvent;

export interface SlowZone {
  from: number;
  to: number;
  kind: 'bazar' | 'school' | 'market';
  limitKmh: number;
  /** side of the road the school / sign cluster is on */
  side: -1 | 1;
}

export interface RouteDef {
  id: string;
  nameBn: string;
  descriptionBn: string;
  /** where the village dirt road joins the highway */
  highwayStartS: number;
  /** where city scenery begins */
  cityStartS: number;
  /** stretches with roadside bazaars */
  townZones: [number, number][];
  /** speed-limited stretches: bazaars, schools, the market approach */
  slowZones: SlowZone[];
  events: RouteEvent[];
  /** total track length (a little beyond the market) */
  length: number;
}

// ---------------------------------------------------------------- start points

type LegalStop = Omit<TollEvent, 's'>;

export interface StartPoint {
  id: string;
  nameBn: string;
  /** shown in the menu */
  pathBn: string;
  legal: LegalStop[];
  /** how many illegal barriers are scattered along the way */
  randomBarriers: number;
  farmsBn: string;
}

const LALON: LegalStop = {
  id: 'lalon', type: 'bridgeToll', feeKey: 'lalonToll', nameBn: 'লালন শাহ সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'লালন শাহ সেতু', style: 'lalon', offset: 300, length: 550 },
};
const NATORE: LegalStop = {
  id: 'natore', type: 'roadToll', feeKey: 'natoreToll', nameBn: 'নাটোর সড়ক টোল', icon: '{receipt}', small: true,
};
const JAMUNA: LegalStop = {
  id: 'jamuna', type: 'bridgeToll', feeKey: 'jamunaToll', nameBn: 'যমুনা সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'যমুনা সেতু', style: 'jamuna', offset: 300, length: 650 },
};
const PADMA: LegalStop = {
  id: 'padma', type: 'bridgeToll', feeKey: 'padmaToll', nameBn: 'পদ্মা সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'পদ্মা সেতু', style: 'padma', offset: 520, length: 760 },
};
const EXPRESSWAY: LegalStop = {
  id: 'expressway', type: 'roadToll', feeKey: 'expresswayToll', nameBn: 'এক্সপ্রেসওয়ে টোল', icon: '{road}',
};

export const START_POINTS: StartPoint[] = [
  {
    id: 'jessore',
    nameBn: 'যশোর',
    pathBn: 'লালন শাহ সেতু → নাটোর সড়ক টোল → যমুনা সেতু',
    legal: [LALON, NATORE, JAMUNA],
    randomBarriers: 10,
    farmsBn: 'যশোরের সবজি ক্ষেত',
  },
  {
    id: 'rajshahi',
    nameBn: 'রাজশাহী',
    pathBn: 'নাটোর সড়ক টোল → যমুনা সেতু',
    legal: [NATORE, JAMUNA],
    randomBarriers: 6,
    farmsBn: 'রাজশাহীর সবজি ক্ষেত',
  },
  {
    id: 'faridpur',
    nameBn: 'ফরিদপুর',
    pathBn: 'পদ্মা সেতু → এক্সপ্রেসওয়ে টোল',
    legal: [PADMA, EXPRESSWAY],
    randomBarriers: 6,
    farmsBn: 'ফরিদপুরের সবজি ক্ষেত',
  },
];

export const DEFAULT_START_ID = 'jessore';

const FARMS: FarmEvent[] = [
  { id: 'farm1', type: 'farm', s: 130, side: -1, nameBn: 'রহিম চাচার ক্ষেত', icon: '{farm}', vegetables: ['tomato', 'chili'],
    farmerLineBn: 'বাবা, টমেটো এবার ভালো হইছে, কিন্তু পাইকার আসে নাই।' },
  { id: 'farm2', type: 'farm', s: 270, side: 1, nameBn: 'জমিলা খালার ক্ষেত', icon: '{farm}', vegetables: ['potato', 'onion'],
    farmerLineBn: 'হিমাগারের ভাড়া দিয়ে আর কিছু থাকে না, নিয়া যাও।' },
  { id: 'farm3', type: 'farm', s: 410, side: -1, nameBn: 'হারুন মিয়ার ক্ষেত', icon: '{farm}', vegetables: ['brinjal', 'gourd', 'cauliflower'],
    farmerLineBn: 'ঢাকায় শুনি বেগুন ষাট টাকা! আমি তো পাই বাইশ।' },
  { id: 'farm4', type: 'farm', s: 550, side: 1, nameBn: 'নুরুল ভাইয়ের ক্ষেত', icon: '{farm}', vegetables: ['cabbage', 'cauliflower', 'tomato'],
    farmerLineBn: 'সার-বীজের দাম বাড়ে, আমার দাম বাড়ে না।' },
];

/** Generic places where barriers pop up (no real organisations). */
const BARRIER_PLACES = [
  'তিন রাস্তার মোড়', 'বাসস্ট্যান্ড', 'ট্রাক স্ট্যান্ড', 'হাটখোলা', 'কলেজ গেট', 'পেট্রল পাম্প মোড়',
  'বাজারের মুখ', 'ব্রিজের ঢাল', 'ফেরিঘাট মোড়', 'চৌরাস্তা', 'রেলক্রসিং', 'সিএনজি স্ট্যান্ড', 'মসজিদ মোড়',
];

/** Spacing rules (metres). After a barrier there must be room for a chase before the next event. */
const LAYOUT = {
  highwayStart: 700,
  firstEvent: 1_500,
  afterBarrier: [1_000, 1_300] as [number, number],
  afterToll: [800, 1_050] as [number, number],
  afterBridge: [650, 850] as [number, number],
  cityStretch: 1_500,
};

function chandaAmount(rng: Rng, i: number, n: number): number {
  const { min, max, step } = ECONOMY.randomChanda;
  const lean = n > 1 ? i / (n - 1) : 0.5;
  const v = min + (max - min) * (0.5 * lean + 0.5 * rng());
  return Math.round(v / step) * step;
}

/** Build a fresh route for a start point; barriers are placed randomly between the legal stops. */
export function generateRoute(startId: string, seed = Math.floor(Math.random() * 1e9)): RouteDef {
  const sp = START_POINTS.find((p) => p.id === startId) ?? START_POINTS[0];
  const rng = mulberry32(seed);

  // Interleave barriers randomly with the legal stops (legal order is kept)
  const seq: (LegalStop | 'B' | 'R')[] = [...sp.legal];
  for (let i = 0; i < sp.randomBarriers; i++) seq.splice(Math.floor(rng() * (seq.length + 1)), 0, 'B');
  // The last thing before the city is always a barrier at the city entrance
  if (sp.randomBarriers > 0 && seq[seq.length - 1] !== 'B') {
    seq.splice(seq.lastIndexOf('B'), 1);
    seq.push('B');
  }
  // Railway level crossings anywhere before the city entrance
  const rails = RAIL.perRouteMin + Math.floor(rng() * (RAIL.perRouteMax - RAIL.perRouteMin + 1));
  for (let i = 0; i < rails; i++) seq.splice(Math.floor(rng() * seq.length), 0, 'R');

  const places = [...BARRIER_PLACES].sort(() => rng() - 0.5);
  const events: RouteEvent[] = [...FARMS];
  const townZones: [number, number][] = [];
  let s = LAYOUT.firstEvent;
  let b = 0;
  let r = 0;
  seq.forEach((item, idx) => {
    if (item === 'R') {
      events.push({ id: `rail${++r}`, type: 'rail', s, nameBn: 'রেলক্রসিং', icon: '{train}' });
      s += range(rng, ...LAYOUT.afterToll);
    } else if (item === 'B') {
      const last = idx === seq.length - 1;
      const place = last ? 'শহরের প্রবেশমুখ' : places[b % places.length];
      events.push({
        id: `b${b + 1}`,
        type: 'barrier',
        s,
        chanda: chandaAmount(rng, b, sp.randomBarriers),
        workers: 4 + Math.floor(rng() * 5),
        nameBn: `চাঁদা পয়েন্ট ${toBnDigits(b + 1)} — ${place}`,
        icon: '{hand}',
      });
      if (rng() < 0.6 || last) townZones.push([s - 380, s + 120]);
      b++;
      s += range(rng, ...LAYOUT.afterBarrier);
    } else {
      events.push({ ...item, s });
      if (item.bridge) s += item.bridge.offset + item.bridge.length + range(rng, ...LAYOUT.afterBridge);
      else s += range(rng, ...LAYOUT.afterToll);
    }
  });
  s = Math.round(s);
  const cityStartS = s - 300;
  const marketS = s + LAYOUT.cityStretch;
  events.push({ id: 'market', type: 'market', s: marketS, nameBn: 'কাওরান বাজার', icon: '{cart}' });

  // Slow zones: every bazaar, a few schools in quiet stretches, and the market approach
  const slowZones: SlowZone[] = townZones.map(([a, b2]) => ({
    from: a, to: b2, kind: 'bazar', limitKmh: SLOW_ZONES.bazarKmh, side: rng() < 0.5 ? -1 : 1,
  }));
  const busy: [number, number][] = [[0, LAYOUT.highwayStart + 300], [cityStartS - 400, marketS + 400], ...townZones.map(([a, b2]) => [a - 200, b2 + 200] as [number, number])];
  for (const e of events) {
    if (e.type === 'farm' || e.type === 'market') continue;
    const end = (e.type === 'roadTax' || e.type === 'roadToll' || e.type === 'bridgeToll') && e.bridge ? e.s + e.bridge.offset + e.bridge.length + 250 : e.s + 300;
    busy.push([e.s - 450, end]);
  }
  const schools = SLOW_ZONES.schoolsMin + Math.floor(rng() * (SLOW_ZONES.schoolsMax - SLOW_ZONES.schoolsMin + 1));
  for (let tries = 0; tries < 60 && slowZones.filter((z) => z.kind === 'school').length < schools; tries++) {
    const at = LAYOUT.highwayStart + rng() * (cityStartS - LAYOUT.highwayStart);
    const from = at - 140;
    const to = at + 140;
    if (busy.some(([a, b2]) => to > a && from < b2)) continue;
    slowZones.push({ from, to, kind: 'school', limitKmh: SLOW_ZONES.schoolKmh, side: rng() < 0.5 ? -1 : 1 });
    busy.push([from - 300, to + 300]);
  }
  slowZones.push({ from: marketS - 650, to: marketS + 20, kind: 'market', limitKmh: SLOW_ZONES.marketKmh, side: -1 });
  slowZones.sort((a, b2) => a.from - b2.from);

  return {
    id: `${sp.id}-${seed}`,
    nameBn: `${sp.nameBn} → ঢাকা`,
    descriptionBn: sp.pathBn,
    highwayStartS: LAYOUT.highwayStart,
    cityStartS,
    townZones,
    slowZones,
    events,
    length: marketS + 300,
  };
}
