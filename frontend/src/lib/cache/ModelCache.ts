import { get, set } from "idb-keyval";

const KEY_PREFIX = "kosh_asset_v1_";

export function hashCacheKey(toolName: string, args: unknown): string {
  const input = `${toolName}|${JSON.stringify(args ?? {})}`;
  let hashA = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hashA ^= input.charCodeAt(i);
    hashA = Math.imul(hashA, 0x01000193);
  }
  let hashB = 0x1b873593;
  for (let i = input.length - 1; i >= 0; i--) {
    hashB ^= input.charCodeAt(i);
    hashB = Math.imul(hashB, 0x85ebca6b);
  }
  return `${KEY_PREFIX}${(hashA >>> 0).toString(36)}${(hashB >>> 0).toString(36)}`;
}

export async function getCachedAsset(key: string): Promise<ArrayBuffer | null> {
  try {
    const value = await get<ArrayBuffer>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

export async function putCachedAsset(key: string, data: ArrayBuffer): Promise<void> {
  try {
    await set(key, data);
  } catch {
    // IndexedDB quota exceeded: caching is best-effort only.
  }
}
