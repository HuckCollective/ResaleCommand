export interface SyncHistoryEntry {
  id: string;
  timestamp: string; // ISO date
  tenantId: string;
  locationId: string;
  locationName: string;
  fileName: string;
  totalRows: number;
  matchedCount: number;
  newItemsCreated: number;
  inStockCount: number;
  soldCount: number;
  totalGross: number;
  totalNet: number;
  commissionPaid: number;
  upcPrefix: string;
}

const STORAGE_PREFIX = 'rc_sync_history_';

function getStorageKey(tenantId: string): string {
  return `${STORAGE_PREFIX}${tenantId || 'default'}`;
}

export function getSyncHistory(tenantId: string, locationId?: string): SyncHistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getStorageKey(tenantId));
    if (!raw) return [];
    const all: SyncHistoryEntry[] = JSON.parse(raw);
    if (!Array.isArray(all)) return [];
    
    if (locationId) {
      return all.filter(e => e.locationId === locationId || e.locationName.toLowerCase() === locationId.toLowerCase());
    }
    return all;
  } catch (err) {
    console.warn('Failed to read sync history from storage:', err);
    return [];
  }
}

export function recordSyncHistory(entry: Omit<SyncHistoryEntry, 'id' | 'timestamp'> & { id?: string; timestamp?: string }): SyncHistoryEntry {
  const fullEntry: SyncHistoryEntry = {
    ...entry,
    id: entry.id || `sync_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timestamp: entry.timestamp || new Date().toISOString()
  };

  if (typeof window === 'undefined') return fullEntry;

  try {
    const key = getStorageKey(entry.tenantId);
    const existing = getSyncHistory(entry.tenantId);
    const updated = [fullEntry, ...existing.filter(e => e.id !== fullEntry.id)].slice(0, 100); // Keep last 100 syncs
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to save sync history to storage:', err);
  }

  return fullEntry;
}

export function deleteSyncHistoryEntry(tenantId: string, id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(tenantId);
    const existing = getSyncHistory(tenantId);
    const updated = existing.filter(e => e.id !== id);
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to delete sync history entry:', err);
  }
}

export function clearLocationSyncHistory(tenantId: string, locationId: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = getStorageKey(tenantId);
    const existing = getSyncHistory(tenantId);
    const updated = existing.filter(e => e.locationId !== locationId && e.locationName.toLowerCase() !== locationId.toLowerCase());
    localStorage.setItem(key, JSON.stringify(updated));
  } catch (err) {
    console.warn('Failed to clear location sync history:', err);
  }
}
