import { ref, computed } from 'vue';

export const SELF_MUTATION_TTL_MS = 12_000;
export const WRITE_GRACE_TTL_MS = 1_500;
const AUTO_FLUSH_IDLE_MS = 800;

export type CalmRealtimeEventType = 'create' | 'update' | 'delete';

export interface CalmRealtimeEventOptions {
    scope: string;
    id: string;
    eventType: CalmRealtimeEventType;
    existsInList: boolean;
    evictsFromActiveView?: boolean;
    extraBusy?: boolean;
    applyImmediate: () => void;
    applyBuffered?: () => void;
}

export interface QueuedCalmUpdate {
    key: string;
    scope: string;
    id: string;
    eventType: CalmRealtimeEventType;
    enqueuedAt: number;
    apply: () => void;
}

const selfMutationMap = new Map<string, number>();
const inFlightWrites = new Map<string, number>();
const lastCompletedWriteAt = new Map<string, number>();
const selectionSources = new Map<symbol, number>();

const calmOverlayCount = ref(0);
const calmSelectionCount = ref(0);
const pendingCalmQueue = ref<QueuedCalmUpdate[]>([]);

let autoFlushTimer: ReturnType<typeof setTimeout> | null = null;
let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;
let listenersAttached = false;

function pruneExpiredSelfMutations(now: number): void {
    for (const [key, ts] of selfMutationMap.entries()) {
        if (now - ts > SELF_MUTATION_TTL_MS) {
            selfMutationMap.delete(key);
        }
    }
}

export function markCalmSelfMutation(idOrIds: string | string[], scope = 'global'): void {
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const now = Date.now();
    pruneExpiredSelfMutations(now);
    const cleanScope = String(scope || 'global').trim() || 'global';
    for (const rawId of ids) {
        const id = String(rawId || '').trim();
        if (!id) continue;
        selfMutationMap.set(`${cleanScope}:${id}`, now);
        if (cleanScope !== 'global') {
            selfMutationMap.set(`global:${id}`, now);
        }
    }
}

export function beginCalmLocalWrite(scope = 'global'): () => void {
    const cleanScope = String(scope || 'global').trim() || 'global';
    inFlightWrites.set(cleanScope, (inFlightWrites.get(cleanScope) || 0) + 1);
    let closed = false;
    return () => {
        if (closed) return;
        closed = true;
        const remaining = Math.max(0, (inFlightWrites.get(cleanScope) || 1) - 1);
        if (remaining === 0) {
            inFlightWrites.delete(cleanScope);
        } else {
            inFlightWrites.set(cleanScope, remaining);
        }
        lastCompletedWriteAt.set(cleanScope, Date.now());
    };
}

export function isRecentSelfMutation(id: string, scope = 'global'): boolean {
    const now = Date.now();
    pruneExpiredSelfMutations(now);
    const cleanScope = String(scope || 'global').trim() || 'global';
    const cleanId = String(id || '').trim();

    if (cleanId) {
        const scopedTs = selfMutationMap.get(`${cleanScope}:${cleanId}`);
        if (scopedTs !== undefined && now - scopedTs <= SELF_MUTATION_TTL_MS) {
            return true;
        }
        const globalTs = selfMutationMap.get(`global:${cleanId}`);
        if (globalTs !== undefined && now - globalTs <= SELF_MUTATION_TTL_MS) {
            return true;
        }
    }

    if ((inFlightWrites.get(cleanScope) || 0) > 0 || (inFlightWrites.get('global') || 0) > 0) {
        return true;
    }

    const lastScoped = lastCompletedWriteAt.get(cleanScope) || 0;
    if (lastScoped > 0 && now - lastScoped <= WRITE_GRACE_TTL_MS) {
        return true;
    }
    const lastGlobal = lastCompletedWriteAt.get('global') || 0;
    if (lastGlobal > 0 && now - lastGlobal <= WRITE_GRACE_TTL_MS) {
        return true;
    }

    return false;
}

export function setCalmOverlayCount(count: number): void {
    const prev = calmOverlayCount.value;
    calmOverlayCount.value = Math.max(0, Number(count) || 0);
    if (prev > 0 && calmOverlayCount.value === 0 && pendingCalmQueue.value.length > 0) {
        scheduleAutoFlush();
    }
}

function recomputeSelectionCount(): void {
    let total = 0;
    for (const count of selectionSources.values()) {
        total += Math.max(0, Number(count) || 0);
    }
    const prev = calmSelectionCount.value;
    calmSelectionCount.value = total;
    if (prev > 0 && total === 0 && pendingCalmQueue.value.length > 0) {
        scheduleAutoFlush();
    }
}

export function registerCalmSelectionSource(): {
    update: (count: number) => void;
    dispose: () => void;
} {
    const token = Symbol('calmSelection');
    selectionSources.set(token, 0);
    return {
        update(count: number) {
            if (!selectionSources.has(token)) return;
            selectionSources.set(token, Math.max(0, Number(count) || 0));
            recomputeSelectionCount();
        },
        dispose() {
            if (selectionSources.delete(token)) {
                recomputeSelectionCount();
            }
        },
    };
}

export function isUserBusyForRowShift(): boolean {
    if (calmOverlayCount.value > 0) return true;
    if (calmSelectionCount.value > 0) return true;

    if (typeof window !== 'undefined' && (window.scrollY || 0) > 180) {
        return true;
    }

    if (typeof document !== 'undefined') {
        const el = document.activeElement as HTMLElement | null;
        if (el) {
            const tag = el.tagName;
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) {
                return true;
            }
        }
    }

    return false;
}

function detachPassiveListeners(): void {
    if (!listenersAttached || typeof window === 'undefined' || typeof document === 'undefined') return;
    window.removeEventListener('scroll', onPassiveScroll);
    document.removeEventListener('focusout', onPassiveFocusOut);
    listenersAttached = false;
}

function onPassiveScroll(): void {
    if (scrollThrottleTimer) return;
    scrollThrottleTimer = setTimeout(() => {
        scrollThrottleTimer = null;
        if (pendingCalmQueue.value.length > 0 && !isUserBusyForRowShift()) {
            scheduleAutoFlush();
        }
    }, 200);
    if (typeof scrollThrottleTimer === 'object' && scrollThrottleTimer !== null && 'unref' in scrollThrottleTimer) {
        (scrollThrottleTimer as { unref?: () => void }).unref?.();
    }
}

function onPassiveFocusOut(): void {
    if (pendingCalmQueue.value.length > 0) {
        scheduleAutoFlush();
    }
}

function attachPassiveListeners(): void {
    if (listenersAttached || typeof window === 'undefined' || typeof document === 'undefined') return;
    window.addEventListener('scroll', onPassiveScroll, { passive: true });
    document.addEventListener('focusout', onPassiveFocusOut, { passive: true });
    listenersAttached = true;
}

function scheduleAutoFlush(): void {
    if (typeof window === 'undefined') return;
    if (pendingCalmQueue.value.length === 0) return;

    attachPassiveListeners();
    if (autoFlushTimer) {
        clearTimeout(autoFlushTimer);
        autoFlushTimer = null;
    }

    autoFlushTimer = setTimeout(() => {
        autoFlushTimer = null;
        if (pendingCalmQueue.value.length > 0 && !isUserBusyForRowShift()) {
            flushCalmUpdates();
        }
    }, AUTO_FLUSH_IDLE_MS);
    if (typeof autoFlushTimer === 'object' && autoFlushTimer !== null && 'unref' in autoFlushTimer) {
        (autoFlushTimer as { unref?: () => void }).unref?.();
    }
}

export function flushCalmUpdates(scope?: string): number {
    if (autoFlushTimer) {
        clearTimeout(autoFlushTimer);
        autoFlushTimer = null;
    }

    const current = pendingCalmQueue.value;
    if (current.length === 0) {
        detachPassiveListeners();
        return 0;
    }

    const toRun: QueuedCalmUpdate[] = [];
    const remaining: QueuedCalmUpdate[] = [];

    for (const entry of current) {
        if (!scope || entry.scope === scope) {
            toRun.push(entry);
        } else {
            remaining.push(entry);
        }
    }

    pendingCalmQueue.value = remaining;
    if (remaining.length === 0) {
        detachPassiveListeners();
    }

    for (const entry of toRun) {
        try {
            entry.apply();
        } catch (err) {
            console.warn('[useCalmRealtime] Flush callback error:', err);
        }
    }

    return toRun.length;
}

export function handleCalmRealtimeEvent(opts: CalmRealtimeEventOptions): 'immediate' | 'buffered' {
    const cleanScope = String(opts.scope || 'global').trim() || 'global';
    const cleanId = String(opts.id || '').trim();
    const key = `${cleanScope}:${cleanId}`;

    // 1. Self-authored mutation or within write-grace window: apply immediately and drop any queued copy
    if (isRecentSelfMutation(cleanId, cleanScope)) {
        if (pendingCalmQueue.value.some((q) => q.key === key)) {
            pendingCalmQueue.value = pendingCalmQueue.value.filter((q) => q.key !== key);
            if (pendingCalmQueue.value.length === 0) detachPassiveListeners();
        }
        opts.applyImmediate();
        return 'immediate';
    }

    // 2. Non-row-shifting scalar .update on an existing visible row: update quietly in-place (0px shift)
    if (opts.eventType === 'update' && opts.existsInList && !opts.evictsFromActiveView) {
        opts.applyImmediate();
        return 'immediate';
    }

    // 3. Idle at top with no active selection/input/overlay: apply cleanly without nagging
    if (!isUserBusyForRowShift() && !opts.extraBusy) {
        const fn = opts.applyBuffered || opts.applyImmediate;
        fn();
        return 'immediate';
    }

    // 4. Busy posture: coalesce by `${scope}:${id}` in pendingCalmQueue
    const entry: QueuedCalmUpdate = {
        key,
        scope: cleanScope,
        id: cleanId,
        eventType: opts.eventType,
        enqueuedAt: Date.now(),
        apply: opts.applyBuffered || opts.applyImmediate,
    };

    const existingIdx = pendingCalmQueue.value.findIndex((q) => q.key === key);
    if (existingIdx !== -1) {
        const next = [...pendingCalmQueue.value];
        next[existingIdx] = entry;
        pendingCalmQueue.value = next;
    } else {
        pendingCalmQueue.value = [...pendingCalmQueue.value, entry];
    }

    scheduleAutoFlush();
    return 'buffered';
}

export const pendingCalmCount = computed(() => pendingCalmQueue.value.length);
export const hasCalmOpenOverlay = computed(() => calmOverlayCount.value > 0);

export function useCalmRealtime() {
    return {
        pendingCalmCount,
        pendingCalmQueue,
        hasCalmOpenOverlay,
        calmSelectionCount,
        flushCalmUpdates,
        isUserBusyForRowShift,
        markCalmSelfMutation,
        beginCalmLocalWrite,
        isRecentSelfMutation,
        handleCalmRealtimeEvent,
    };
}
