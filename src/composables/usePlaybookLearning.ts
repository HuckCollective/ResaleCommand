import { ref, computed } from 'vue';

export interface PlayHistoryRecord {
    itemId?: string;
    itemTitle?: string;
    category: string;
    isLot: boolean;
    playId: string;
    playName: string;
    channel?: string;
    targetPrice?: number;
    timestamp: number;
}

const STORAGE_KEY = 'rc_playbook_history';

// Shared reactive state
const playHistory = ref<PlayHistoryRecord[]>(loadHistory());

function loadHistory(): PlayHistoryRecord[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function saveHistory(records: PlayHistoryRecord[]) {
    if (typeof window === 'undefined') return;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-200)));
    } catch (e) {
        console.warn('[PlaybookLearning] Failed to persist play history:', e);
    }
}

/**
 * Detect item category from title, tags, or components for affinity mapping
 */
export function detectItemCategory(item: any): string {
    if (!item) return 'general';
    const text = `${item.title || ''} ${item.tags || ''} ${item.channel || ''} ${item.storageLocation || ''}`.toLowerCase();
    
    if (/\b(book|books|hardcover|paperback|novel|author|reading|guide|manual|rpg|d&d|tsr)\b/.test(text)) {
        return 'books';
    }
    if (/\b(garment|jacket|shirt|dress|coat|jeans|pants|sherwani|blazer|sweater|hat|fedora|cap|apparel|clothing|shoes|boots)\b/.test(text)) {
        return 'apparel';
    }
    if (/\b(figure|action figure|star wars|hasbro|kenner|funko|toy|doll|plush|lego|model kit)\b/.test(text)) {
        return 'toys_collectibles';
    }
    if (/\b(comic|comics|graphic novel|manga|marvel|dc|bronze age|silver age)\b/.test(text)) {
        return 'comics';
    }
    if (/\b(cassette|vinyl|record|cd|vhs|tape|dvd|laserdisc|music)\b/.test(text)) {
        return 'media';
    }
    if (/\b(vintage|antique|brass|oddity|skull|decor|plate|glass|porcelain|clock)\b/.test(text)) {
        return 'vintage_decor';
    }
    return 'general';
}

export function usePlaybookLearning() {
    const totalPlaysRecorded = computed(() => playHistory.value.length);

    function recordPlayExecution(play: { id: string; name: string }, item: any, extra?: { channel?: string; targetPrice?: number }) {
        if (!play || !item) return;

        const category = detectItemCategory(item);
        const isLot = !!(
            item.isLot || 
            item.status === 'combined' || 
            Number(item.quantity || 1) > 1 || 
            (Array.isArray(item.components) && item.components.length > 1) ||
            /\b(?:lot|bundle|crate|pack|collection)\b/i.test(item.title || '')
        );

        const newRecord: PlayHistoryRecord = {
            itemId: item.$id || item.id,
            itemTitle: item.title || 'Untitled Item',
            category,
            isLot,
            playId: play.id,
            playName: play.name,
            channel: extra?.channel,
            targetPrice: extra?.targetPrice,
            timestamp: Date.now()
        };

        const updated = [...playHistory.value, newRecord];
        playHistory.value = updated;
        saveHistory(updated);
    }

    /**
     * Get learned weights for plays within a specific category
     * Returns a map of playId -> selectionCount
     */
    function getCategoryAffinities(category: string): Record<string, number> {
        const counts: Record<string, number> = {};
        playHistory.value
            .filter(r => r.category === category || r.category === 'general')
            .forEach(r => {
                counts[r.playId] = (counts[r.playId] || 0) + 1;
            });
        return counts;
    }

    function clearHistory() {
        playHistory.value = [];
        if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEY);
        }
    }

    return {
        playHistory,
        totalPlaysRecorded,
        recordPlayExecution,
        getCategoryAffinities,
        detectItemCategory,
        clearHistory
    };
}
