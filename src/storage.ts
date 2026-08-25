/**
 * One key, three possible backends: the Claude artifact storage API when the
 * app runs inside a chat, localStorage when it is served from GitHub Pages,
 * and an in-memory object when neither is available (private mode, file://).
 */
const KEY = 'obsidian-invoice-defaults';

declare global {
  interface Window {
    storage?: {
      get(key: string, shared?: boolean): Promise<{ value: string } | null>;
      set(key: string, value: string, shared?: boolean): Promise<unknown>;
      delete(key: string, shared?: boolean): Promise<unknown>;
    };
  }
}

let mem: string | null = null;

export async function load<T>(): Promise<T | null> {
  try {
    if (window.storage) {
      const r = await window.storage.get(KEY, false);
      return r ? (JSON.parse(r.value) as T) : null;
    }
  } catch {
    /* key missing or storage unavailable */
  }
  try {
    const raw = localStorage.getItem(KEY) ?? mem;
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return mem ? (JSON.parse(mem) as T) : null;
  }
}

export async function save(value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  mem = raw;
  try {
    if (window.storage) {
      await window.storage.set(KEY, raw, false);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    localStorage.setItem(KEY, raw);
  } catch {
    /* memory only */
  }
}

export async function clear(): Promise<void> {
  mem = null;
  try {
    if (window.storage) await window.storage.delete(KEY, false);
  } catch {
    /* ignore */
  }
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
