// Landmarks on the eastern routes, in road order toward Dhaka:
// - Cumilla: Victoria College and Dharmasagar in town, out past Kotbari (BARD, Shalban Vihara, Lalmai) onto N1
// - Rangamati: the hanging bridge on Kaptai Lake, down N106 through Raozan and Hathazari, the Bayezid link
//   road onto N1 at Fouzdarhat, then north past Bhatiary, the Sitakunda ship-breaking yards and Mirsarai to Feni
// - Bandarban: the Golden Temple, Keranihat, Dohazari and Patiya, over Shah Amanat Bridge, through the city to N1
// All three then share the Cumilla → Meghna → Kanchpur tail (the hill routes take only its big sights).
// Heading to Dhaka on N1 from Chattogram the sea is on the left, the Sitakunda hills on the right.

import type { LandmarkDef, LandmarkEntry } from '../landmarks';

// ---------------------------------------------------------------- the East tail (Cumilla → Dhaka)

const CUMILLA_CANTT: LandmarkDef = { nameBn: 'কুমিল্লা সেনানিবাস', placeBn: 'ময়নামতি, কুমিল্লা', kind: 'cantonment', side: 1 };
const WAR_CEMETERY: LandmarkDef = { nameBn: 'ময়নামতি ওয়ার সিমেট্রি', placeBn: 'ময়নামতি, কুমিল্লা', kind: 'cemetery', model: 'warCemetery', size: [90, 70], side: 1, setback: 30 };
const NIMSAR: LandmarkDef = { nameBn: 'নিমসার কাঁচাবাজার', placeBn: 'বুড়িচং, কুমিল্লা', kind: 'market' };
const CHANDINA: LandmarkDef = { nameBn: 'চান্দিনা বাজার', placeBn: 'চান্দিনা, কুমিল্লা', kind: 'market' };
const ELLIOTGANJ: LandmarkDef = { nameBn: 'ইলিয়টগঞ্জ বাজার', placeBn: 'দাউদকান্দি, কুমিল্লা', kind: 'market' };
const GOURIPUR: LandmarkDef = { nameBn: 'গৌরীপুর বাসস্ট্যান্ড', placeBn: 'দাউদকান্দি, কুমিল্লা', kind: 'busTerminal' };
const BHABERCHAR: LandmarkDef = { nameBn: 'ভবেরচর শিল্প এলাকা', placeBn: 'গজারিয়া, মুন্সীগঞ্জ', kind: 'factory' };
const MEGHNAGHAT: LandmarkDef = { nameBn: 'মেঘনাঘাট বিদ্যুৎকেন্দ্র', placeBn: 'সোনারগাঁও, নারায়ণগঞ্জ', kind: 'powerPlant', model: 'meghnaghatPower', size: [150, 100], side: -1, setback: 15 };
const MEGHNA_INDUSTRIAL: LandmarkDef = { nameBn: 'মেঘনা শিল্পাঞ্চল', placeBn: 'সোনারগাঁও, নারায়ণগঞ্জ', kind: 'factory', side: -1 };
const PANAM: LandmarkDef = { nameBn: 'পানাম নগর', placeBn: 'সোনারগাঁও, নারায়ণগঞ্জ', kind: 'ruins', model: 'panamNagar', size: [90, 80], side: 1, setback: 50 };
const FOLK_ARTS: LandmarkDef = { nameBn: 'লোক ও কারুশিল্প জাদুঘর', placeBn: 'সোনারগাঁও, নারায়ণগঞ্জ', kind: 'museum', model: 'folkArtsMuseum', size: [90, 75], side: 1, setback: 40 };
const KANCHPUR: LandmarkDef = { nameBn: 'কাঁচপুর সেতু', placeBn: 'শীতলক্ষ্যা নদী, নারায়ণগঞ্জ', kind: 'bridgeView', model: 'kanchpurBridge', size: [110, 90] };
const SIGNBOARD: LandmarkDef = { nameBn: 'সাইনবোর্ড মোড়', placeBn: 'সিদ্ধিরগঞ্জ, নারায়ণগঞ্জ', kind: 'chattar' };
const HANIF_FLYOVER: LandmarkDef = { nameBn: 'মেয়র মোহাম্মদ হানিফ ফ্লাইওভার', placeBn: 'যাত্রাবাড়ী, ঢাকা', kind: 'flyover' };
const SAYEDABAD: LandmarkDef = { nameBn: 'সায়েদাবাদ বাস টার্মিনাল', placeBn: 'ঢাকা', kind: 'busTerminal' };

/** Cumilla's own: the whole tail. */
const EAST_TAIL: LandmarkEntry[] = [
  CUMILLA_CANTT, WAR_CEMETERY, NIMSAR, CHANDINA, ELLIOTGANJ, GOURIPUR,
  { stop: 'meghnaGumti' },
  BHABERCHAR,
  { stop: 'meghna' },
  MEGHNAGHAT, MEGHNA_INDUSTRIAL, PANAM, FOLK_ARTS, KANCHPUR, SIGNBOARD, HANIF_FLYOVER, SAYEDABAD,
];

/** The hill routes are long already: only the big sights of the tail. */
const EAST_TAIL_SHORT: LandmarkEntry[] = [
  CUMILLA_CANTT, WAR_CEMETERY, CHANDINA,
  { stop: 'meghnaGumti' },
  { stop: 'meghna' },
  MEGHNAGHAT, PANAM, KANCHPUR, SAYEDABAD,
];

// ---------------------------------------------------------------- N1, Chattogram → Feni (both hill routes)

const BAYEZID: LandmarkDef = { nameBn: 'বায়েজিদ বোস্তামী মাজার', placeBn: 'নাসিরাবাদ, চট্টগ্রাম', kind: 'mazar' };
const FAUJDARHAT_CADET: LandmarkDef = { nameBn: 'ফৌজদারহাট ক্যাডেট কলেজ', placeBn: 'সীতাকুণ্ড, চট্টগ্রাম', kind: 'college', model: 'faujdarhatCadet', size: [80, 60], side: 1 };
const BMA: LandmarkDef = { nameBn: 'বাংলাদেশ মিলিটারি একাডেমি', placeBn: 'ভাটিয়ারী, সীতাকুণ্ড', kind: 'cantonment', model: 'bma', size: [70, 50], side: 1 };
const SHIP_BREAKING: LandmarkDef = { nameBn: 'জাহাজভাঙা ইয়ার্ড', placeBn: 'সীতাকুণ্ড, চট্টগ্রাম', kind: 'shipyard', model: 'shipBreaking', size: [160, 120], side: -1, setback: 20 };
const CHANDRANATH: LandmarkDef = { nameBn: 'চন্দ্রনাথ মন্দির', placeBn: 'সীতাকুণ্ড, চট্টগ্রাম', kind: 'temple', model: 'chandranath', size: [120, 110], side: 1, setback: 60 };
const MOHAMAYA: LandmarkDef = { nameBn: 'মহামায়া লেক', placeBn: 'মীরসরাই, চট্টগ্রাম', kind: 'lake', side: 1, setback: 50 };
const MOHIPAL: LandmarkDef = { nameBn: 'মহিপাল ফ্লাইওভার', placeBn: 'ফেনী', kind: 'flyover', model: 'mohipalFlyover', size: [150, 34] };

export const LANDMARKS_EAST: Record<string, LandmarkEntry[]> = {
  cumilla: [
    { nameBn: 'কুমিল্লা ভিক্টোরিয়া সরকারি কলেজ', placeBn: 'কুমিল্লা শহর', kind: 'college', model: 'victoriaCollege', size: [60, 45] },
    { nameBn: 'ধর্মসাগর দিঘি', placeBn: 'কুমিল্লা শহর', kind: 'lake', model: 'dharmasagar', size: [90, 70] },
    { nameBn: 'টমছম ব্রিজ মোড়', placeBn: 'কুমিল্লা শহর', kind: 'chattar' },
    { nameBn: 'কুমিল্লা মেডিকেল কলেজ', placeBn: 'কুমিল্লা', kind: 'hospital' },
    { nameBn: 'কুমিল্লা বিশ্ববিদ্যালয়', placeBn: 'কোটবাড়ি, কুমিল্লা', kind: 'university', side: -1 },
    { nameBn: 'বাংলাদেশ পল্লী উন্নয়ন একাডেমি (বার্ড)', placeBn: 'কোটবাড়ি, কুমিল্লা', kind: 'govtBuilding', side: -1 },
    { nameBn: 'শালবন বিহার', placeBn: 'কোটবাড়ি, কুমিল্লা', kind: 'ruins', model: 'shalbanVihara', size: [90, 90], side: -1, setback: 10 },
    { nameBn: 'ময়নামতি জাদুঘর', placeBn: 'কোটবাড়ি, কুমিল্লা', kind: 'museum', side: -1 },
    { nameBn: 'লালমাই পাহাড়', placeBn: 'লালমাই, কুমিল্লা', kind: 'forest', side: -1 },
    ...EAST_TAIL,
  ],
  rangamati: [
    { nameBn: 'রিজার্ভ বাজার লঞ্চঘাট', placeBn: 'রাঙামাটি শহর', kind: 'riverGhat' },
    { nameBn: 'ঝুলন্ত সেতু', placeBn: 'তবলছড়ি, রাঙামাটি', kind: 'bridgeView', model: 'hangingBridge', size: [100, 80] },
    { nameBn: 'রাঙামাটি সেনা রিজিয়ন', placeBn: 'রাঙামাটি', kind: 'cantonment' },
    { nameBn: 'রাঙামাটি বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', placeBn: 'ঝগড়াবিল, রাঙামাটি', kind: 'university' },
    { nameBn: 'ঘাগড়া ঝর্ণা', placeBn: 'কাউখালী, রাঙামাটি', kind: 'forest', model: 'ghagraFalls', size: [50, 40] },
    { nameBn: 'ঘাগড়া বাজার', placeBn: 'কাউখালী, রাঙামাটি', kind: 'market' },
    { nameBn: 'জেলা সীমানা তোরণ', placeBn: 'রাঙামাটি পার্বত্য জেলা', kind: 'gateSign' },
    { nameBn: 'কুণ্ডেশ্বরী মন্দির', placeBn: 'গহিরা, রাউজান', kind: 'temple', model: 'kundeshwari', size: [50, 40] },
    { nameBn: 'রাউজান কলেজ', placeBn: 'রাউজান, চট্টগ্রাম', kind: 'college' },
    { nameBn: 'জগন্নাথ হাট', placeBn: 'রাউজান, চট্টগ্রাম', kind: 'market' },
    { nameBn: 'দারুল উলূম হাটহাজারী মাদ্রাসা', placeBn: 'হাটহাজারী, চট্টগ্রাম', kind: 'madrasa', model: 'hathazariMadrasa', size: [70, 50] },
    { nameBn: 'হাটহাজারী বাসস্ট্যান্ড', placeBn: 'হাটহাজারী, চট্টগ্রাম', kind: 'busTerminal' },
    { nameBn: 'চট্টগ্রাম বিশ্ববিদ্যালয় ১ নম্বর গেট', placeBn: 'হাটহাজারী, চট্টগ্রাম', kind: 'gateSign', model: 'cuGate', size: [40, 30] },
    { nameBn: 'চট্টগ্রাম সেনানিবাস', placeBn: 'চট্টগ্রাম', kind: 'cantonment' },
    BAYEZID,
    FAUJDARHAT_CADET,
    BMA,
    SHIP_BREAKING,
    { nameBn: 'সীতাকুণ্ড ইকো পার্ক', placeBn: 'সীতাকুণ্ড, চট্টগ্রাম', kind: 'park', side: 1 },
    CHANDRANATH,
    { nameBn: 'মীরসরাই অর্থনৈতিক অঞ্চল', placeBn: 'মীরসরাই, চট্টগ্রাম', kind: 'factory', side: -1, setback: 20 },
    MOHAMAYA,
    MOHIPAL,
    ...EAST_TAIL_SHORT,
  ],
  bandarban: [
    { nameBn: 'বান্দরবান বাস টার্মিনাল', placeBn: 'বান্দরবান শহর', kind: 'busTerminal' },
    { nameBn: 'বান্দরবান সেনানিবাস', placeBn: 'বান্দরবান', kind: 'cantonment' },
    { nameBn: 'বান্দরবান পার্বত্য জেলা পরিষদ', placeBn: 'বান্দরবান শহর', kind: 'govtBuilding' },
    { nameBn: 'মেঘলা পর্যটন কমপ্লেক্স', placeBn: 'বান্দরবান সদর', kind: 'park' },
    { nameBn: 'বুদ্ধ ধাতু জাদি (স্বর্ণমন্দির)', placeBn: 'বালাঘাটা, বান্দরবান', kind: 'buddhist', model: 'goldenTemple', size: [90, 80], setback: 30 },
    { nameBn: 'বাজালিয়া বাজার', placeBn: 'সাতকানিয়া, চট্টগ্রাম', kind: 'market' },
    { nameBn: 'কেরানীহাট মোড়', placeBn: 'সাতকানিয়া, চট্টগ্রাম', kind: 'chattar' },
    { nameBn: 'দোহাজারী শঙ্খ সেতু', placeBn: 'চন্দনাইশ, চট্টগ্রাম', kind: 'bridgeView' },
    { nameBn: 'দোহাজারী রেলস্টেশন', placeBn: 'চন্দনাইশ, চট্টগ্রাম', kind: 'station' },
    { nameBn: 'গাছবাড়িয়া সরকারি কলেজ', placeBn: 'চন্দনাইশ, চট্টগ্রাম', kind: 'college' },
    { nameBn: 'কাঞ্চননগর পেয়ারার হাট', placeBn: 'চন্দনাইশ, চট্টগ্রাম', kind: 'market' },
    { nameBn: 'আল-জামিয়া আল-ইসলামিয়া পটিয়া', placeBn: 'পটিয়া, চট্টগ্রাম', kind: 'madrasa' },
    { nameBn: 'পটিয়া বাসস্ট্যান্ড', placeBn: 'পটিয়া, চট্টগ্রাম', kind: 'busTerminal' },
    { stop: 'shahAmanat' },
    { nameBn: 'বহদ্দারহাট বাস টার্মিনাল', placeBn: 'চট্টগ্রাম', kind: 'busTerminal' },
    BAYEZID,
    FAUJDARHAT_CADET,
    BMA,
    SHIP_BREAKING,
    { nameBn: 'কুমিরা ঘাট', placeBn: 'সীতাকুণ্ড, চট্টগ্রাম', kind: 'riverGhat', side: -1 },
    CHANDRANATH,
    MOHAMAYA,
    MOHIPAL,
    ...EAST_TAIL_SHORT,
  ],
};
