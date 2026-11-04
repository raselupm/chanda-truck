// Routes: the player picks a starting district; each start has an ordered list of legal toll stops.
// Illegal chanda barriers are scattered randomly between them every run (generateRoute).
// Distances (s, metres along the track) are compressed for gameplay.

import { ECONOMY, type FeeKey } from './economy';
import { BROKEN_ROAD, CITY, FERRY, LANDMARK, RAIL, ROADWORKS, SHORTCUT, SLOW_ZONES, VILLAGE } from './tuning';
import { isStop, LANDMARK_SIZE, LANDMARKS, type LandmarkDef } from './landmarks';
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

/** 'ferry': no bridge at all, the river is crossed on a ferry from one ghat to the other (world/FerryGhat.ts) */
export type BridgeStyle = 'jamuna' | 'padma' | 'lalon' | 'shahAmanat' | 'meghnaGumti' | 'girder' | 'bhairab' | 'payra' | 'meghna' | 'madhumati' | 'ferry';

export interface TollEvent extends EventBase {
  /** roadTax = ROAD_TAX ledger category; roadToll / bridgeToll / ferry = TOLL */
  type: 'roadTax' | 'roadToll' | 'bridgeToll' | 'ferry';
  feeKey: FeeKey;
  /** single-booth plaza instead of the full canopy */
  small?: boolean;
  bridge?: {
    nameBn: string;
    style: BridgeStyle;
    /** metres from the toll stop line to the bridge start */
    offset: number;
    length: number;
    /** metres of railway beside the road before and after the bridge (kept clear of other events) */
    rail?: number;
    /** a ferry's landing ghat on the far bank */
    farBn?: string;
  };
}

/** A toll stop's river crossing (its bridge, or the river a ferry takes you over), if it has one. */
export function crossingOf(e: RouteEvent): TollEvent['bridge'] | undefined {
  return e.type === 'roadTax' || e.type === 'roadToll' || e.type === 'bridgeToll' || e.type === 'ferry' ? e.bridge : undefined;
}

/** Railway level crossing: sometimes the gates close and a train passes. */
export interface RailEvent extends EventBase {
  type: 'rail';
}

export interface MarketEvent extends EventBase {
  type: 'market';
}

/** Village roadworks: our half is closed for `length` metres, a flagman runs one shared lane. */
export interface RoadworksEvent extends EventBase {
  type: 'roadworks';
  length: number;
}

/** City four-way junction with traffic lights. */
export interface JunctionEvent extends EventBase {
  type: 'junction';
}

export type RouteEvent = FarmEvent | BarrierEvent | TollEvent | RailEvent | MarketEvent | RoadworksEvent | JunctionEvent;

export interface SlowZone {
  from: number;
  to: number;
  kind: 'bazar' | 'school' | 'market';
  limitKmh: number;
  /** side of the road the school / sign cluster is on */
  side: -1 | 1;
}

export type SightKind = keyof Omit<typeof VILLAGE, 'hearing'>;

/** Village life beside the road: a cattle market, a waz mahfil, a football or cricket field. */
export interface Sight {
  kind: SightKind;
  /** middle of the site along the road */
  s: number;
  /** side of the road (-1 = left) */
  side: -1 | 1;
}

/** A real landmark beside the road (config/landmarks.ts). */
export interface PlacedLandmark {
  def: LandmarkDef;
  /** middle of the site along the road */
  s: number;
  side: -1 | 1;
  /** [length along the road, depth] */
  size: [number, number];
}

/**
 * A village road round a chanda barrier: forks off to the left at `from` and rejoins from the left at `to`.
 * A right-side one passes under the highway (which goes over it on a flyover) at each of `crossings`:
 * over to the right before the barrier, back to the left after it.
 */
export interface ShortcutDef {
  from: number;
  to: number;
  /** side of the highway it runs along past the barrier (-1 = left) */
  side: -1 | 1;
  crossings: number[];
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
  /** broken stretches of road (speed capped at BROKEN_ROAD.maxKmh) */
  broken: [number, number][];
  /** the city avenue with 4 + 4 lanes (only the inner ones open) */
  wide: [number, number] | null;
  /** the hill road right after the village (Rangamati): its s range and the seed of its bends */
  hills: { from: number; to: number; seed: number } | null;
  /** village shortcuts round some of the barriers */
  shortcuts: ShortcutDef[];
  /** cattle market, waz mahfil, football and cricket fields beside the road */
  sights: Sight[];
  /** real landmarks beside the road, in road order */
  landmarks: PlacedLandmark[];
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
  /** metres of hill road between the village and the highway */
  hill?: number;
  farmsBn: string;
  /** this district's own farms (names, crops, farmers' lines), in place of the default four, in order */
  farms?: Pick<FarmEvent, 'nameBn' | 'vegetables' | 'farmerLineBn'>[];
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
  bridge: { nameBn: 'যমুনা সেতু', style: 'jamuna', offset: 300, length: 650, rail: 2_000 },
};
const PADMA: LegalStop = {
  id: 'padma', type: 'bridgeToll', feeKey: 'padmaToll', nameBn: 'পদ্মা সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'পদ্মা সেতু', style: 'padma', offset: 520, length: 760, rail: 1_300 },
};
/** On the Chattogram–Cox's Bazar road (N1 south of Chattogram): the Bandarban route crosses it. */
export const SHAH_AMANAT: LegalStop = {
  id: 'shahAmanat', type: 'bridgeToll', feeKey: 'shahAmanatToll', nameBn: 'শাহ আমানত সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'শাহ আমানত সেতু', style: 'shahAmanat', offset: 300, length: 600 },
};
const MEGHNA_GUMTI: LegalStop = {
  id: 'meghnaGumti', type: 'bridgeToll', feeKey: 'meghnaGumtiToll', nameBn: 'মেঘনা-গোমতী সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'মেঘনা-গোমতী সেতু', style: 'meghnaGumti', offset: 300, length: 700 },
};
const SHERPUR: LegalStop = {
  id: 'sherpur', type: 'bridgeToll', feeKey: 'sherpurToll', nameBn: 'শেরপুর সেতু টোল', icon: '{bridge}', small: true,
  bridge: { nameBn: 'শেরপুর সেতু', style: 'girder', offset: 300, length: 340 },
};
const BHAIRAB: LegalStop = {
  id: 'bhairab', type: 'bridgeToll', feeKey: 'bhairabToll', nameBn: 'সৈয়দ নজরুল ইসলাম সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'সৈয়দ নজরুল ইসলাম সেতু', style: 'bhairab', offset: 300, length: 650, rail: 900 },
};
const SHAMBHUGANJ: LegalStop = {
  id: 'shambhuganj', type: 'bridgeToll', feeKey: 'shambhuganjToll', nameBn: 'শম্ভুগঞ্জ সেতু টোল', icon: '{bridge}', small: true,
  bridge: { nameBn: 'শম্ভুগঞ্জ সেতু', style: 'girder', offset: 300, length: 380 },
};
const PAYRA: LegalStop = {
  id: 'payra', type: 'bridgeToll', feeKey: 'payraToll', nameBn: 'পায়রা সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'পায়রা সেতু', style: 'payra', offset: 300, length: 700 },
};
const MEGHNA: LegalStop = {
  id: 'meghna', type: 'bridgeToll', feeKey: 'meghnaToll', nameBn: 'মেঘনা সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'মেঘনা সেতু', style: 'meghna', offset: 300, length: 600 },
};
/** Mollahat Bridge over the Madhumati on the Khulna–Gopalganj road (N805). */
const MOLLAHAT: LegalStop = {
  id: 'mollahat', type: 'bridgeToll', feeKey: 'mollahatToll', nameBn: 'মোল্লাহাট সেতু টোল', icon: '{bridge}', small: true,
  bridge: { nameBn: 'মোল্লাহাট সেতু', style: 'girder', offset: 300, length: 300 },
};
/** Madhumati Bridge at Kalna (2022, the country's first six-lane bridge): a 690 m steel network arch. */
const MADHUMATI: LegalStop = {
  id: 'madhumati', type: 'bridgeToll', feeKey: 'madhumatiToll', nameBn: 'মধুমতি সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'মধুমতি সেতু (কালনা)', style: 'madhumati', offset: 300, length: 600 },
};
/** Muktarpur Bridge (6th Bangladesh-China Friendship Bridge, 2008) over the Dhaleshwari, 1.52 km. */
const MUKTARPUR: LegalStop = {
  id: 'muktarpur', type: 'bridgeToll', feeKey: 'muktarpurToll', nameBn: 'মুক্তারপুর সেতু টোল', icon: '{bridge}',
  bridge: { nameBn: 'মুক্তারপুর সেতু', style: 'girder', offset: 300, length: 560 },
};
/**
 * Daulatdia–Paturia, the Padma just below its meeting with the Jamuna: no bridge, a ferry from one ghat to the
 * other. The official ticket for a truck is only part of it: the ghat's "serial" brokers take their cut too.
 */
const DAULATDIA: LegalStop = {
  id: 'daulatdia', type: 'ferry', feeKey: 'daulatdiaFerry', nameBn: 'দৌলতদিয়া ফেরিঘাট', icon: '{ferry}',
  bridge: { nameBn: 'পদ্মা — দৌলতদিয়া থেকে পাটুরিয়া', farBn: 'পাটুরিয়া ফেরিঘাট', style: 'ferry', offset: 260, length: 650 },
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
  {
    id: 'rangamati',
    nameBn: 'রাঙামাটি',
    // N106 via Raozan and Hathazari, the Bayezid–Fouzdarhat link road onto N1 (no Karnaphuli crossing)
    pathBn: 'পাহাড়ি রাস্তা → হাটহাজারী → মেঘনা-গোমতী সেতু → মেঘনা সেতু',
    legal: [MEGHNA_GUMTI, MEGHNA],
    randomBarriers: 6,
    hill: 1_250,
    farmsBn: 'রাঙামাটির পাহাড়ি সবজি ক্ষেত',
  },
  {
    // N5: Mahasthan Haat → Hatikumrul → Jamuna Bridge → Elenga → Tangail
    id: 'bogura',
    nameBn: 'বগুড়া',
    pathBn: 'মহাস্থান হাট → হাটিকুমরুল → যমুনা সেতু → এলেঙ্গা',
    legal: [JAMUNA],
    randomBarriers: 8,
    farmsBn: 'মহাস্থানের সবজি ক্ষেত',
  },
  {
    // N2: Sylhet → Sherpur (Kushiyara) → Shaistaganj → Ashuganj → Bhairab (Meghna) → Narsingdi → Kanchpur
    id: 'sylhet',
    nameBn: 'সিলেট',
    pathBn: 'শেরপুর সেতু → আশুগঞ্জ → ভৈরব সেতু → নরসিংদী',
    legal: [SHERPUR, BHAIRAB],
    randomBarriers: 6,
    farmsBn: 'সিলেটের সবজি ক্ষেত',
  },
  {
    // Netrokona → Shambhuganj Bridge (Old Brahmaputra) → Mymensingh → N3: Bhaluka → Gazipur → Tongi
    id: 'netrokona',
    nameBn: 'নেত্রকোনা',
    pathBn: 'শম্ভুগঞ্জ সেতু → ময়মনসিংহ → ভালুকা → গাজীপুর',
    legal: [SHAMBHUGANJ],
    randomBarriers: 6,
    farmsBn: 'নেত্রকোনার সবজি ক্ষেত',
  },
  {
    // N8: Patuakhali → Lebukhali (Payra) → Barishal → Bhanga → Padma Bridge → Dhaka–Mawa Expressway
    id: 'patuakhali',
    nameBn: 'পটুয়াখালী',
    pathBn: 'পায়রা সেতু → বরিশাল → পদ্মা সেতু → এক্সপ্রেসওয়ে টোল',
    legal: [PAYRA, PADMA, EXPRESSWAY],
    randomBarriers: 6,
    farmsBn: 'পটুয়াখালীর সবজি ক্ষেত',
  },
  {
    // N1: Cumilla → Daudkandi (Meghna-Gumti) → Meghnaghat (Meghna) → Kanchpur
    id: 'cumilla',
    nameBn: 'কুমিল্লা',
    pathBn: 'দাউদকান্দি → মেঘনা-গোমতী সেতু → মেঘনা সেতু → কাঁচপুর',
    legal: [MEGHNA_GUMTI, MEGHNA],
    randomBarriers: 6,
    farmsBn: 'কুমিল্লার সবজি ক্ষেত',
  },
  {
    // N5: Rangpur → Pirganj → Palashbari → Gobindaganj → Bogura → Hatikumrul → Jamuna Bridge → Elenga
    id: 'rangpur',
    nameBn: 'রংপুর',
    pathBn: 'পলাশবাড়ী → গোবিন্দগঞ্জ → বগুড়া → হাটিকুমরুল → যমুনা সেতু',
    legal: [JAMUNA],
    randomBarriers: 10,
    farmsBn: 'রংপুরের আলু-সবজির ক্ষেত',
    farms: [
      { nameBn: 'মমিন চাচার আলুক্ষেত', vegetables: ['potato', 'tomato'], farmerLineBn: 'আলু তো মাটির দামে বেচি, হিমাগারে জায়গাও নাই।' },
      { nameBn: 'সুফিয়া খালার ক্ষেত', vegetables: ['cabbage', 'cauliflower'], farmerLineBn: 'বাপু, ঢাকা অনেক দূর — রাস্তায় যা যায়, সেটাই আসল খরচ।' },
      { nameBn: 'আফজাল ভাইয়ের ক্ষেত', vegetables: ['brinjal', 'chili', 'gourd'], farmerLineBn: 'মরিচ এবার লাল টুকটুকে, দাম কিন্তু ফ্যাকাশে।' },
      { nameBn: 'তিস্তা পাড়ের চর', vegetables: ['potato', 'onion', 'tomato'], farmerLineBn: 'চরের বালুতে ফলাইছি, পানি টানতে টানতে কোমর শেষ।' },
    ],
  },
  {
    // Pabna → Kashinathpur → Baghabari (Hurasagar) → Shahjadpur → Hatikumrul → Jamuna Bridge → Elenga
    id: 'pabna',
    nameBn: 'পাবনা',
    pathBn: 'কাশিনাথপুর → বাঘাবাড়ী → হাটিকুমরুল → যমুনা সেতু',
    legal: [JAMUNA],
    randomBarriers: 7,
    farmsBn: 'সুজানগরের পেঁয়াজের ক্ষেত',
    farms: [
      { nameBn: 'গাজনার বিলের পেঁয়াজক্ষেত', vegetables: ['onion'], farmerLineBn: 'পেঁয়াজের রাজধানী পাবনা, কিন্তু রাজার পকেট ফাঁকা।' },
      { nameBn: 'হালিমা খালার ক্ষেত', vegetables: ['onion', 'chili'], farmerLineBn: 'ঢাকায় পেঁয়াজ নব্বই, আমি পাই তিরিশ। বাকিটা কই যায়?' },
      { nameBn: 'বাদশা মিয়ার ক্ষেত', vegetables: ['brinjal', 'tomato'], farmerLineBn: 'বেগুনে এবার পোকা কম, দামটাও কম।' },
      { nameBn: 'সুজানগরের চাষি সমিতি', vegetables: ['onion', 'potato', 'gourd'], farmerLineBn: 'একসাথে নিয়া যাও, ট্রাক ভাড়া ভাগ করি।' },
    ],
  },
  {
    // R710: Kumarkhali → Khoksa → Pangsha → Rajbari → Goalanda → Daulatdia ghat, the ferry over the Padma to
    // Paturia, then the Dhaka–Aricha highway (N5): Manikganj → Dhamrai → Savar → Gabtoli
    id: 'kumarkhali',
    nameBn: 'কুমারখালী',
    pathBn: 'রাজবাড়ী → দৌলতদিয়া ঘাট → ফেরিতে পদ্মা পার → পাটুরিয়া → মানিকগঞ্জ → সাভার',
    legal: [DAULATDIA],
    randomBarriers: 7,
    farmsBn: 'কুমারখালীর সবজি ক্ষেত',
    farms: [
      { nameBn: 'গড়াই পাড়ের ক্ষেত', vegetables: ['tomato', 'chili'], farmerLineBn: 'ঘাটে দুই দিন আটকা থাকলে টমেটো আর টমেটো থাকে না, বাবা।' },
      { nameBn: 'রহিমা খালার ক্ষেত', vegetables: ['brinjal', 'gourd'], farmerLineBn: 'ফেরির সিরিয়ালে দালাল না ধরলে পার হওয়া কঠিন।' },
      { nameBn: 'শিলাইদহের চরের ক্ষেত', vegetables: ['potato', 'onion'], farmerLineBn: 'রবি ঠাকুরের শিলাইদহ, তবু আলুর দামে কবিতা নাই।' },
      { nameBn: 'তাঁতপল্লীর পাশের ক্ষেত', vegetables: ['cabbage', 'cauliflower', 'tomato'], farmerLineBn: 'তাঁতের লুঙ্গি আর ক্ষেতের কপি — দুটোই ঢাকায় যায়, লাভ থাকে না।' },
    ],
  },
  {
    // N7/N805: Khulna → Fakirhat → Mollahat Bridge → Gopalganj → Bhanga → Padma Bridge → Dhaka–Mawa Expressway
    id: 'khulna',
    nameBn: 'খুলনা',
    pathBn: 'মোল্লাহাট সেতু → গোপালগঞ্জ → ভাঙ্গা → পদ্মা সেতু → এক্সপ্রেসওয়ে টোল',
    legal: [MOLLAHAT, PADMA, EXPRESSWAY],
    randomBarriers: 7,
    farmsBn: 'ডুমুরিয়ার সবজি ক্ষেত',
    farms: [
      { nameBn: 'ডুমুরিয়ার ঘেরের আইল', vegetables: ['gourd', 'tomato'], farmerLineBn: 'ঘেরের আইলে লাউ ঝুলাইছি, মাছের চেয়ে লাউ বেশি!' },
      { nameBn: 'রাশেদা খালার ক্ষেত', vegetables: ['brinjal', 'chili'], farmerLineBn: 'নোনা পানি ঢুকলে সব শেষ, তাড়াতাড়ি নিয়া যাও।' },
      { nameBn: 'কামাল মোল্লার ক্ষেত', vegetables: ['cabbage', 'cauliflower', 'tomato'], farmerLineBn: 'পদ্মা সেতু হইছে, এখন ঢাকা কাছে — চাঁদা কিন্তু দূরে যায় নাই।' },
      { nameBn: 'ফকিরহাটের বাজার মাঠ', vegetables: ['potato', 'onion'], farmerLineBn: 'পাইকার বলে দাম কম, ঢাকায় শুনি আগুন।' },
    ],
  },
  {
    // Narail → Kalna (Madhumati Bridge) → Bhatiapara → Bhanga → Padma Bridge → Dhaka–Mawa Expressway
    id: 'narail',
    nameBn: 'নড়াইল',
    pathBn: 'কালনা মধুমতি সেতু → ভাটিয়াপাড়া → ভাঙ্গা → পদ্মা সেতু → এক্সপ্রেসওয়ে টোল',
    legal: [MADHUMATI, PADMA, EXPRESSWAY],
    randomBarriers: 6,
    farmsBn: 'নড়াইলের সবজি ক্ষেত',
    farms: [
      { nameBn: 'চিত্রা পাড়ের ক্ষেত', vegetables: ['tomato', 'chili'], farmerLineBn: 'কালনায় সেতু হইছে, ফেরির লাইনে আর পচে না মাল।' },
      { nameBn: 'মর্জিনা খালার ক্ষেত', vegetables: ['potato', 'onion'], farmerLineBn: 'সেতুর টোল দিবা, চাঁদাও দিবা — আমারে দিবা কম।' },
      { nameBn: 'লোহাগড়ার হাট মাঠ', vegetables: ['brinjal', 'gourd', 'cauliflower'], farmerLineBn: 'বেগুন নিয়া যাও, ঢাকায় বেগুনি হবে।' },
      { nameBn: 'রফিক ভাইয়ের ক্ষেত', vegetables: ['cabbage', 'tomato'], farmerLineBn: 'বাঁধাকপি বড় হইছে, দাম ছোট।' },
    ],
  },
  {
    // Munshiganj → Muktarpur Bridge (Dhaleshwari) → Panchabati → Postogola → Jatrabari
    id: 'munshiganj',
    nameBn: 'মুন্সীগঞ্জ',
    pathBn: 'মুক্তারপুর সেতু → পঞ্চবটী → পোস্তগোলা → যাত্রাবাড়ী',
    legal: [MUKTARPUR],
    randomBarriers: 3,
    farmsBn: 'মুন্সীগঞ্জের আলুক্ষেত',
    farms: [
      { nameBn: 'টঙ্গিবাড়ীর আলুক্ষেত', vegetables: ['potato'], farmerLineBn: 'আলু আলু আর আলু — কোল্ড স্টোরের ভাড়াই আলুর দামের অর্ধেক।' },
      { nameBn: 'সিরাজদিখানের ক্ষেত', vegetables: ['potato', 'onion'], farmerLineBn: 'ঢাকা তো চোখের সামনে, তবু দাম পাই না।' },
      { nameBn: 'নাসিমা খালার ক্ষেত', vegetables: ['tomato', 'chili'], farmerLineBn: 'রাস্তা ছোট, চাঁদা কম — তবু চাঁদা তো চাঁদাই।' },
      { nameBn: 'আব্দুল চাচার ক্ষেত', vegetables: ['potato', 'cabbage', 'cauliflower'], farmerLineBn: 'বিক্রমপুরের আলু, স্বাদে সেরা — দামে না।' },
    ],
  },
  {
    // Bandarban → hill road → Keranihat (N1) → Shah Amanat Bridge (Karnaphuli) → Chattogram → Feni → Cumilla
    // → Daudkandi (Meghna-Gumti) → Meghnaghat (Meghna) → Kanchpur
    id: 'bandarban',
    nameBn: 'বান্দরবান',
    pathBn: 'পাহাড়ি রাস্তা → কেরানীহাট → শাহ আমানত সেতু → মেঘনা-গোমতী সেতু → মেঘনা সেতু',
    legal: [SHAH_AMANAT, MEGHNA_GUMTI, MEGHNA],
    randomBarriers: 8,
    hill: 1_100,
    farmsBn: 'বান্দরবানের জুমের ক্ষেত',
    farms: [
      { nameBn: 'পাহাড়ের জুম ক্ষেত', vegetables: ['chili', 'gourd'], farmerLineBn: 'জুমের মরিচ, ঝালে সেরা — পাহাড় থেকে নামাতেই খরচ।' },
      { nameBn: 'সাঙ্গু পাড়ের ক্ষেত', vegetables: ['tomato', 'cabbage'], farmerLineBn: 'বর্ষায় রাস্তা ভাঙে, তখন মাল নষ্ট।' },
      { nameBn: 'মংসিং দাদার বাগান', vegetables: ['brinjal', 'cauliflower', 'gourd'], farmerLineBn: 'চট্টগ্রাম পর্যন্ত চাঁদা, তারপর ঢাকা পর্যন্ত আরও চাঁদা।' },
      { nameBn: 'কেরানীহাটের পাইকারি মাঠ', vegetables: ['potato', 'onion', 'tomato'], farmerLineBn: 'পাহাড়ের সবজি ঢাকায় গেলে সোনা, এখানে মাটি।' },
    ],
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
  /** road between the end of a broken stretch and the next event */
  afterBroken: [450, 600] as [number, number],
  afterWorks: [650, 850] as [number, number],
  cityStretch: 1_500,
};

function chandaAmount(rng: Rng, i: number, n: number): number {
  const { min, max, step } = ECONOMY.randomChanda;
  const lean = n > 1 ? i / (n - 1) : 0.5;
  const v = min + (max - min) * (0.5 * lean + 0.5 * rng());
  return Math.round(v / step) * step;
}

/** Ground that's already built on beside the road: side 0 = both sides, -1 / 1 = only that side. */
type Blocked = { from: number; to: number; side: -1 | 0 | 1 };

/**
 * Spread a start point's landmarks along [lo, hi] in their real order. The { stop } markers tie them to the
 * legal stops: the ones listed before a bridge stand before its toll, the ones after it beyond the far bank.
 * Each landmark then takes free ground near its spot, on whichever side has room (its own side if known).
 * The placed sites are added to `taken`.
 */
function placeLandmarks(startId: string, events: RouteEvent[], blocked: Blocked[], taken: [number, number][], lo: number, hi: number, rng: Rng): PlacedLandmark[] {
  const list = LANDMARKS[startId] ?? [];
  // segments between the stops: [from, to] and the landmarks in each
  const segs: { from: number; to: number; defs: LandmarkDef[] }[] = [{ from: lo, to: hi, defs: [] }];
  for (const e of list) {
    const cur = segs[segs.length - 1];
    if (!isStop(e)) {
      cur.defs.push(e);
      continue;
    }
    const ev = events.find((x) => x.id === e.stop);
    if (!ev) continue;
    const br = crossingOf(ev) ?? null;
    cur.to = ev.s - 200;
    segs.push({ from: br ? ev.s + br.offset * 2 + br.length + 140 : ev.s + 250, to: hi, defs: [] });
  }
  // the free ground on each side: [lo, hi] minus everything already built there
  const free = (k: -1 | 1): [number, number][] => {
    const out: [number, number][] = [];
    let at = lo;
    for (const { from, to } of blocked.filter((x) => x.side !== -k).sort((p, q) => p.from - q.from)) {
      if (from > at) out.push([at, Math.min(from, hi)]);
      at = Math.max(at, to);
      if (at >= hi) break;
    }
    if (at < hi) out.push([at, hi]);
    return out;
  };
  const sides = { [-1]: free(-1), [1]: free(1) } as Record<-1 | 1, [number, number][]>;
  const placed: PlacedLandmark[] = [];
  for (const seg of segs) placed.push(...packLandmarks(seg.defs, seg.from, seg.to, sides, rng));
  for (const p of placed) taken.push([p.s - p.size[0] / 2 - LANDMARK.margin, p.s + p.size[0] / 2 + LANDMARK.margin]);
  return placed.sort((a, b) => a.s - b.s);
}

/** Metres of road the landmarks before each stop (and after the last one) need, by stop id. */
function landmarkRoom(startId: string): { before: Record<string, number>; tail: number } {
  const before: Record<string, number> = {};
  let need = 0;
  for (const e of LANDMARKS[startId] ?? []) {
    if (isStop(e)) {
      before[e.stop] = need;
      need = 0;
    } else {
      need += ((e.size ?? LANDMARK_SIZE[e.kind])[0] + 2 * LANDMARK.margin) * LANDMARK.room;
    }
  }
  return { before, tail: need };
}

/**
 * Fit one stretch's landmarks into the free ground of [from, to], in order along the road: spread evenly (a
 * pinned one hugs the start), each as close to its spot as it fits on either side; the ones that run off the
 * end are pulled back from it. Whatever still doesn't fit is left out.
 */
function packLandmarks(defs: LandmarkDef[], from: number, to: number, allFree: Record<-1 | 1, [number, number][]>, rng: Rng): PlacedLandmark[] {
  const clip = (list: [number, number][]) => list.map(([a, b]) => [Math.max(a, from), Math.min(b, to)] as [number, number]).filter(([a, b]) => b > a);
  const free = { [-1]: clip(allFree[-1]), [1]: clip(allFree[1]) } as Record<-1 | 1, [number, number][]>;
  const len = defs.map((def) => (def.size ?? LANDMARK_SIZE[def.kind])[0] + 2 * LANDMARK.margin);
  // the sides each may take, the preferred one first
  const options = defs.map((def): (-1 | 1)[] => (def.side ? [def.side] : rng() < 0.5 ? [-1, 1] : [1, -1]));
  const fits = (s: number, i: number, k: -1 | 1) => free[k].some(([a, b]) => s >= a && s + len[i] <= b);
  const start: number[] = [];
  const side: (-1 | 1)[] = [];
  defs.forEach((def, i) => {
    const spot = def.pin && i === 0 ? from : from + ((i + 0.5) / defs.length) * (to - from) - len[i] / 2;
    const min = Math.max(spot, i ? start[i - 1] + len[i - 1] : from);
    let best = Infinity;
    let bestSide = options[i][0];
    for (const k of options[i]) {
      const iv = free[k].find(([a, b]) => b - Math.max(a, min) >= len[i]);
      const s = iv ? Math.max(iv[0], min) : Infinity;
      if (s < best - 1) [best, bestSide] = [s, k];
    }
    start.push(best);
    side.push(bestSide);
  });
  // (one that fits nowhere is dropped and doesn't hold back the ones before it)
  let limit = to;
  for (let i = defs.length - 1; i >= 0; i--) {
    const max = limit - len[i];
    if (!(start[i] <= max && fits(start[i], i, side[i]))) {
      start[i] = -Infinity;
      for (const k of options[i]) {
        const iv = [...free[k]].reverse().find(([a, b]) => Math.min(b - len[i], max) >= a);
        const s = iv ? Math.min(iv[1] - len[i], max) : -Infinity;
        if (s > start[i] + 1) [start[i], side[i]] = [s, k];
      }
    }
    if (start[i] >= from) limit = start[i];
  }
  const placed: PlacedLandmark[] = [];
  defs.forEach((def, i) => {
    const prev = placed[placed.length - 1];
    if (!(start[i] >= from) || (prev && start[i] < prev.s + prev.size[0] / 2 + LANDMARK.margin)) return;
    placed.push({ def, s: start[i] + len[i] / 2, side: side[i], size: def.size ?? LANDMARK_SIZE[def.kind] });
  });
  return placed;
}

/** Ground a stop keeps clear before itself: a ferry ghat's waiting yard of parked trucks is longer. */
const yardBefore = (e: RouteEvent): number => (e.type === 'ferry' ? FERRY.yardLength + 30 : 160);

/** Build a fresh route for a start point; barriers are placed randomly between the legal stops. */
export function generateRoute(startId: string, seed = Math.floor(Math.random() * 1e9)): RouteDef {
  const sp = START_POINTS.find((p) => p.id === startId) ?? START_POINTS[0];
  const rng = mulberry32(seed);

  // Interleave barriers randomly with the legal stops (legal order is kept)
  const seq: (LegalStop | 'B' | 'R' | 'W' | 'P')[] = [...sp.legal];
  for (let i = 0; i < sp.randomBarriers; i++) seq.splice(Math.floor(rng() * (seq.length + 1)), 0, 'B');
  // The last thing before the city is always a barrier at the city entrance
  if (sp.randomBarriers > 0 && seq[seq.length - 1] !== 'B') {
    seq.splice(seq.lastIndexOf('B'), 1);
    seq.push('B');
  }
  // Railway level crossings and roadworks anywhere before the city entrance
  const between = (min: number, max: number) => min + Math.floor(rng() * (max - min + 1));
  for (let i = between(RAIL.perRouteMin, RAIL.perRouteMax); i > 0; i--) seq.splice(Math.floor(rng() * seq.length), 0, 'R');
  for (let i = between(ROADWORKS.perRouteMin, ROADWORKS.perRouteMax); i > 0; i--) seq.splice(Math.floor(rng() * seq.length), 0, 'W');
  // Broken stretches, never straight after a barrier (you need 90+ km/h for the chase there)
  for (let i = between(BROKEN_ROAD.ruralMin, BROKEN_ROAD.ruralMax); i > 0; i--) {
    let at = 0;
    for (let tries = 0; tries < 20; tries++) {
      at = Math.floor(rng() * seq.length);
      if (seq[at - 1] !== 'B') break;
    }
    if (seq[at - 1] !== 'B') seq.splice(at, 0, 'P');
  }

  // A few barriers (never the one at the city entrance) get a village shortcut round them
  const scIdx = seq.map((it, i) => (it === 'B' && i !== seq.length - 1 ? i : -1)).filter((i) => i >= 0).sort(() => rng() - 0.5);
  const withShortcut = new Set(scIdx.slice(0, SHORTCUT.perRoute));
  const shortcuts: ShortcutDef[] = [];

  const places = [...BARRIER_PLACES].sort(() => rng() - 0.5);
  const events: RouteEvent[] = FARMS.map((f, i) => ({ ...f, ...sp.farms?.[i] }));
  const townZones: [number, number][] = [];
  const broken: [number, number][] = [];
  // The hill road starts where the village road meets the highway; the events begin after it
  const hills = sp.hill ? { from: LAYOUT.highwayStart + 150, to: LAYOUT.highwayStart + 150 + sp.hill, seed: Math.floor(rng() * 1e9) } : null;
  let s = hills ? hills.to + 600 : LAYOUT.firstEvent;
  // the landmarks between the stops need their share of the road
  const room = landmarkRoom(sp.id);
  let roomFrom = hills ? hills.to + 100 : LAYOUT.highwayStart + 400;
  // road since `from` already built up on both sides: bazaars and the shortcuts' flyovers
  const usedSince = (from: number) =>
    townZones.filter(([a]) => a >= from).length * 620 +
    shortcuts.filter((sc) => sc.from >= from).reduce((n, sc) => n + sc.crossings.length * 2 * (SHORTCUT.deckFlat + SHORTCUT.ramp + 40), 0);
  let b = 0;
  let r = 0;
  let w = 0;
  seq.forEach((item, idx) => {
    if (item === 'R') {
      events.push({ id: `rail${++r}`, type: 'rail', s, nameBn: 'রেলক্রসিং', icon: '{train}' });
      s += range(rng, ...LAYOUT.afterToll);
    } else if (item === 'W') {
      events.push({ id: `works${++w}`, type: 'roadworks', s, length: ROADWORKS.length, nameBn: 'রাস্তার কাজ — এক লেন', icon: '{cement}' });
      s += range(rng, ...LAYOUT.afterWorks);
    } else if (item === 'P') {
      // starts a little before where the next event would have been
      const len = range(rng, BROKEN_ROAD.lenMin, BROKEN_ROAD.lenMax);
      broken.push([s - 200, s - 200 + len]);
      s += len - 200 + range(rng, ...LAYOUT.afterBroken);
    } else if (item === 'B') {
      const last = idx === seq.length - 1;
      const sc = withShortcut.has(idx);
      const right = sc && rng() < SHORTCUT.rightChance;
      const forkBefore = right ? SHORTCUT.forkBeforeFlyover : SHORTCUT.forkBefore;
      // room for the fork (and the flyover) before the barrier
      if (sc) s += forkBefore - 250;
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
      if (sc) {
        const from = s - forkBefore;
        const joinAfter = right ? SHORTCUT.joinAfterFlyover : SHORTCUT.joinAfter;
        shortcuts.push({
          from,
          to: s + joinAfter,
          side: right ? 1 : -1,
          crossings: right ? [from + SHORTCUT.crossAfterFork, s + SHORTCUT.crossBackAfter] : [],
        });
        s += joinAfter + range(rng, 400, 550);
      } else {
        s += range(rng, ...LAYOUT.afterBarrier);
      }
    } else {
      // room for the railway beside the bridge's approaches (nothing else may stand on it)
      const rail = item.bridge?.rail ?? 0;
      s += Math.max(0, rail - (item.bridge?.offset ?? 0));
      // and for the landmarks that stand before this stop
      s = Math.max(s, roomFrom + (room.before[item.id] ?? 0) + usedSince(roomFrom) + 200 + rail);
      events.push({ ...item, s });
      if (item.bridge) s += item.bridge.offset + item.bridge.length + rail + range(rng, ...LAYOUT.afterBridge);
      else s += range(rng, ...LAYOUT.afterToll);
      roomFrom = item.bridge ? s - range(rng, ...LAYOUT.afterBridge) + item.bridge.offset + 140 : s;
    }
  });
  s = Math.max(s, roomFrom + room.tail + usedSince(roomFrom) + 250);
  s = Math.round(s);
  const cityStartS = s - 300;
  const marketS = s + LAYOUT.cityStretch;
  events.push({ id: 'market', type: 'market', s: marketS, nameBn: 'কাওরান বাজার', icon: '{cart}' });

  // City avenue: 4 + 4 lanes from the end of the last chase stretch, junctions with traffic lights,
  // and one broken stretch between the junctions
  const wide: [number, number] = [s, marketS - CITY.wideEndBeforeMarket];
  CITY.junctions.forEach((off, i) => {
    events.push({ id: `junction${i + 1}`, type: 'junction', s: s + off, nameBn: 'চার রাস্তার মোড়', icon: '{trafficlight}' });
  });
  const [j1, j2] = CITY.junctions;
  const cityLen = range(rng, BROKEN_ROAD.cityLenMin, BROKEN_ROAD.cityLenMax);
  const cityFrom = s + j1 + 40 + rng() * Math.max(0, j2 - j1 - 80 - cityLen);
  broken.push([cityFrom, cityFrom + cityLen]);
  events.sort((a, b2) => a.s - b2.s);

  // Slow zones: every bazaar, a few schools in quiet stretches, and the market approach
  const slowZones: SlowZone[] = townZones.map(([a, b2]) => ({
    from: a, to: b2, kind: 'bazar', limitKmh: SLOW_ZONES.bazarKmh, side: rng() < 0.5 ? -1 : 1,
  }));
  const busy: [number, number][] = [
    [0, LAYOUT.highwayStart + 300], [cityStartS - 400, marketS + 400],
    ...townZones.map(([a, b2]) => [a - 200, b2 + 200] as [number, number]),
    ...broken.map(([a, b2]) => [a - 150, b2 + 150] as [number, number]),
    ...shortcuts.map((sc) => [sc.from - 200, sc.to + 200] as [number, number]),
    ...(hills ? [[hills.from - 200, hills.to + 200] as [number, number]] : []),
  ];
  for (const e of events) {
    if (e.type === 'farm' || e.type === 'market' || e.type === 'junction') continue;
    const br = crossingOf(e) ?? null;
    const rail = br?.rail ?? 0;
    const end = br ? e.s + br.offset + br.length + rail + 250 : e.s + 300;
    busy.push([Math.min(e.s - 450, e.s + (br?.offset ?? 0) - rail - 200), end]);
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
  // Village life beside the road. It only has to keep clear of what's actually built there (set pieces,
  // bazaars, schools, shortcuts, the hill road), so it gets its own tighter list. One of each kind first,
  // then the extra fields, the big sites first so they find room.
  const taken: [number, number][] = [
    [0, LAYOUT.highwayStart + 300], [cityStartS - 300, marketS + 400],
    ...townZones.map(([a, b2]) => [a - 60, b2 + 60] as [number, number]),
    ...shortcuts.map((sc) => [sc.from - 80, sc.to + 80] as [number, number]),
    ...slowZones.filter((z) => z.kind === 'school').map((z) => [z.from - 60, z.to + 60] as [number, number]),
    ...(hills ? [[hills.from - 100, hills.to + 100] as [number, number]] : []),
  ];
  for (const e of events) {
    if (e.type === 'farm' || e.type === 'market' || e.type === 'junction') continue;
    const br = crossingOf(e) ?? null;
    const rail = br?.rail ?? 0;
    taken.push([e.s - yardBefore(e) - rail, br ? e.s + br.offset + br.length + rail + br.offset + 120 : e.s + 120]);
  }
  // The landmarks look at each side of the road on its own: a village shortcut that stays on its side, a school,
  // or the railway beside a bridge (always on the left) leaves the other side free.
  const both = (from: number, to: number): Blocked => ({ from, to, side: 0 });
  const blocked: Blocked[] = [
    both(0, LAYOUT.highwayStart + 300), both(cityStartS - 300, marketS + 400),
    ...townZones.map(([a, b2]) => both(a - 60, b2 + 60)),
    ...shortcuts.flatMap((sc): Blocked[] => {
      if (!sc.crossings.length) return [{ from: sc.from - 80, to: sc.to + 80, side: sc.side }];
      // forks off on the left, passes under the highway's flyovers to the right side and back
      const [c1, c2] = sc.crossings;
      const r = SHORTCUT.deckFlat + SHORTCUT.ramp + 40;
      return [
        { from: sc.from - 80, to: c1, side: -1 }, { from: c1, to: c2, side: 1 }, { from: c2, to: sc.to + 80, side: -1 },
        both(c1 - r, c1 + r), both(c2 - r, c2 + r),
      ];
    }),
    ...slowZones.filter((z) => z.kind === 'school').map((z): Blocked => ({ from: z.from - 60, to: z.to + 60, side: z.side })),
    ...(hills ? [both(hills.from - 100, hills.to + 100)] : []),
  ];
  for (const e of events) {
    if (e.type === 'farm' || e.type === 'market' || e.type === 'junction') continue;
    const br = crossingOf(e) ?? null;
    if (!br) {
      blocked.push(both(e.s - 160, e.s + 120));
      continue;
    }
    const end = e.s + br.offset + br.length + br.offset + 120;
    blocked.push(both(e.s - yardBefore(e), end));
    if (br.rail) blocked.push({ from: e.s - 160 - br.rail, to: e.s - 160, side: -1 }, { from: end, to: end + br.rail, side: -1 });
  }
  const landmarks = placeLandmarks(sp.id, events, blocked, taken, LAYOUT.highwayStart + 400, cityStartS - 250, rng);
  const sights: Sight[] = [];
  const order: SightKind[] = ['gorurHat', 'wazMahfil', 'cricket', 'football'];
  for (const round of [0, 1]) {
    for (const kind of order) {
      const { count, length } = VILLAGE[kind];
      if (round >= count) continue;
      for (let tries = 0; tries < 400; tries++) {
        const at = LAYOUT.highwayStart + 400 + rng() * (cityStartS - LAYOUT.highwayStart - 800);
        const from = at - length / 2 - 15;
        const to = at + length / 2 + 15;
        if (taken.some(([a, b2]) => to > a && from < b2)) continue;
        sights.push({ kind, s: at, side: rng() < 0.5 ? -1 : 1 });
        taken.push([from - 40, to + 40]);
        break;
      }
    }
  }
  sights.sort((a, b2) => a.s - b2.s);
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
    broken,
    wide,
    shortcuts,
    sights,
    landmarks,
    hills,
    events,
    length: marketS + 300,
  };
}
