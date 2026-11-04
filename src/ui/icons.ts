// Flat SVG icon set (replaces every emoji in the game so it looks the same on every device).
// In strings, write an icon as a token: "{truck} ঢাকার পথে". DOM text goes through rich(),
// canvas text through fillRich() in utils/textures.ts. Icons drawn with currentColor follow the text colour.

const S = (body: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${body}</svg>`;
const CLOUD = 'M16 44a12 12 0 0 1 1-24 16 16 0 0 1 30 2 11 11 0 0 1 1 22z';

export const ICONS: Record<string, string> = {
  // ---- route & HUD
  farm: S('<path d="M32 62V12" stroke="#b5832a" stroke-width="4" stroke-linecap="round"/><g fill="#e9b949"><ellipse cx="32" cy="10" rx="5" ry="9"/><ellipse cx="24" cy="22" rx="5" ry="9" transform="rotate(-35 24 22)"/><ellipse cx="40" cy="22" rx="5" ry="9" transform="rotate(35 40 22)"/><ellipse cx="24" cy="36" rx="5" ry="9" transform="rotate(-35 24 36)"/><ellipse cx="40" cy="36" rx="5" ry="9" transform="rotate(35 40 36)"/></g>'),
  truck: S('<rect x="3" y="14" width="38" height="28" rx="3" fill="#f2a03d"/><path d="M8 20h28M8 27h28M8 34h28" stroke="#e63946" stroke-width="2"/><path d="M41 22h12l8 11v9H41z" fill="#2a9d8f"/><rect x="45" y="26" width="8" height="7" rx="1" fill="#bfe6f7"/><circle cx="15" cy="46" r="6.5" fill="#222"/><circle cx="51" cy="46" r="6.5" fill="#222"/><circle cx="15" cy="46" r="2.5" fill="#bbb"/><circle cx="51" cy="46" r="2.5" fill="#bbb"/>'),
  hand: S('<path d="M19 36V18a4 4 0 0 1 8 0v12V11a4 4 0 0 1 8 0v19V13a4 4 0 0 1 8 0v18V20a4 4 0 0 1 8 0v22c0 11-8 19-19 19h-1c-7 0-11-3-15-9l-7-11a4 4 0 0 1 7-5z" fill="#f4b183" stroke="#9a5d3a" stroke-width="2.5" stroke-linejoin="round"/>'),
  train: S('<rect x="13" y="5" width="38" height="46" rx="9" fill="#1d4e89"/><rect x="18" y="11" width="28" height="15" rx="3" fill="#bfe6f7"/><rect x="13" y="31" width="38" height="5" fill="#ffd166"/><circle cx="22" cy="43" r="3.5" fill="#fff3b0"/><circle cx="42" cy="43" r="3.5" fill="#fff3b0"/><path d="M19 51l-7 11M45 51l7 11" stroke="#666" stroke-width="4" stroke-linecap="round"/>'),
  crash: S('<path fill="#f77f00" d="M32 2l6 15 15-7-5 16 14 6-14 6 6 16-16-7-6 16-6-16-16 7 6-16L2 32l14-6-5-16 15 7z"/><path fill="#ffd166" d="M32 16l3 9 9-3-4 9 8 3-8 3 4 9-9-3-3 9-3-9-9 3 4-9-8-3 8-3-4-9 9 3z"/>'),
  bridge: S('<rect y="47" width="64" height="17" fill="#4f9fd6"/><path d="M0 52c6-3 10 3 16 0s10 3 16 0 10 3 16 0 10 3 16 0" stroke="#bfe6f7" stroke-width="2" fill="none"/><rect x="2" y="27" width="60" height="7" fill="#8d969c"/><path d="M4 27l8-13 8 13 8-13 8 13 8-13 8 13 8-13" fill="none" stroke="#5f686e" stroke-width="3" stroke-linejoin="round"/><rect x="13" y="34" width="6" height="14" fill="#c2bcae"/><rect x="45" y="34" width="6" height="14" fill="#c2bcae"/>'),
  ferry: S('<rect y="46" width="64" height="18" fill="#4f9fd6"/><path d="M0 52c6-3 10 3 16 0s10 3 16 0 10 3 16 0 10 3 16 0" stroke="#bfe6f7" stroke-width="2" fill="none"/><path d="M4 36h56l-6 12H10z" fill="#f2f0ea" stroke="#1d5e9e" stroke-width="2.5" stroke-linejoin="round"/><rect x="6" y="40" width="52" height="3" fill="#c1121f"/><rect x="12" y="27" width="16" height="9" rx="1.5" fill="#f2a03d"/><rect x="31" y="29" width="13" height="7" rx="1.5" fill="#2a9d8f"/><rect x="46" y="18" width="9" height="18" fill="#f2f0ea" stroke="#1d5e9e" stroke-width="2"/><rect x="48" y="21" width="5" height="4" fill="#bfe6f7"/>'),
  cart: S('<path d="M3 9h9l7 30h31l7-21H16" fill="none" stroke="#2b2d42" stroke-width="4.5" stroke-linejoin="round" stroke-linecap="round"/><path d="M18 22h35l-5 13H21z" fill="#8bd17c"/><circle cx="24" cy="49" r="5" fill="#2b2d42"/><circle cx="46" cy="49" r="5" fill="#2b2d42"/>'),
  receipt: S('<path d="M13 3h38v56l-6-4-6 4-6-4-6 4-6-4-8 4z" fill="#fff" stroke="#8a8a8a" stroke-width="2.5" stroke-linejoin="round"/><path d="M20 15h24M20 25h24M20 35h16" stroke="#555" stroke-width="3.5" stroke-linecap="round"/>'),
  sound: S('<path d="M7 24h11l14-12v40L18 40H7z" fill="currentColor"/><path d="M40 23a13 13 0 0 1 0 18M46 16a23 23 0 0 1 0 32" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>'),
  mute: S('<path d="M7 24h11l14-12v40L18 40H7z" fill="currentColor"/><path d="M41 24l15 16M56 24L41 40" stroke="#ff6b5a" stroke-width="5" stroke-linecap="round"/>'),
  warning: S('<path d="M32 4l30 54H2z" fill="#ffd23f" stroke="#1d1d1d" stroke-width="3.5" stroke-linejoin="round"/><rect x="29" y="22" width="6" height="20" rx="2.5" fill="#1d1d1d"/><circle cx="32" cy="49" r="3.6" fill="#1d1d1d"/>'),
  clipboard: S('<rect x="9" y="8" width="46" height="54" rx="5" fill="#c69c6d"/><rect x="15" y="14" width="34" height="43" rx="2" fill="#fff"/><rect x="22" y="3" width="20" height="11" rx="3" fill="#6b4a2a"/><path d="M21 26h22M21 36h22M21 46h14" stroke="#555" stroke-width="3.5" stroke-linecap="round"/>'),
  bike: S('<circle cx="14" cy="46" r="10" fill="none" stroke="#222" stroke-width="5"/><circle cx="50" cy="46" r="10" fill="none" stroke="#222" stroke-width="5"/><path d="M14 46l12-13h14l10 13" fill="none" stroke="#c1121f" stroke-width="5" stroke-linejoin="round"/><path d="M40 33l4-11h8" stroke="#555" stroke-width="4" fill="none" stroke-linecap="round"/><rect x="23" y="27" width="17" height="6" rx="3" fill="#333"/><circle cx="31" cy="10" r="6" fill="#b3ada2"/><path d="M30 17l-4 10" stroke="#9ec3e6" stroke-width="7" stroke-linecap="round"/>'),
  bus: S('<rect x="8" y="5" width="48" height="47" rx="7" fill="#d63a2f"/><rect x="13" y="11" width="38" height="19" rx="2" fill="#bfe6f7"/><rect x="8" y="34" width="48" height="4" fill="#ffd23f"/><circle cx="16" cy="44" r="3.5" fill="#fff3b0"/><circle cx="48" cy="44" r="3.5" fill="#fff3b0"/><rect x="12" y="52" width="9" height="8" rx="2" fill="#222"/><rect x="43" y="52" width="9" height="8" rx="2" fill="#222"/>'),
  horn: S('<path d="M5 25v14l10-2 32 13V14L15 27z" fill="#e9b949" stroke="#8a6a1a" stroke-width="2.5" stroke-linejoin="round"/><path d="M53 22a12 12 0 0 1 0 20M58 16a20 20 0 0 1 0 32" fill="none" stroke="#e9b949" stroke-width="4" stroke-linecap="round"/>'),
  road: S('<path d="M23 3h18l21 58H2z" fill="#4b4a4f"/><path d="M8 61L25 3M56 61L39 3" stroke="#eee" stroke-width="2.5"/><path d="M32 8v9M32 25v11M32 44v15" stroke="#ffd23f" stroke-width="3.5"/>'),
  siren: S('<path d="M15 47a17 17 0 0 1 34 0z" fill="#e63946"/><rect x="9" y="47" width="46" height="9" rx="2" fill="#555"/><path d="M32 6v9M10 15l7 7M54 15l-7 7" stroke="#e63946" stroke-width="4.5" stroke-linecap="round"/><rect x="28" y="31" width="8" height="12" rx="3" fill="#ffd0d0"/>'),
  box: S('<path d="M32 5l27 12v30L32 59 5 47V17z" fill="#c69c6d"/><path d="M5 17l27 12 27-12M32 29v30" fill="none" stroke="#8a6238" stroke-width="3"/><path d="M18 11l27 12" stroke="#e8d3b0" stroke-width="4"/>'),
  replay: S('<path d="M50 34a18 18 0 1 1-5-14" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round"/><path d="M48 7v14H34" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  home: S('<path d="M7 31L32 9l25 22" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 29v27h13V41h8v15h13V29L32 14z" fill="currentColor"/>'),
  pause: S('<rect x="15" y="11" width="11" height="42" rx="3" fill="currentColor"/><rect x="38" y="11" width="11" height="42" rx="3" fill="currentColor"/>'),
  check: S('<path d="M9 34l15 15 31-32" fill="none" stroke="currentColor" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>'),
  ok: S('<circle cx="32" cy="32" r="28" fill="#2d9d4f"/><path d="M18 33l10 10 18-20" fill="none" stroke="#fff" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>'),
  pin: S('<path d="M32 61s19-21 19-35a19 19 0 0 0-38 0c0 14 19 35 19 35z" fill="#e63946"/><circle cx="32" cy="26" r="7.5" fill="#fff"/>'),
  phone: S('<rect x="17" y="3" width="30" height="58" rx="6" fill="#2b2d42"/><rect x="21" y="10" width="22" height="40" rx="1" fill="#9fd3f5"/><circle cx="32" cy="55" r="2.6" fill="#999"/>'),
  school: S('<rect x="8" y="27" width="48" height="32" fill="#f2d16b"/><path d="M3 29L32 13l29 16z" fill="#b5482d"/><rect x="27" y="41" width="10" height="18" fill="#6b4a2a"/><rect x="13" y="35" width="9" height="8" fill="#3a5a7a"/><rect x="42" y="35" width="9" height="8" fill="#3a5a7a"/><path d="M32 13V2" stroke="#666" stroke-width="2"/><rect x="32" y="2" width="12" height="7" fill="#006a4e"/><circle cx="37" cy="5.5" r="2.3" fill="#f42a41"/>'),
  share: S('<path d="M32 6v32M20 18L32 6l12 12" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 30v26h40V30" fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>'),
  money: S('<path d="M24 6h16l-4 9h-8z" fill="#c69c3d"/><path d="M27 15h10c13 6 19 17 19 28 0 10-9 15-24 15S8 53 8 43c0-11 6-22 19-28z" fill="#e9b949"/><circle cx="32" cy="40" r="9" fill="none" stroke="#8a6a1a" stroke-width="3.5"/><path d="M26 15h12" stroke="#8a6a1a" stroke-width="3"/>'),
  scale: S('<path d="M32 8v46M18 58h28M8 18h48" stroke="#c9a65a" stroke-width="4" stroke-linecap="round"/><path d="M8 18L2 36h12zM56 18l-6 18h12z" fill="none" stroke="#c9a65a" stroke-width="3" stroke-linejoin="round"/><path d="M2 36a6 4 0 0 0 12 0zM50 36a6 4 0 0 0 12 0z" fill="#e9c46a"/><circle cx="32" cy="8" r="4" fill="#c9a65a"/>'),
  camera: S('<rect x="5" y="18" width="38" height="28" rx="5" fill="currentColor"/><path d="M43 28l16-9v26l-16-9z" fill="currentColor"/>'),
  govt: S('<path d="M32 5L4 20h56z" fill="#d9c7a3"/><rect x="7" y="21" width="50" height="5" fill="#c9b8a2"/><g fill="#efe9dc"><rect x="11" y="27" width="7" height="22"/><rect x="23" y="27" width="7" height="22"/><rect x="35" y="27" width="7" height="22"/><rect x="47" y="27" width="7" height="22"/></g><rect x="5" y="50" width="54" height="8" fill="#c9b8a2"/>'),
  keyboard: S('<rect x="3" y="16" width="58" height="34" rx="5" fill="none" stroke="currentColor" stroke-width="4"/><g fill="currentColor"><rect x="10" y="23" width="6" height="6"/><rect x="20" y="23" width="6" height="6"/><rect x="30" y="23" width="6" height="6"/><rect x="40" y="23" width="6" height="6"/><rect x="50" y="23" width="5" height="6"/><rect x="18" y="38" width="28" height="5"/></g>'),
  sad: S('<circle cx="32" cy="32" r="28" fill="#ffd23f"/><circle cx="22" cy="26" r="4" fill="#3a2a1a"/><circle cx="42" cy="26" r="4" fill="#3a2a1a"/><path d="M20 47c6-8 18-8 24 0" fill="none" stroke="#3a2a1a" stroke-width="4" stroke-linecap="round"/><path d="M44 32c3 5 3 9 0 10-3-1-3-5 0-10z" fill="#4f9fd6"/>'),
  party: S('<path d="M6 60l12-36 22 22z" fill="#f2a03d"/><path d="M10 48l18 6M14 36l12 14" stroke="#e63946" stroke-width="3"/><g fill="#2a9d8f"><circle cx="44" cy="10" r="3"/><circle cx="56" cy="24" r="3"/></g><g fill="#e63946"><rect x="30" y="6" width="5" height="5" transform="rotate(30 32 8)"/><rect x="52" y="40" width="5" height="5"/></g><path d="M36 22c6-6 4-12 10-14M44 32c6-2 10 2 16-2" stroke="#7b2cbf" stroke-width="3" fill="none" stroke-linecap="round"/>'),
  stop: S('<path d="M22 4h20l18 18v20L42 60H22L4 42V22z" fill="#c1121f" stroke="#fff" stroke-width="3"/><rect x="14" y="28" width="36" height="8" rx="2" fill="#fff"/>'),
  plane: S('<path d="M60 30c0-3-4-4-8-4H40L26 6h-7l7 20H14l-5-7H4l3 13-3 13h5l5-7h12l-7 20h7l14-20h12c4 0 8-1 8-4z" fill="currentColor"/>'),
  sun: S('<circle cx="32" cy="32" r="13" fill="#ffc83d"/><g stroke="#ffc83d" stroke-width="4.5" stroke-linecap="round"><path d="M32 4v8M32 52v8M4 32h8M52 32h8M12 12l6 6M46 46l6 6M52 12l-6 6M12 52l6-6"/></g>'),
  sunset: S('<path d="M14 44a18 18 0 0 1 36 0z" fill="#ff9a40"/><g stroke="#ff9a40" stroke-width="4" stroke-linecap="round"><path d="M32 12v8M10 22l6 6M54 22l-6 6M4 40h6M54 40h6"/></g><path d="M4 50h56M12 57h40" stroke="#c8553d" stroke-width="4" stroke-linecap="round"/>'),
  moon: S('<path d="M40 6a26 26 0 1 0 18 40A22 22 0 0 1 40 6z" fill="#f4e7a1"/><circle cx="26" cy="30" r="3" fill="#e2d38a"/><circle cx="34" cy="44" r="2" fill="#e2d38a"/>'),
  cloud: S(`<path d="${CLOUD}" fill="#dfe5ea" stroke="#9aa5ae" stroke-width="2.5"/>`),
  rain: S(`<path d="${CLOUD}" fill="#b9c3cc" stroke="#7d8992" stroke-width="2.5" transform="translate(0 -6)"/><path d="M20 46l-4 11M32 46l-4 11M44 46l-4 11" stroke="#4f9fd6" stroke-width="4" stroke-linecap="round"/>`),
  storm: S(`<path d="${CLOUD}" fill="#6d757d" stroke="#3e454c" stroke-width="2.5" transform="translate(0 -8)"/><path d="M35 34L22 50h9l-6 13 17-19h-9l7-10z" fill="#ffd23f"/>`),
  turtle: S('<ellipse cx="30" cy="38" rx="20" ry="13" fill="#4f8f3a"/><path d="M14 38h32M22 28l-4 20M38 28l4 20" stroke="#356b26" stroke-width="2.5"/><circle cx="54" cy="36" r="6" fill="#9ccc65"/><g fill="#9ccc65"><ellipse cx="16" cy="51" rx="5" ry="3.5"/><ellipse cx="42" cy="51" rx="5" ry="3.5"/></g><circle cx="56" cy="34" r="1.5" fill="#222"/>'),
  hourglass: S('<path d="M14 4h36M14 60h36" stroke="#6b4a2a" stroke-width="5" stroke-linecap="round"/><path d="M18 6c0 16 12 18 12 26S18 42 18 58h28c0-16-12-18-12-26s12-10 12-26z" fill="#e8f4fb" stroke="#6b4a2a" stroke-width="3"/><path d="M24 14h16l-8 14zM20 56c4-8 8-12 12-12s8 4 12 12z" fill="#e9b949"/>'),
  left: S('<path d="M44 8L16 32l28 24z" fill="currentColor"/>'),
  right: S('<path d="M20 8l28 24-28 24z" fill="currentColor"/>'),
  play: S('<path d="M18 8l36 24-36 24z" fill="currentColor"/>'),
  trophy: S('<path d="M16 8h32v14a16 16 0 0 1-32 0z" fill="#f4c430"/><path d="M16 13H6c0 10 5 16 12 17M48 13h10c0 10-5 16-12 17" fill="none" stroke="#f4c430" stroke-width="4"/><rect x="28" y="37" width="8" height="11" fill="#d9a520"/><rect x="18" y="48" width="28" height="9" rx="2" fill="#8a6238"/>'),
  user: S('<circle cx="32" cy="20" r="12" fill="currentColor"/><path d="M8 60c0-14 11-24 24-24s24 10 24 24z" fill="currentColor"/>'),

  // ---- vegetables
  tomato: S('<circle cx="32" cy="37" r="24" fill="#e03b2a"/><path d="M32 15l-7-7M32 15l7-7M32 15l-11 2M32 15l11 2" stroke="#2e9e3a" stroke-width="4" stroke-linecap="round"/><ellipse cx="23" cy="29" rx="6" ry="3.5" fill="#ff8a7a" opacity=".75"/>'),
  potato: S('<ellipse cx="32" cy="34" rx="27" ry="19" fill="#c9a46a" transform="rotate(-15 32 34)"/><g fill="#a07d48"><circle cx="20" cy="34" r="2"/><circle cx="34" cy="26" r="2"/><circle cx="42" cy="40" r="2"/><circle cx="28" cy="44" r="1.6"/></g>'),
  onion: S('<path d="M32 5c4 9 22 16 22 33a22 22 0 0 1-44 0C10 21 28 14 32 5z" fill="#b5506b"/><path d="M32 10v50M24 20c-6 12-6 30 4 38M40 20c6 12 6 30-4 38" stroke="#e8a0b4" stroke-width="2.5" fill="none"/>'),
  brinjal: S('<path d="M45 15c11 9 8 31-6 41S7 59 9 46s21-14 23-27 7-12 13-4z" fill="#5b2a6e"/><path d="M38 12l9 5 7-7-3 11-8 2z" fill="#2e9e3a"/><path d="M47 10l5-6" stroke="#2e9e3a" stroke-width="3" stroke-linecap="round"/>'),
  cauliflower: S('<path d="M6 40c8-5 15 6 26 6s18-11 26-6c-4 15-15 21-26 21S10 55 6 40z" fill="#4f8f3a"/><g fill="#f1ead0" stroke="#d8cfa8" stroke-width="1.5"><circle cx="21" cy="31" r="10"/><circle cx="34" cy="24" r="11"/><circle cx="45" cy="33" r="10"/><circle cx="32" cy="37" r="10"/></g>'),
  cabbage: S('<circle cx="32" cy="34" r="25" fill="#7cb342"/><path d="M32 11c-8 10-8 35 0 47M18 21c8 6 12 19 14 37M46 21c-8 6-12 19-14 37" fill="none" stroke="#d4e9b8" stroke-width="3"/>'),
  chili: S('<path d="M13 15c4 4 11 2 15 8 8 12 6 30 25 36-21 4-37-8-37-28 0-6-3-10-3-16z" fill="#d62828"/><path d="M13 15c-2-4 0-9 5-11" stroke="#2e9e3a" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M20 26c4 10 8 18 18 24" stroke="#ff7a6a" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
  gourd: S('<path d="M28 7h8v8c0 6 15 12 15 30a19 19 0 0 1-38 0c0-18 15-24 15-30z" fill="#9ccc65"/><rect x="29" y="2" width="6" height="8" rx="1" fill="#6b8e23"/><path d="M24 34c-2 8 0 16 6 20" stroke="#c5e1a5" stroke-width="3" fill="none" stroke-linecap="round"/>'),
  mango: S('<path d="M36 9c14 4 22 18 18 32S36 62 24 58 6 40 12 26 26 7 36 9z" fill="#f4a300"/><ellipse cx="45" cy="9" rx="9" ry="4" fill="#2e9e3a" transform="rotate(-15 45 9)"/><path d="M34 10c1-4 4-6 7-6" stroke="#6b4a2a" stroke-width="3" fill="none"/>'),

  // ---- billboard illustrations
  tea: S('<path d="M10 24h36v14a18 18 0 0 1-36 0z" fill="#fff" stroke="#8a5a3a" stroke-width="3"/><path d="M46 28h4a7 7 0 0 1 0 14h-5" fill="none" stroke="#8a5a3a" stroke-width="3.5"/><ellipse cx="28" cy="25" rx="16" ry="3" fill="#a0612a"/><path d="M4 56h48" stroke="#8a5a3a" stroke-width="4" stroke-linecap="round"/><path d="M20 18c-3-4 3-6 0-12M30 18c-3-4 3-6 0-12M40 18c-3-4 3-6 0-12" stroke="#bbb" stroke-width="2.5" fill="none" stroke-linecap="round"/>'),
  fuchka: S('<path d="M6 40h52a26 22 0 0 1-52 0z" fill="#c8c8c8" stroke="#8a8a8a" stroke-width="2"/><g fill="#e9b949" stroke="#b5832a" stroke-width="2"><circle cx="20" cy="34" r="10"/><circle cx="44" cy="34" r="10"/><circle cx="32" cy="28" r="11"/></g><circle cx="32" cy="24" r="4" fill="#6b4a2a"/>'),
  fish: S('<path d="M4 32c10-14 30-18 44-8l12-10v36L48 40C34 50 14 46 4 32z" fill="#c7d3dc" stroke="#7d8a96" stroke-width="2.5" stroke-linejoin="round"/><circle cx="16" cy="29" r="3" fill="#222"/><path d="M24 24c4 4 4 12 0 16" stroke="#9aa8b4" stroke-width="2.5" fill="none"/>'),
  building: S('<rect x="12" y="6" width="28" height="54" fill="#d9c7a8"/><rect x="40" y="22" width="14" height="38" fill="#bfb5a6"/><g fill="#4d6170"><rect x="17" y="12" width="7" height="6"/><rect x="28" y="12" width="7" height="6"/><rect x="17" y="24" width="7" height="6"/><rect x="28" y="24" width="7" height="6"/><rect x="17" y="36" width="7" height="6"/><rect x="28" y="36" width="7" height="6"/><rect x="44" y="28" width="6" height="5"/><rect x="44" y="40" width="6" height="5"/></g><rect x="22" y="48" width="8" height="12" fill="#6b4a2a"/>'),
  bald: S('<ellipse cx="32" cy="34" rx="20" ry="23" fill="#c68e5f"/><ellipse cx="25" cy="18" rx="7" ry="4" fill="#e8b88a"/><path d="M12 36c-4 0-4 8 0 8M52 36c4 0 4 8 0 8" stroke="#c68e5f" stroke-width="4"/><circle cx="25" cy="34" r="2.5" fill="#222"/><circle cx="39" cy="34" r="2.5" fill="#222"/><path d="M22 44c6-4 14-4 20 0" stroke="#3a2a1a" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  umbrella: S('<path d="M4 32a28 26 0 0 1 56 0c-4-4-10-4-14 0-4-4-10-4-14 0-4-4-10-4-14 0-4-4-10-4-14 0z" fill="#7b2cbf"/><path d="M32 6v2M32 32v20a6 6 0 0 1-12 0" stroke="#3a2a1a" stroke-width="4" fill="none" stroke-linecap="round"/>'),
  sweets: S('<path d="M4 34h56l-6 20H10z" fill="#c69c6d" stroke="#8a6238" stroke-width="2.5"/><g fill="#fff8ea" stroke="#e5d6b8" stroke-width="2"><circle cx="20" cy="28" r="10"/><circle cx="40" cy="28" r="10"/><circle cx="30" cy="20" r="10"/></g>'),
  books: S('<rect x="8" y="44" width="48" height="12" rx="2" fill="#e63946"/><rect x="12" y="32" width="42" height="12" rx="2" fill="#2a9d8f"/><rect x="6" y="20" width="44" height="12" rx="2" fill="#f2a03d"/><path d="M14 50h34M18 38h30M12 26h32" stroke="#fff" stroke-width="2" opacity=".7"/><path d="M40 6l14 4-4 12-14-4z" fill="#ffd23f"/>'),
  detective: S('<path d="M10 26c0-10 10-18 22-18s22 8 22 18z" fill="#6b4a2a"/><rect x="4" y="24" width="56" height="6" rx="3" fill="#4a3220"/><circle cx="26" cy="44" r="12" fill="#e8f4fb" stroke="#333" stroke-width="4"/><path d="M35 53l12 10" stroke="#333" stroke-width="6" stroke-linecap="round"/>'),
  cement: S('<path d="M10 14h44l4 40H6z" fill="#adb5bd" stroke="#6c757d" stroke-width="3" stroke-linejoin="round"/><rect x="16" y="24" width="32" height="18" rx="3" fill="#f77f00"/><path d="M22 33h20" stroke="#fff" stroke-width="4" stroke-linecap="round"/>'),
  cow: S('<path d="M8 14c4 2 8 6 10 10M56 14c-4 2-8 6-10 10" stroke="#c9b8a2" stroke-width="5" stroke-linecap="round" fill="none"/><path d="M16 22h32l4 20c0 12-9 18-20 18S12 54 12 42z" fill="#fff" stroke="#555" stroke-width="2.5"/><path d="M18 24c6 2 8 10 4 14-4-2-6-8-4-14zM44 30c4 0 6 6 2 10-3-3-4-7-2-10z" fill="#333"/><ellipse cx="32" cy="48" rx="12" ry="8" fill="#f4b6c2"/><circle cx="27" cy="48" r="2" fill="#333"/><circle cx="37" cy="48" r="2" fill="#333"/>'),
  trafficlight: S('<rect x="20" y="4" width="24" height="48" rx="6" fill="#2b2d42"/><circle cx="32" cy="15" r="6" fill="#e63946"/><circle cx="32" cy="28" r="6" fill="#ffd23f"/><circle cx="32" cy="41" r="6" fill="#2d9d4f"/><rect x="29" y="52" width="6" height="10" fill="#555"/>'),
};

const TOKEN = /\{([a-z]+)\}/g;

/** SVG markup for an icon (inline in HTML). */
export function iconSvg(name: string, cls = 'ic'): string {
  const svg = ICONS[name];
  return svg ? svg.replace('<svg ', `<svg class="${cls}" aria-hidden="true" `) : '';
}

/** Replace {icon} tokens in an HTML string with inline SVG icons. */
export function rich(html: string): string {
  return html.replace(TOKEN, (m, name: string) => (ICONS[name] ? iconSvg(name) : m));
}

// ---- canvas support: icons pre-rendered to images so canvas textures can draw them synchronously

const images = new Map<string, HTMLImageElement>();

export function iconImage(name: string): HTMLImageElement | undefined {
  return images.get(name);
}

/** Load every icon as an <img>; call once at boot before any canvas texture is drawn. */
export async function preloadIconImages(): Promise<void> {
  await Promise.all(
    Object.entries(ICONS).map(
      ([name, svg]) =>
        new Promise<void>((res) => {
          const img = new Image(128, 128);
          // currentColor icons are drawn white on canvas
          const src = svg.replace('<svg ', '<svg width="128" height="128" style="color:#ffffff" ');
          img.onload = () => {
            images.set(name, img);
            res();
          };
          img.onerror = () => res();
          img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(src)}`;
        }),
    ),
  );
}

export const ICON_TOKEN = TOKEN;
