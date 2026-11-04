// Landmarks on the north-west routes (Jessore, Rajshahi, Bogura, Rangpur, Pabna), in road order toward Dhaka.
// All five meet at Hatikumrul and share the run over Jamuna Bridge to Gabtoli (NW_TAIL). Kumarkhali's ferry route
// crosses the Padma further south and comes in on the Dhaka–Aricha highway, joining them at Nabinagar (SAVAR).
// Sides are the real ones where known (1 = right heading to Dhaka); places off the highway get a setback.

import type { LandmarkDef, LandmarkEntry } from '../landmarks';

// ---------------------------------------------------------------- shared stretches

/** Bonpara on the Natore road, just past the Natore toll. */
const BONPARA: LandmarkDef = { nameBn: 'বনপাড়া ইন্টারচেঞ্জ', placeBn: 'বড়াইগ্রাম, নাটোর', kind: 'flyover' };

/** The nine-spired temple a little off the Hatikumrul roundabout. */
const NAVARATNA: LandmarkDef = {
  nameBn: 'হাটিকুমরুল নবরত্ন মন্দির', placeBn: 'উল্লাপাড়া, সিরাজগঞ্জ', kind: 'temple', model: 'navaratna', size: [50, 44], setback: 40,
};

/** The Dhaka–Aricha highway from Nabinagar into Dhaka: the memorial west of the road, JU east of it. */
const SAVAR: LandmarkEntry[] = [
  { nameBn: 'জাতীয় স্মৃতিসৌধ', placeBn: 'নবীনগর, সাভার', kind: 'monument', model: 'smritisoudho', size: [100, 110], side: 1 },
  { nameBn: 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয়', placeBn: 'সাভার, ঢাকা', kind: 'university', model: 'jahangirnagar', size: [110, 80], side: -1 },
  { nameBn: 'সাভার সেনানিবাস', placeBn: 'সাভার, ঢাকা', kind: 'cantonment', side: 1 },
  { nameBn: 'গাবতলী বাস টার্মিনাল', placeBn: 'মিরপুর, ঢাকা', kind: 'busTerminal', side: -1 },
];

/** Hatikumrul → Jamuna Bridge → Tangail → Savar → Gabtoli: every NW route ends with this. */
const NW_TAIL: LandmarkEntry[] = [
  { nameBn: 'হাটিকুমরুল গোলচত্বর', placeBn: 'উল্লাপাড়া, সিরাজগঞ্জ', kind: 'chattar' },
  { nameBn: 'যমুনা সেতু পশ্চিম রেলস্টেশন', placeBn: 'সিরাজগঞ্জ', kind: 'station' },
  { stop: 'jamuna' },
  { nameBn: 'যমুনা রিসোর্ট', placeBn: 'ভূঞাপুর, টাঙ্গাইল', kind: 'hotel', model: 'jamunaResort', size: [90, 60] },
  { nameBn: 'এলেঙ্গা রিসোর্ট', placeBn: 'এলেঙ্গা, টাঙ্গাইল', kind: 'hotel' },
  { nameBn: 'মির্জাপুর ক্যাডেট কলেজ', placeBn: 'মির্জাপুর, টাঙ্গাইল', kind: 'college', model: 'mirzapurCadet', size: [80, 55] },
  { nameBn: 'কুমুদিনী হাসপাতাল', placeBn: 'মির্জাপুর, টাঙ্গাইল', kind: 'hospital', model: 'kumudini', size: [70, 50], setback: 30 },
  { nameBn: 'আনসার-ভিডিপি একাডেমি', placeBn: 'সফিপুর, গাজীপুর', kind: 'cantonment' },
  { nameBn: 'কালিয়াকৈর হাই-টেক পার্ক', placeBn: 'কালিয়াকৈর, গাজীপুর', kind: 'govtBuilding' },
  { nameBn: 'চন্দ্রা মোড়', placeBn: 'কালিয়াকৈর, গাজীপুর', kind: 'chattar' },
  { nameBn: 'ঢাকা ইপিজেড', placeBn: 'আশুলিয়া, সাভার', kind: 'factory', model: 'dhakaEpz', size: [110, 70] },
  ...SAVAR,
];

/** Bogura's stretch of N5, shared by the Bogura and Rangpur runs. */
const MAHASTHAN: LandmarkDef = {
  nameBn: 'মহাস্থানগড়', placeBn: 'শিবগঞ্জ, বগুড়া', kind: 'ruins', model: 'mahasthangarh', size: [120, 80], side: -1,
};
const BALKHI: LandmarkDef = { nameBn: 'শাহ সুলতান বলখী (রহ.) মাজার', placeBn: 'মহাস্থান, বগুড়া', kind: 'mazar', side: -1 };
const CHARMATHA: LandmarkDef = { nameBn: 'চারমাথা বাস টার্মিনাল', placeBn: 'বগুড়া', kind: 'busTerminal' };
const MAJHIRA: LandmarkDef = { nameBn: 'মাঝিড়া সেনানিবাস', placeBn: 'শাজাহানপুর, বগুড়া', kind: 'cantonment' };
const FOOD_VILLAGE: LandmarkDef = { nameBn: 'ফুড ভিলেজ', placeBn: 'সিরাজগঞ্জ', kind: 'hotel' };

// ---------------------------------------------------------------- routes

export const LANDMARKS_NORTHWEST: Record<string, LandmarkEntry[]> = {
  // N7 north through Jhenaidah and Kushtia, Lalon Shah Bridge, then Ishwardi → Bonpara → Hatikumrul
  jessore: [
    { nameBn: 'যশোর বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', placeBn: 'চুড়ামনকাটি, যশোর', kind: 'university' },
    { nameBn: 'বারোবাজার প্রত্নস্থল', placeBn: 'কালীগঞ্জ, ঝিনাইদহ', kind: 'ruins', model: 'barobazar', size: [90, 60], setback: 20 },
    { nameBn: 'মোবারকগঞ্জ চিনিকল', placeBn: 'কালীগঞ্জ, ঝিনাইদহ', kind: 'sugarMill' },
    { nameBn: 'পায়রা চত্বর', placeBn: 'ঝিনাইদহ', kind: 'chattar', model: 'payraChattar' },
    { nameBn: 'ইসলামী বিশ্ববিদ্যালয়', placeBn: 'শান্তিডাঙ্গা, কুষ্টিয়া', kind: 'university' },
    { nameBn: 'ভেড়ামারা বিদ্যুৎকেন্দ্র', placeBn: 'ভেড়ামারা, কুষ্টিয়া', kind: 'powerPlant', model: 'bheramaraPP', size: [120, 85] },
    { stop: 'lalon' },
    // the reactors and cooling towers rise on the Padma bank right beside the bridge's north end
    {
      nameBn: 'রূপপুর পারমাণবিক বিদ্যুৎকেন্দ্র', placeBn: 'ঈশ্বরদী, পাবনা', kind: 'powerPlant', model: 'rooppur', size: [220, 160],
      side: 1, pin: true,
    },
    { nameBn: 'ঈশ্বরদী ইপিজেড', placeBn: 'পাকশী, পাবনা', kind: 'factory' },
    { nameBn: 'দাশুড়িয়া মোড়', placeBn: 'ঈশ্বরদী, পাবনা', kind: 'chattar' },
    { stop: 'natore' },
    BONPARA,
    NAVARATNA,
    ...NW_TAIL,
  ],

  // East along the Rajshahi–Natore road: the city, the campuses, Puthia, Natore, Bonpara
  rajshahi: [
    { nameBn: 'শিরোইল বাস টার্মিনাল', placeBn: 'রাজশাহী', kind: 'busTerminal' },
    { nameBn: 'রাজশাহী প্রকৌশল ও প্রযুক্তি বিশ্ববিদ্যালয়', placeBn: 'কাজলা, রাজশাহী', kind: 'university', side: 1 },
    { nameBn: 'রাজশাহী বিশ্ববিদ্যালয়', placeBn: 'মতিহার, রাজশাহী', kind: 'university', side: 1 },
    { nameBn: 'রাজশাহী চিনিকল', placeBn: 'হরিয়ান, রাজশাহী', kind: 'sugarMill' },
    { nameBn: 'বানেশ্বর হাট', placeBn: 'পুঠিয়া, রাজশাহী', kind: 'market' },
    { nameBn: 'পুঠিয়া মন্দির', placeBn: 'পুঠিয়া, রাজশাহী', kind: 'temple', model: 'puthiaShiva', size: [80, 60], setback: 45 },
    { nameBn: 'নাটোর চিনিকল', placeBn: 'নাটোর', kind: 'sugarMill' },
    { nameBn: 'বনবেলঘরিয়া বাইপাস', placeBn: 'নাটোর', kind: 'chattar' },
    { stop: 'natore' },
    BONPARA,
    NAVARATNA,
    ...NW_TAIL,
  ],

  // N5 south: Mahasthan, Bogura town, Majhira, Sherpur, Chandaikona, Hatikumrul
  bogura: [
    MAHASTHAN,
    BALKHI,
    { nameBn: 'মাটিডালি মোড়', placeBn: 'বগুড়া', kind: 'chattar' },
    CHARMATHA,
    { nameBn: 'বনানী মোড়', placeBn: 'বগুড়া', kind: 'chattar' },
    { nameBn: 'আরডিএ (পল্লী উন্নয়ন একাডেমি)', placeBn: 'শেরপুর রোড, বগুড়া', kind: 'govtBuilding' },
    MAJHIRA,
    { nameBn: 'খেরুয়া মসজিদ', placeBn: 'শেরপুর, বগুড়া', kind: 'mosque', model: 'kherua', size: [50, 40], setback: 40 },
    { nameBn: 'চান্দাইকোনা বাজার', placeBn: 'রায়গঞ্জ, সিরাজগঞ্জ', kind: 'market' },
    FOOD_VILLAGE,
    ...NW_TAIL,
  ],

  // N5 south from Rangpur through Pirganj, Palashbari and Gobindaganj into Bogura
  rangpur: [
    { nameBn: 'মডার্ন মোড়', placeBn: 'রংপুর', kind: 'chattar' },
    { nameBn: 'বেগম রোকেয়া বিশ্ববিদ্যালয়', placeBn: 'রংপুর', kind: 'university' },
    { nameBn: 'মিঠাপুকুর বড় মসজিদ', placeBn: 'মিঠাপুকুর, রংপুর', kind: 'mosque', model: 'mithapukur', size: [50, 42], setback: 35 },
    { nameBn: 'ফতেপুর তোরণ', kind: 'gateSign' },
    { nameBn: 'পলাশবাড়ী চৌমাথা', placeBn: 'পলাশবাড়ী, গাইবান্ধা', kind: 'chattar' },
    { nameBn: 'গোবিন্দগঞ্জ বাজার', placeBn: 'গোবিন্দগঞ্জ, গাইবান্ধা', kind: 'market' },
    MAHASTHAN,
    BALKHI,
    CHARMATHA,
    MAJHIRA,
    FOOD_VILLAGE,
    ...NW_TAIL,
  ],

  // Pabna town, Kashinathpur, Baghabari on the Hurasagar, Shahjadpur, Hatikumrul
  pabna: [
    { nameBn: 'জোড় বাংলা মন্দির', placeBn: 'পাবনা', kind: 'temple', model: 'jorBangla', size: [36, 30], setback: 30 },
    { nameBn: 'পাবনা বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', placeBn: 'রাজাপুর, পাবনা', kind: 'university', side: 1 },
    { nameBn: 'পাবনা ক্যাডেট কলেজ', placeBn: 'পাবনা', kind: 'college', side: -1 },
    { nameBn: 'কাশিনাথপুর মোড়', placeBn: 'সাঁথিয়া, পাবনা', kind: 'chattar' },
    { nameBn: 'বাঘাবাড়ী নৌবন্দর', placeBn: 'শাহজাদপুর, সিরাজগঞ্জ', kind: 'riverGhat' },
    { nameBn: 'বাঘাবাড়ী বিদ্যুৎকেন্দ্র', placeBn: 'শাহজাদপুর, সিরাজগঞ্জ', kind: 'powerPlant' },
    { nameBn: 'মিল্ক ভিটা কারখানা', placeBn: 'বাঘাবাড়ী, সিরাজগঞ্জ', kind: 'factory', model: 'milkVita' },
    { nameBn: 'রবীন্দ্র কাছারিবাড়ি', placeBn: 'শাহজাদপুর, সিরাজগঞ্জ', kind: 'museum', model: 'rabindraKachharibari', size: [56, 44], setback: 35 },
    NAVARATNA,
    ...NW_TAIL,
  ],
  // R710 from Kumarkhali through Khoksa and Pangsha to Rajbari, Goalanda Mor (N7) and Daulatdia ghat; the ferry to
  // Paturia; the Dhaka–Aricha highway through Shibalaya, Manikganj and Dhamrai to Nabinagar
  kumarkhali: [
    { nameBn: 'শিলাইদহ কুঠিবাড়ি', placeBn: 'কুমারখালী, কুষ্টিয়া', kind: 'museum', model: 'kuthibari', size: [70, 55], setback: 30 },
    { nameBn: 'কাঙাল হরিনাথ স্মৃতি জাদুঘর', placeBn: 'কুমারখালী, কুষ্টিয়া', kind: 'museum' },
    { nameBn: 'কুমারখালী তাঁতপল্লী', placeBn: 'কুমারখালী, কুষ্টিয়া', kind: 'market' },
    { nameBn: 'মীর মশাররফ হোসেনের বাস্তুভিটা', placeBn: 'লাহিনীপাড়া, কুমারখালী', kind: 'museum', setback: 25 },
    { nameBn: 'কুমারখালী রেলস্টেশন', placeBn: 'কুমারখালী, কুষ্টিয়া', kind: 'station' },
    { nameBn: 'জানিপুর কালীমন্দির', placeBn: 'খোকসা, কুষ্টিয়া', kind: 'temple' },
    { nameBn: 'পাংশা সরকারি কলেজ', placeBn: 'পাংশা, রাজবাড়ী', kind: 'college' },
    { nameBn: 'রাজবাড়ী রেলস্টেশন', placeBn: 'রাজবাড়ী', kind: 'station' },
    { nameBn: 'রাজবাড়ী সরকারি কলেজ', placeBn: 'রাজবাড়ী', kind: 'college' },
    { nameBn: 'গোয়ালন্দ মোড়', placeBn: 'গোয়ালন্দ, রাজবাড়ী', kind: 'chattar' },
    { nameBn: 'গোয়ালন্দ ঘাট রেলস্টেশন', placeBn: 'দৌলতদিয়া, রাজবাড়ী', kind: 'station' },
    { nameBn: 'দৌলতদিয়া লঞ্চঘাট', placeBn: 'গোয়ালন্দ, রাজবাড়ী', kind: 'riverGhat' },
    { stop: 'daulatdia' },
    { nameBn: 'পাটুরিয়া লঞ্চঘাট', placeBn: 'শিবালয়, মানিকগঞ্জ', kind: 'riverGhat', pin: true },
    { nameBn: 'তেওতা জমিদারবাড়ি', placeBn: 'শিবালয়, মানিকগঞ্জ', kind: 'ruins', setback: 30 },
    { nameBn: 'বালিয়াটি জমিদারবাড়ি', placeBn: 'সাটুরিয়া, মানিকগঞ্জ', kind: 'museum', model: 'baliati', size: [92, 56], setback: 40 },
    { nameBn: 'সরকারি দেবেন্দ্র কলেজ', placeBn: 'মানিকগঞ্জ', kind: 'college' },
    { nameBn: 'মানিকগঞ্জ বাসস্ট্যান্ড', placeBn: 'মানিকগঞ্জ', kind: 'busTerminal' },
    { nameBn: 'মানিকগঞ্জ ২৫০ শয্যা জেলা হাসপাতাল', placeBn: 'মানিকগঞ্জ', kind: 'hospital' },
    { nameBn: 'ধামরাই জগন্নাথ রথ', placeBn: 'ধামরাই, ঢাকা', kind: 'temple', model: 'dhamraiRath', size: [44, 36], setback: 20 },
    ...SAVAR.slice(0, 2),
    { nameBn: 'বিপিএটিসি', placeBn: 'সাভার, ঢাকা', kind: 'govtBuilding' },
    SAVAR[2],
    { nameBn: 'হেমায়েতপুর চামড়া শিল্পনগরী', placeBn: 'সাভার, ঢাকা', kind: 'factory' },
    { nameBn: 'আমিনবাজার সেতু (তুরাগ)', placeBn: 'আমিনবাজার, সাভার', kind: 'bridgeView' },
    ...SAVAR.slice(3),
  ],
};
