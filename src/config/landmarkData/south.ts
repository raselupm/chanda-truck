// Landmarks of the southern routes: Faridpur, Patuakhali (N8 via Barishal), Khulna (N7/N805 via Gopalganj)
// and Narail (Kalna). All four meet at Bhanga and share the run to Dhaka: the cloverleaf and the new
// Padma rail link stations, Padma Bridge (Jajira → Mawa), the Dhaka–Mawa expressway past Keraniganj jail,
// and over the Buriganga at Babubazar. Own models live in world/landmarkModels/south.ts.

import type { LandmarkDef, LandmarkEntry } from '../landmarks';

/** Bhanga → Padma Bridge → expressway → Babubazar: the same for every southern route. */
const SOUTH_TAIL: LandmarkEntry[] = [
  { nameBn: 'ভাঙ্গা গোলচত্বর', placeBn: 'ভাঙ্গা, ফরিদপুর', kind: 'chattar' },
  { nameBn: 'ভাঙ্গা ইন্টারচেঞ্জ', placeBn: 'ভাঙ্গা, ফরিদপুর', kind: 'flyover', model: 'bhangaInterchange', size: [170, 125] },
  { nameBn: 'ভাঙ্গা জংশন রেলস্টেশন', placeBn: 'ভাঙ্গা, ফরিদপুর', kind: 'station', model: 'bhangaStation', size: [130, 70] },
  { nameBn: 'পুলিয়া বাজার', placeBn: 'ভাঙ্গা, ফরিদপুর', kind: 'market' },
  { nameBn: 'শিবচর রেলস্টেশন', placeBn: 'শিবচর, মাদারীপুর', kind: 'station', model: 'padmaLinkStation', size: [100, 42] },
  { nameBn: 'পদ্মা রেলস্টেশন', placeBn: 'জাজিরা, শরীয়তপুর', kind: 'station', model: 'padmaLinkStation', size: [100, 42] },
  // Sheikh Russel Cantonment until 2025, renamed Padma Cantonment
  { nameBn: 'পদ্মা সেনানিবাস', placeBn: 'জাজিরা, শরীয়তপুর', kind: 'cantonment' },
  { nameBn: 'জাজিরা সার্ভিস এরিয়া', placeBn: 'পদ্মা সেতু, জাজিরা প্রান্ত', kind: 'hotel', model: 'jajiraServiceArea', size: [90, 55] },
  { stop: 'padma' },
  { nameBn: 'মাওয়া সার্ভিস এরিয়া', placeBn: 'পদ্মা সেতু, মাওয়া প্রান্ত', kind: 'hotel', model: 'mawaServiceArea', size: [90, 55], pin: true },
  { nameBn: 'মাওয়া রেলস্টেশন', placeBn: 'লৌহজং, মুন্সীগঞ্জ', kind: 'station', model: 'padmaLinkStation', size: [100, 42] },
  // the old ferry ghat lies east of the bridge approach
  { nameBn: 'শিমুলিয়া ফেরিঘাট', placeBn: 'লৌহজং, মুন্সীগঞ্জ', kind: 'riverGhat', model: 'shimuliaGhat', size: [80, 55], side: 1 },
  { nameBn: 'শ্রীনগর ফ্লাইওভার', placeBn: 'শ্রীনগর, মুন্সীগঞ্জ', kind: 'flyover' },
  // Nimtala (Sirajdikhan) is south of the Dhaleshwari, the jail north of it
  { nameBn: 'নিমতলা রেলস্টেশন', placeBn: 'সিরাজদিখান, মুন্সীগঞ্জ', kind: 'station', model: 'padmaLinkStation', size: [100, 42] },
  { stop: 'expressway' },
  { nameBn: 'কেরানীগঞ্জ কেন্দ্রীয় কারাগার', placeBn: 'কেরানীগঞ্জ, ঢাকা', kind: 'jail', model: 'keraniganjJail', size: [150, 110] },
  { nameBn: 'হাসনাবাদ', placeBn: 'দক্ষিণ কেরানীগঞ্জ', kind: 'market' },
  { nameBn: 'বাবুবাজার সেতু', placeBn: 'বুড়িগঙ্গা, ঢাকা', kind: 'bridgeView' },
];

/** Shankarpasha (Faridpur and Narail roads) and Bhatiapara (Khulna and Narail roads). */
const SHANKARPASHA: LandmarkDef = { nameBn: 'শংকরপাশা', kind: 'market' };
const BHATIAPARA_THANA: LandmarkDef = { nameBn: 'ভাটিয়াপাড়া হাইওয়ে থানা', placeBn: 'কাশিয়ানী, গোপালগঞ্জ', kind: 'govtBuilding' };

export const LANDMARKS_SOUTH: Record<string, LandmarkEntry[]> = {
  faridpur: [
    { nameBn: 'আলীপুর চত্বর', placeBn: 'ফরিদপুর', kind: 'chattar' },
    { nameBn: 'ফরিদপুর মেডিকেল কলেজ হাসপাতাল', placeBn: 'ফরিদপুর', kind: 'hospital' },
    { nameBn: 'তালমা বাজার', placeBn: 'নগরকান্দা, ফরিদপুর', kind: 'market' },
    { nameBn: 'ভাবুকদিয়া বাসস্ট্যান্ড', placeBn: 'ভাঙ্গা, ফরিদপুর', kind: 'busTerminal' },
    SHANKARPASHA,
    { nameBn: 'কুমার নদের পাড়ের ইটভাটা', placeBn: 'ফরিদপুর', kind: 'brickKilns' },
    ...SOUTH_TAIL,
  ],
  patuakhali: [
    { nameBn: 'পটুয়াখালী বাস টার্মিনাল', placeBn: 'পটুয়াখালী', kind: 'busTerminal' },
    { nameBn: 'পটুয়াখালী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', placeBn: 'দুমকি, পটুয়াখালী', kind: 'university' },
    { nameBn: 'লেবুখালী ফেরিঘাট', placeBn: 'দুমকি, পটুয়াখালী', kind: 'riverGhat' },
    { stop: 'payra' },
    { nameBn: 'বরিশাল বিশ্ববিদ্যালয়', placeBn: 'কর্ণকাঠি, বরিশাল', kind: 'university', model: 'barishalUniversity', size: [90, 70] },
    { nameBn: 'দপদপিয়া সেতু', placeBn: 'কীর্তনখোলা, বরিশাল', kind: 'bridgeView' },
    { nameBn: 'বরিশাল বিমানবন্দর', placeBn: 'রহমতপুর, বরিশাল', kind: 'airport', model: 'barishalAirport', size: [200, 120] },
    { nameBn: 'শিকারপুর উগ্রতারা মন্দির', placeBn: 'উজিরপুর, বরিশাল', kind: 'temple', model: 'ugraTara', size: [50, 45] },
    { nameBn: 'বামরাইল বাজার', placeBn: 'উজিরপুর, বরিশাল', kind: 'market' },
    { nameBn: 'বাটাজোর বাজার', placeBn: 'গৌরনদী, বরিশাল', kind: 'market' },
    { nameBn: 'মাহিলারা সরকার মঠ', placeBn: 'গৌরনদী, বরিশাল', kind: 'temple', model: 'mahilaraMath', size: [36, 36], setback: 50 },
    { nameBn: 'ভুরঘাটা বাসস্ট্যান্ড', placeBn: 'কালকিনি, মাদারীপুর', kind: 'busTerminal' },
    { nameBn: 'মোস্তফাপুর মোড়', placeBn: 'মাদারীপুর', kind: 'chattar' },
    { nameBn: 'টেকেরহাট বন্দর', placeBn: 'রাজৈর, মাদারীপুর', kind: 'riverGhat' },
    ...SOUTH_TAIL,
  ],
  khulna: [
    { nameBn: 'সোনাডাঙ্গা বাস টার্মিনাল', placeBn: 'খুলনা', kind: 'busTerminal' },
    { nameBn: 'রূপসা সেতু', placeBn: 'খান জাহান আলী সেতু, খুলনা', kind: 'bridgeView', model: 'rupshaBridge', size: [70, 140] },
    { nameBn: 'কাটাখালী মোড়', placeBn: 'ফকিরহাট, বাগেরহাট', kind: 'chattar' },
    { nameBn: 'ষাটগম্বুজ মসজিদ', placeBn: 'বাগেরহাট', kind: 'gateSign', model: 'shatGambujSign', size: [24, 10] },
    { nameBn: 'ফকিরহাট বাসস্ট্যান্ড', placeBn: 'ফকিরহাট, বাগেরহাট', kind: 'busTerminal' },
    { stop: 'mollahat' },
    { nameBn: 'ঘোনাপাড়া মোড়', placeBn: 'গোপালগঞ্জ', kind: 'chattar' },
    { nameBn: 'টুঙ্গিপাড়া', placeBn: 'গোপালগঞ্জ', kind: 'gateSign' },
    { nameBn: 'সোশগাতী', placeBn: 'গোপালগঞ্জ', kind: 'market' },
    BHATIAPARA_THANA,
    { nameBn: 'পোনা বাসস্ট্যান্ড', placeBn: 'কাশিয়ানী, গোপালগঞ্জ', kind: 'busTerminal' },
    { nameBn: 'সুয়াদী', placeBn: 'মুকসুদপুর, গোপালগঞ্জ', kind: 'market' },
    ...SOUTH_TAIL,
  ],
  narail: [
    { nameBn: 'এস এম সুলতান স্মৃতি সংগ্রহশালা', placeBn: 'মাছিমদিয়া, নড়াইল', kind: 'museum', model: 'smSultan', size: [80, 60], setback: 30 },
    { nameBn: 'নড়াইল বাস টার্মিনাল', placeBn: 'নড়াইল', kind: 'busTerminal' },
    { nameBn: 'লোহাগড়া বাজার', placeBn: 'লোহাগড়া, নড়াইল', kind: 'market' },
    { nameBn: 'লক্ষ্মীপাশা কালীমন্দির', placeBn: 'লোহাগড়া, নড়াইল', kind: 'temple', setback: 35 },
    { nameBn: 'কালনা ফেরিঘাট', placeBn: 'লোহাগড়া, নড়াইল', kind: 'riverGhat' },
    { stop: 'madhumati' },
    SHANKARPASHA,
    { nameBn: 'ভাটিয়াপাড়া ঘাট স্টেশন', placeBn: 'কাশিয়ানী, গোপালগঞ্জ', kind: 'station' },
    BHATIAPARA_THANA,
    ...SOUTH_TAIL,
  ],
};
