// Title menu, pause overlay and portrait rotate hint.

import { ECONOMY } from '../config/economy';
import { DEFAULT_START_ID, START_POINTS } from '../config/route';
import type { Sound } from '../audio/Sound';
import { formatBn, formatKg, formatTaka } from '../utils/bnNumber';
import { isTouchDevice } from '../utils/device';
import { button, el, esc } from './dom';

export class Menu {
  private root: HTMLElement;
  private startId = DEFAULT_START_ID;

  constructor(parent: HTMLElement, sound: Sound, onStart: (startId: string) => void) {
    this.root = el('div', 'menu', '', parent);
    const card = el('div', 'menu-card', '', this.root);
    el('div', 'menu-title', '🚚 সবজির ট্রাক', card);
    el('div', 'menu-tag', 'ক্ষেতে সস্তা, বাজারে আগুন — মাঝের রাস্তাটা একবার নিজে চালিয়ে দেখুন।', card);

    el('h3', '', 'কীভাবে খেলবেন', card);
    el('ul', 'howto', `
      <li>🌾 গ্রামের ক্ষেতের পাশের সবুজ জায়গায় থেমে সবজি কিনুন। নগদ ${formatTaka(ECONOMY.startingCash)}, ট্রাকে জায়গা ${formatKg(ECONOMY.truckCapacityKg)}।</li>
      <li>🚚 রওনা দিন ঢাকার কাওরান বাজারের দিকে।</li>
      <li>✋ চাঁদার ব্যারিকেড: থেমে চাঁদা দিন — অথবা ${formatBn(ECONOMY.ramSpeedKmh)}+ কিমি/ঘণ্টায় ভেঙে বেরিয়ে যান। আস্তে ধাক্কা দিলে জরিমানা!</li>
      <li>🏍️ ভাঙলে ধাওয়া শুরু: টানা ${formatBn(ECONOMY.chaseRequiredSeconds)} সেকেন্ড ${formatBn(ECONOMY.ramSpeedKmh)}+ গতিতে থাকলে পালাতে পারবেন। গতি কমালে মিটার শূন্য!</li>
      <li>🌉 বৈধ টোল ও সড়ক কর ফাঁকি দেওয়া যাবে না — ${formatBn(ECONOMY.tollMaxSpeedKmh)} কিমি/ঘণ্টার বেশি গতিতে স্টপ লাইন পার হলে ট্রাক জব্দ।</li>
      <li>🚌 বাস-ট্রাকের সাথে মুখোমুখি ধাক্কা = খেলা শেষ। ছোট ধাক্কায় মাল নষ্ট।</li>
      <li>🚆 রেলক্রসিংয়ে গেট বন্ধ থাকলে থামুন — ট্রেন চলে গেলে গেট খুলবে। আঁকাবাঁকা রাস্তায় নিজেই স্টিয়ারিং ধরুন!</li>
      <li>📯 হর্ন দিলে সামনের গাড়ি সাইড দেয়। 🌧️ আবহাওয়া আর দিন-রাত ধীরে ধীরে বদলায় — বৃষ্টিতে ব্রেক কম ধরে।</li>
      <li>📋 শেষে হিসাব দেখুন: ক্ষেতের দাম কীভাবে কাওরান বাজারের দাম হলো।</li>`, card);

    el('h3', '', 'কোথা থেকে রওনা দেবেন?', card);
    const routes = el('div', 'routes', '', card);
    const chips: HTMLButtonElement[] = [];
    for (const p of START_POINTS) {
      const chip = button(
        `<b>📍 ${esc(p.nameBn)} → ঢাকা</b><small>${esc(p.pathBn)}</small><small>✋ পথে ${formatBn(p.randomBarriers)}টি চাঁদার ব্যারিকেড (জায়গা প্রতিবার বদলায়)</small>`,
        'route-chip',
        () => {
          this.startId = p.id;
          chips.forEach((c) => c.classList.toggle('on', c === chip));
        },
        routes,
      );
      chip.classList.toggle('on', p.id === this.startId);
      chips.push(chip);
    }

    const actions = el('div', 'menu-actions', '', card);
    button('খেলা শুরু ▶', 'btn btn-go big', () => onStart(this.startId), actions);
    const mute = button(sound.muted ? '🔇 শব্দ বন্ধ' : '🔊 শব্দ চালু', 'btn btn-ghost', () => sound.toggleMute(), actions);
    sound.onMuteChange((m) => (mute.textContent = m ? '🔇 শব্দ বন্ধ' : '🔊 শব্দ চালু'));

    el('div', 'controls-legend', isTouchDevice
      ? 'বাঁ দিকে ◀ ▶ স্টিয়ারিং, ডান দিকে গ্যাস/ব্রেক। ফোন খাড়া (পোর্ট্রেট) করে ধরুন।'
      : '⌨️ W/↑ গ্যাস · S/↓ ব্রেক/রিভার্স · A/D বা ←/→ স্টিয়ারিং · Space হ্যান্ডব্রেক · H হর্ন · C ক্যামেরা · M শব্দ · P/Esc বিরতি · Enter টাকা দিন · F3 ডিবাগ', card);
    el('div', 'disclaimer', 'এটি একটি ব্যঙ্গাত্মক খেলা। সব চরিত্র ও প্রতিষ্ঠান কাল্পনিক; কোনো দল বা ব্যক্তিকে নির্দেশ করে না। দাম ও অঙ্কগুলো উদাহরণমাত্র।', card);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }
}

export class PauseMenu {
  private root: HTMLElement;

  constructor(parent: HTMLElement, handlers: { onResume: () => void; onRestart: () => void; onHome: () => void }) {
    this.root = el('div', 'modal-overlay pause hidden', '', parent);
    const card = el('div', 'modal pause-card', '<div class="pd-title">⏸ বিরতি</div><p>চা খেয়ে আসুন। চাঁদাবাজরা অপেক্ষা করবে।</p>', this.root);
    const b = el('div', 'bp-buttons', '', card);
    button('চালিয়ে যান ▶', 'btn btn-go', handlers.onResume, b);
    button('আবার শুরু 🔁', 'btn btn-buy', handlers.onRestart, b);
    button('হোম 🏠', 'btn btn-ghost', handlers.onHome, b);
  }

  show(on: boolean): void {
    this.root.classList.toggle('hidden', !on);
  }
}

export function rotateHint(parent: HTMLElement): void {
  const r = el('div', 'rotate-hint', '<div class="rot-icon">📱</div><div>ফোনটি খাড়া (পোর্ট্রেট) করে ধরুন — খেলাটি সেভাবেই বানানো</div>', parent);
  button('তবুও খেলুন', 'btn btn-ghost', () => r.classList.add('dismissed'), r);
}
