// Name prompt and the global leaderboard table (menu + result report).

import { fetchBoard, player, setPlayerName, type Board, type BoardRow } from '../net/leaderboard';
import { START_POINTS } from '../config/route';
import { formatBn } from '../utils/bnNumber';
import { button, el, esc } from './dom';

/** Modal that asks for the player's name; open() resolves once a name is saved (or the dialog is cancelled). */
export class NameDialog {
  private root: HTMLElement;
  private input: HTMLInputElement;
  private error: HTMLElement;
  private done: ((name: string | null) => void) | null = null;

  constructor(parent: HTMLElement) {
    this.root = el('div', 'modal-overlay name-dialog hidden', '', parent);
    const card = el('div', 'modal', '', this.root);
    el('div', 'pd-title', '{user} আপনার নাম কী?', card);
    el('p', 'nd-hint', 'লিডারবোর্ডে এই নামেই আপনার পয়েন্ট দেখাবে।', card);
    const form = el('form', 'nd-form', '', card);
    this.input = el('input', 'nd-input', '', form);
    this.input.type = 'text';
    this.input.maxLength = 24;
    this.input.setAttribute('autocomplete', 'nickname');
    this.input.placeholder = 'যেমন: রহিম ড্রাইভার';
    // Keep typed letters away from the game's keyboard shortcuts (H horn, M mute, P pause…)
    this.input.addEventListener('keydown', (e) => e.stopPropagation());
    this.error = el('div', 'warn-text nd-error', '', card);
    const b = el('div', 'bp-buttons', '', form);
    button('বাতিল', 'btn btn-ghost', () => this.finish(null), b);
    const ok = el('button', 'btn btn-go', 'ঠিক আছে {right}', b);
    ok.type = 'submit';
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = setPlayerName(this.input.value);
      if (!name) {
        this.error.textContent = 'একটা নাম লিখুন';
        return;
      }
      this.finish(name);
    });
  }

  open(): Promise<string | null> {
    this.done?.(null);
    this.input.value = player.name;
    this.error.textContent = '';
    this.root.classList.remove('hidden');
    setTimeout(() => this.input.focus(), 50);
    return new Promise((res) => (this.done = res));
  }

  private finish(name: string | null): void {
    this.root.classList.add('hidden');
    this.input.blur();
    const done = this.done;
    this.done = null;
    done?.(name);
  }
}

/** Rows shown before "আরও দেখুন" reveals the rest of the board. */
const FIRST_ROWS = 10;

/**
 * Renders the leaderboard into `box`: the first 10 rows, then a button that shows the rest. The player's own
 * row is highlighted (and appended if it isn't among the rows shown).
 */
export function renderBoard(box: HTMLElement, board: Board, all = false): void {
  if (board.top.length === 0) {
    box.innerHTML = '<div class="lb-empty">এখনো কেউ পয়েন্ট পায়নি — প্রথম হোন!</div>';
    return;
  }
  const shown = all ? board.top : board.top.slice(0, FIRST_ROWS);
  const me = board.top.find((r) => r.mine) ?? board.me;
  const row = (r: BoardRow, mine: boolean) =>
    `<tr class="${mine ? 'me' : ''}"><td class="num">${r.rank ? formatBn(r.rank) : '—'}</td><td class="lb-name">${esc(r.name)}</td>
      <td class="lb-route">${esc(START_POINTS.find((p) => p.id === r.route)?.nameBn ?? '—')}</td><td class="num">${formatBn(r.total)}</td><td class="num">${formatBn(r.best)}</td><td class="num">${formatBn(r.deliveries)}/${formatBn(r.runs)}</td></tr>`;
  let rows = shown.map((r) => row(r, r.mine)).join('');
  if (me && me.runs > 0 && !shown.some((r) => r.mine)) {
    rows += `<tr class="lb-gap"><td colspan="6">…</td></tr>${row(me, true)}`;
  }
  const more = board.top.length - shown.length;
  box.innerHTML = `<div class="rp-table-wrap"><table class="rp-table lb-table">
    <thead><tr><th>#</th><th>নাম</th><th>রুট</th><th>মোট পয়েন্ট</th><th>সেরা যাত্রা</th><th>ডেলিভারি</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
  if (more > 0) {
    const b = el('div', 'lb-more', '', box);
    button(`আরও দেখুন (${formatBn(more)})`, 'btn btn-ghost small', () => renderBoard(box, board, true), b);
  }
}

/**
 * Fetch and render. If the leaderboard can't be loaded, `wrap` (the whole leaderboard block) is hidden
 * instead of showing an error; it comes back on the next successful load.
 */
export async function loadBoard(box: HTMLElement, wrap: HTMLElement = box): Promise<boolean> {
  if (!wrap.classList.contains('hidden')) box.innerHTML = '<div class="lb-empty">লোড হচ্ছে…</div>';
  const board = await fetchBoard();
  wrap.classList.toggle('hidden', !board);
  if (board) renderBoard(box, board);
  return !!board;
}
