// Web-platform replacements for the Chrome extension APIs used by the
// original side panel. The port reuses the same React components, so we
// give them drop-in helpers that mimic the chrome.* surface they expect.
//
// - `webStorage` ≈ chrome.storage.local (localStorage under the hood)
// - `webNotify`   ≈ chrome.notifications.create (Notification API + console fallback)
//
// Everything is SSR-safe: guarded by `typeof window !== 'undefined'` so
// that Next.js server rendering doesn't blow up.

export const webStorage = {
  async get<T = unknown>(key: string): Promise<T | undefined> {
    if (typeof window === "undefined") return undefined;
    try {
      const raw = window.localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : undefined;
    } catch {
      return undefined;
    }
  },
  async set(key: string, value: unknown): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Quota or serialisation error — best-effort.
    }
  },
  async remove(key: string): Promise<void> {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/**
 * Request browser notification permission if not yet granted. Returns the
 * granted/denied/default state. Call before `webNotify` to avoid a silent
 * no-op. Users will see a single prompt.
 */
export async function requestNotificationPermission(): Promise<
  "granted" | "denied" | "default" | "unsupported"
> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  if (Notification.permission !== "default") return Notification.permission;
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export interface WebNotifyOptions {
  title: string;
  body: string;
  /** Relative path under /public, e.g. "/niya-logo.png". */
  icon?: string;
  /** Collapse/deduplicate tag — matches `chrome.notifications.create`'s id. */
  tag?: string;
}

/**
 * Fire a browser notification. If permission is not granted, returns false —
 * the caller should fall back to an in-app toast.
 */
export function webNotify(opts: WebNotifyOptions): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    new Notification(opts.title, {
      body: opts.body,
      icon: opts.icon,
      tag: opts.tag,
    });
    return true;
  } catch {
    return false;
  }
}
