<template>
  <section v-if="locationMeta && locationMeta.code" class="w-full">
    <!-- Compact Pending Outbound Sync Card (Shown Whenever Items Need Booth / POS Action) -->
    <div
      v-if="pendingIntents.length > 0"
      class="card bg-base-100 border-2 border-warning/45 shadow-sm rounded-2xl p-4 sm:p-5 space-y-3"
    >
      <div class="flex items-start justify-between gap-3 flex-wrap">
        <div class="space-y-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-sm sm:text-base font-black text-base-content flex items-center gap-1.5">
              <span>{{ locationMeta.usesRicochet ? '🧹' : '📋' }}</span>
              <span>
                {{
                  locationMeta.usesRicochet
                    ? 'Pending Outbound Sync Queue'
                    : 'Physical Pull &amp; Retag Booth Checklist'
                }}
              </span>
            </h2>
            <span class="badge badge-sm badge-warning text-warning-content font-mono font-black">
              {{ pendingIntents.length }} pending
            </span>
          </div>
          <p class="text-xs text-base-content/75 leading-relaxed">
            <template v-if="locationMeta.usesRicochet">
              Open Ricochet POS, click
              <b>⚡ {{ locationMeta.shortName || locationMeta.code }} Sync</b> ➔
              <b>🧹 Sync Queue</b>, and run <b>🧪 Test 1 First</b> before applying the rest.
            </template>
            <template v-else>
              Complete each physical shelf update at {{ locationMeta.shortName || locationMeta.code }}, then click
              <b>✅ Done at Booth</b> to clear it from this checklist.
            </template>
          </p>
        </div>

        <div class="flex items-center gap-1.5 shrink-0">
          <button
            v-if="completedCount > 0"
            type="button"
            class="btn btn-xs h-8 btn-ghost border border-base-300 rounded-xl font-bold"
            :disabled="isRefreshing || Boolean(updatingId)"
            @click="clearCompleted"
          >
            Clear {{ completedCount }} Finished
          </button>
          <button
            type="button"
            class="btn btn-xs h-8 btn-ghost border border-base-300 rounded-xl font-bold"
            :disabled="isRefreshing"
            @click="fetchOutbox"
          >
            <span v-if="isRefreshing" class="loading loading-spinner loading-xs"></span>
            <span v-else>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div class="space-y-2 max-h-80 overflow-y-auto pr-0.5">
        <div
          v-for="intent in pendingIntents"
          :key="intent.id"
          class="rounded-xl border px-3 py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
          :class="
            intent.status === 'failed'
              ? 'bg-error/10 border-error/40'
              : 'bg-base-200/55 border-base-300'
          "
        >
          <div class="min-w-0 flex-1 space-y-1">
            <div class="flex items-center gap-1.5 flex-wrap">
              <span
                class="badge badge-xs font-bold"
                :class="actionBadgeClass(intent.action)"
              >
                {{ formatActionLabel(intent.action) }}
              </span>
              <span
                v-if="intent.externalSku"
                class="badge badge-xs badge-secondary text-secondary-content font-mono font-bold"
              >
                {{ intent.externalSku }}
              </span>
              <span v-if="intent.rcUpc" class="font-mono text-[11px] font-bold text-base-content/85">
                {{ intent.rcUpc }}
              </span>
              <span class="font-bold text-xs text-base-content truncate">
                {{ intent.title }}
              </span>
            </div>

            <div class="text-[11px] text-base-content/75 flex flex-wrap items-center gap-x-2 gap-y-0.5">
              <span>{{ intent.reason }}</span>
              <span v-if="intent.keeperExternalSku || intent.keeperUpc" class="font-mono font-semibold text-success">
                • Keep: {{ intent.keeperExternalSku || intent.keeperUpc }}
              </span>
            </div>

            <div
              v-if="intent.status === 'failed' && intent.error"
              class="text-[11px] font-bold text-error"
            >
              ⚠️ Last attempt note: {{ intent.error }}
            </div>
          </div>

          <div class="flex items-center gap-1.5 shrink-0 ml-auto">
            <button
              type="button"
              class="btn btn-xs h-8 btn-ghost border border-base-300 rounded-xl font-bold"
              :disabled="updatingId === intent.id"
              @click="ackIntent(intent, 'skipped')"
            >
              Skip
            </button>
            <button
              type="button"
              class="btn btn-xs h-8 rounded-xl font-black px-3"
              :class="
                locationMeta.usesRicochet
                  ? 'btn-outline btn-success'
                  : 'btn-success text-success-content'
              "
              :disabled="updatingId === intent.id"
              @click="ackIntent(intent, 'applied')"
            >
              <span v-if="updatingId === intent.id" class="loading loading-spinner loading-xs"></span>
              <span>{{ locationMeta.usesRicochet ? '✅ Mark Done' : '✅ Done at Booth' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Subtle Compact 1-Line Chip When Queue Is Clean or Error Needs Retry -->
    <div
      v-else
      class="rounded-xl border border-base-300/80 bg-base-200/45 px-3.5 py-2 flex items-center justify-between gap-2 flex-wrap text-xs"
    >
      <div class="flex items-center gap-2 min-w-0">
        <span v-if="loadError" class="text-warning font-bold">
          ⚠️ {{ loadError }}
        </span>
        <span v-else class="font-semibold text-base-content/80">
          ✅ {{ locationMeta.usesRicochet ? 'Outbound Sync Queue' : 'Booth Pull & Retag Checklist' }}: 0 pending
        </span>
        <span v-if="completedCount > 0" class="text-[11px] opacity-60 font-mono">
          ({{ completedCount }} finished)
        </span>
      </div>

      <div class="flex items-center gap-1.5 shrink-0">
        <button
          v-if="completedCount > 0"
          type="button"
          class="btn btn-2xs h-7 px-2 btn-ghost border border-base-300 rounded-lg font-bold"
          :disabled="isRefreshing"
          @click="clearCompleted"
        >
          Clear {{ completedCount }}
        </button>
        <button
          type="button"
          class="btn btn-2xs h-7 px-2 btn-ghost border border-base-300 rounded-lg font-bold"
          :disabled="isRefreshing"
          @click="fetchOutbox"
        >
          <span v-if="isRefreshing" class="loading loading-spinner loading-2xs"></span>
          <span v-else>🔄</span>
        </button>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { ChannelSyncAction, ChannelSyncIntent } from '../../lib/channelSyncOutbox';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { toUserMessage } from '../../lib/userFacingErrors';
import { addToast } from '../../stores/toast';

const props = defineProps<{
  locationMeta: {
    code: string;
    shortName?: string;
    name?: string;
    usesRicochet?: boolean;
    supportsPaperSalesSheet?: boolean;
  };
}>();

const intents = ref<ChannelSyncIntent[]>([]);
const isRefreshing = ref(false);
const updatingId = ref('');
const loadError = ref('');

const pendingIntents = computed(() =>
  intents.value.filter((i) => i.status === 'pending' || i.status === 'failed')
);
const completedCount = computed(
  () => intents.value.filter((i) => i.status === 'applied' || i.status === 'skipped').length
);

const formatActionLabel = (action: ChannelSyncAction) => {
  switch (action) {
    case 'deactivate_or_remove':
      return '🗑️ Zero Stock / Remove Tag';
    case 'update_price':
      return '💲 Update Price';
    case 'fill_blank_upc':
      return '🏷️ Fill Blank Barcode';
    case 'update_title':
      return '✏️ Update Title';
    default:
      return '🔄 Sync Item';
  }
};

const actionBadgeClass = (action: ChannelSyncAction) => {
  switch (action) {
    case 'deactivate_or_remove':
      return 'badge-warning text-warning-content';
    case 'update_price':
      return 'badge-info text-info-content';
    case 'fill_blank_upc':
      return 'badge-primary text-primary-content';
    default:
      return 'badge-ghost border border-base-300';
  }
};

const fetchOutbox = async () => {
  const code = String(props.locationMeta?.code || '').trim().toUpperCase();
  if (!code) return;
  isRefreshing.value = true;
  loadError.value = '';
  try {
    const res = await fetch(
      `/api/sync/channel-outbox?location=${encodeURIComponent(code)}`,
      {
        method: 'GET',
        headers: await getCoopJwtHeaders(),
      }
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      loadError.value = data?.error || 'Could not load the sync queue.';
      return;
    }
    intents.value = Array.isArray(data.intents) ? data.intents : [];
  } catch (err) {
    loadError.value = toUserMessage(err, 'Could not load the sync queue.');
  } finally {
    isRefreshing.value = false;
  }
};

const ackIntent = async (intent: ChannelSyncIntent, status: 'applied' | 'skipped') => {
  if (!intent?.id) return;
  updatingId.value = intent.id;
  try {
    const res = await fetch('/api/sync/channel-outbox', {
      method: 'POST',
      headers: await getCoopJwtHeaders(),
      body: JSON.stringify({
        mode: 'ack',
        location: props.locationMeta.code,
        results: [{ id: intent.id, status }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Could not update queue status.');
    }
    intents.value = Array.isArray(data.intents) ? data.intents : [];
    addToast({
      type: 'success',
      message:
        status === 'skipped'
          ? `Skipped ${intent.externalSku || intent.rcUpc || intent.title}.`
          : `✅ Marked ${intent.externalSku || intent.rcUpc || intent.title} done.`,
    });
  } catch (err) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not update the sync queue.'),
    });
  } finally {
    updatingId.value = '';
  }
};

const clearCompleted = async () => {
  isRefreshing.value = true;
  try {
    const res = await fetch('/api/sync/channel-outbox', {
      method: 'POST',
      headers: await getCoopJwtHeaders(),
      body: JSON.stringify({
        mode: 'clear_applied',
        location: props.locationMeta.code,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.ok) {
      throw new Error(data?.error || 'Could not clear completed queue items.');
    }
    intents.value = Array.isArray(data.intents) ? data.intents : [];
    addToast({ type: 'info', message: 'Cleared finished sync items.' });
  } catch (err) {
    addToast({
      type: 'error',
      message: toUserMessage(err, 'Could not clear finished sync items.'),
    });
  } finally {
    isRefreshing.value = false;
  }
};

watch(
  () => props.locationMeta?.code,
  () => {
    fetchOutbox();
  },
  { immediate: true }
);
</script>
