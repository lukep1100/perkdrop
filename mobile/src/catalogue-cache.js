import * as FileSystem from 'expo-file-system/legacy';
import { decodeCatalogueCache } from './release-rules.mjs';
const path = FileSystem.cacheDirectory && FileSystem.cacheDirectory + 'perkdrop-public-catalogue-v1.json';
export async function readCatalogueCache() {
  if (!path) return null;
  try { return decodeCatalogueCache(await FileSystem.readAsStringAsync(path)); } catch { return null; }
}
export async function writeCatalogueCache(items) {
  if (!path) return;
  // ONLY the public catalogue: never saves, tokens, plans or passes.
  const data = JSON.stringify({ version: 1, savedAt: Date.now(), items });
  if (data.length > 3_000_000 || items.length > 1000) return;
  try {
    await FileSystem.writeAsStringAsync(path + '.tmp', data);
    await FileSystem.deleteAsync(path, { idempotent: true });
    await FileSystem.moveAsync({ from: path + '.tmp', to: path });
  } catch { /* Cache failure must not prevent live browsing. */ }
}
export async function clearCatalogueCache() {
  if (path) await FileSystem.deleteAsync(path, { idempotent: true });
}
