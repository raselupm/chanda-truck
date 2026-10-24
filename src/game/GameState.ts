// Top-level game phase state machine.

export type Phase = 'MENU' | 'FARM' | 'HIGHWAY' | 'ARRIVAL' | 'RESULT' | 'GAME_OVER';

const ALLOWED: Record<Phase, readonly Phase[]> = {
  MENU: ['FARM'],
  FARM: ['HIGHWAY', 'MENU'],
  HIGHWAY: ['ARRIVAL', 'GAME_OVER', 'MENU'],
  ARRIVAL: ['RESULT'],
  RESULT: ['MENU', 'FARM'],
  GAME_OVER: ['MENU', 'FARM'],
};

type Listener = (next: Phase, prev: Phase) => void;

export class GameState {
  private current: Phase = 'MENU';
  private listeners: Listener[] = [];
  paused = false;

  get phase(): Phase {
    return this.current;
  }

  /** Change phase; throws on transitions the game flow doesn't allow (catches logic bugs early). */
  set(next: Phase): void {
    if (next === this.current) return;
    if (!ALLOWED[this.current].includes(next)) {
      throw new Error(`Invalid phase transition ${this.current} -> ${next}`);
    }
    const prev = this.current;
    this.current = next;
    for (const l of this.listeners) l(next, prev);
  }

  /** Jump to a phase regardless of the normal flow (restart, home). */
  force(next: Phase): void {
    const prev = this.current;
    this.current = next;
    if (prev !== next) for (const l of this.listeners) l(next, prev);
  }

  onChange(listener: Listener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }
}
