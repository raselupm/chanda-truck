// Google Analytics 4 events (gtag.js is loaded in index.html).
// In development nothing is sent unless the URL has ?ga, and then with debug_mode so it shows in DebugView.

import { isMobile } from '../utils/device';

type Params = Record<string, string | number | boolean>;
type Gtag = (cmd: 'event' | 'set', name: string | Params, params?: Params) => void;

const DEV_ON = new URLSearchParams(location.search).has('ga');
const enabled = !import.meta.env.DEV || DEV_ON;

function gtag(): Gtag | null {
  const g = (window as unknown as { gtag?: Gtag }).gtag;
  return enabled && typeof g === 'function' ? g : null;
}

export function track(name: string, params: Params = {}): void {
  gtag()?.('event', name, import.meta.env.DEV ? { ...params, debug_mode: true } : params);
}

/** Once per page load: what kind of device the player is on (a user property). */
export function initAnalytics(): void {
  gtag()?.('set', 'user_properties', { device_kind: isMobile ? 'mobile' : 'desktop' });
}
