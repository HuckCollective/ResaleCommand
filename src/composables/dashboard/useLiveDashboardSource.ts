import { computed, ref } from 'vue';
import { useInventory } from '../useInventory';
import { usePurchases } from '../usePurchases';
import { useLoader } from '../useLoader';
import { useAuth } from '../useAuth';
import {
  DEFAULT_COOP_POLICY_CONFIG,
  calculateConsignorSettlement,
  findConsignorAgreement,
  loadCoopGovernanceState,
  logSweatEquityLaborEntry,
  normalizePolicyConfig,
  type CoopMemberProfile,
  type CoopPolicyConfig,
  type CoopProposal,
  type CoopLaborEntry,
} from '../../lib/coopGovernance';
import { MEMBER_HAT_META, type MemberHat } from '../../lib/memberHats';
import {
  emptySnapshot,
  type DashboardDropLite,
  type DashboardExpenseLite,
  type DashboardMember,
  type DashboardSaleLite,
  type DashboardStatementLite,
} from '../../lib/dashboardTypes';
import { databases, Query } from '../../lib/appwrite';
import { getDatabaseId, resolveCollectionId } from '../../lib/appwriteEnv';
import { coopExpensesApi } from '../../lib/coopExpenses';
import { getCoopJwtHeaders } from '../../lib/coopLedgerClient';
import { manifestsApi } from '../../lib/manifests';
import { getSavedDropcasts } from '../../lib/dropcastModel';
import { mapSocialCampaignsToDashboardDrops, normalizeSocialCampaign } from '../../lib/socialTracker';
import { effectiveStatus, loadVaultNotes } from '../../lib/founderVault';
import { joinApi } from '../../lib/joinRequestsClient';
import {
  PREVERIFIED_MD_MULTI_QTY_BINS,
  buildLockedMultiBinMap,
  cleanCatalogSku,
  matchMemoryDenInventoryItem,
  pacificMonthKey,
  resolvePartnerBucketForSaleRow,
  splitTrailingBoothSku,
} from '../../lib/salesBucketing';
import { salesApi } from '../../lib/sales';
import { isIntentionalNoSkuOrderId } from '../../lib/salesChannels';
import type { DashboardSource } from './useDashboardSource';

/** Real dashboard data (signed-in members). The ONLY dashboard file that talks to Appwrite. */
export function useLiveDashboardSource(): DashboardSource {
  const { inventoryItems, loading: inventoryLoading, fetchInventory } = useInventory();
  const { purchases, fetchPurchases } = usePurchases();
  const { hideLoader } = useLoader();
  const { user, currentTeam, isAdmin } = useAuth();

  const roster = ref<CoopMemberProfile[]>([]);
  const policyConfig = ref<CoopPolicyConfig>(DEFAULT_COOP_POLICY_CONFIG);
  const proposals = ref<CoopProposal[]>([]);
  const laborEntries = ref<CoopLaborEntry[]>([]);
  const initialLoading = ref(true);
  const sales = ref<DashboardSaleLite[]>([]);
  const rawSalesDocs = ref<any[]>([]);
  const expenses = ref<DashboardExpenseLite[]>([]);
  const drops = ref<DashboardDropLite[]>([]);
  const lastSyncAt = ref<string | null>(null);
  const joinRequests = ref(0);
  const coopMessages = ref(0);
  const pendingSharedExpenses = ref(0);
  const pendingLaborCount = ref(0);
  let messagesListenerAttached = false;

  /** Verified "Connect With Us" requests waiting on stewards (non-stewards simply get 0). */
  const loadJoinRequests = async () => {
    const res = await joinApi<{ pending: number }>('count', {}, { steward: true });
    joinRequests.value = res.ok ? res.data.pending || 0 : 0;
  };

  /** Open member messages, UI bug screenshots & AI scan flags in the shared Co-op Vault feed. */
  const loadCoopMessages = async () => {
    try {
      const res = await loadVaultNotes();
      const openNotes = (res.notes || []).filter(
        (n) =>
          !n.isMasterTemplate &&
          (n.kind === 'report' || n.kind === 'idea' || Boolean(n.messageKind)) &&
          effectiveStatus(n) === 'pending_review'
      );
      coopMessages.value = openNotes.length;
    } catch {
      coopMessages.value = 0;
    }
  };

  /** Recent sales ledger docs. Uses `salesBucketing.ts` (Law 3) and matches `SalesList.vue` 1:1 so Booth Bins, `orderId` titles, `COMMONS-`, and SKU/UPC matches all resolve accurately. */
  const loadSales = async () => {
    const allDocs = await salesApi.listSales(currentTeam.value?.$id);
    const activeItems = inventoryItems.value || [];
    const itemBySaleId = new Map<string, any>();
    for (const i of activeItems) if (i.saleId) itemBySaleId.set(String(i.saleId), i);
    const claimed = new Map<string, string>();
    const multiBins = buildLockedMultiBinMap(activeItems, claimed);

    const validDocs = (allDocs as any[]).filter(
      (d) => String(d.status || '').toLowerCase() !== 'cancelled'
    );
    rawSalesDocs.value = validDocs;
    sales.value = validDocs.map((d) => {
      const sSo = cleanCatalogSku(d.soNumber).toUpperCase();
      const sOrd = cleanCatalogSku(d.orderId).toUpperCase();
      const rawOrderDesc =
        d.orderId && String(d.orderId).includes('•')
          ? String(d.orderId).split('•').slice(1).join('•').trim()
          : String(d.orderId || '');
      const split = splitTrailingBoothSku(rawOrderDesc);
      const extractedSku = cleanCatalogSku(split.sku || (/^0EJ/i.test(sSo) ? sSo : '')).toUpperCase();
      const extractedUpc = /^[A-Z0-9]{2,6}-\d+/i.test(sSo) ? sSo : '';
      const sku = extractedSku || sSo;

      const soUpper = String(d.soNumber || '').trim().toUpperCase();
      const ordUpper = String(d.orderId || '').trim().toUpperCase();
      const isCommons =
        soUpper.startsWith('COMMONS-') || soUpper.startsWith('COMMONS') || ordUpper.includes('[COMMONS]');
      const isIntentionalNoSku = isIntentionalNoSkuOrderId(d.orderId);

      const item =
        (sSo && multiBins.get(sSo)) ||
        (extractedSku && multiBins.get(extractedSku)) ||
        (sOrd && multiBins.get(sOrd)) ||
        itemBySaleId.get(d.$id) ||
        activeItems.find(
          (i) =>
            (sSo &&
              (cleanCatalogSku(i.locationSku).toUpperCase() === sSo ||
                cleanCatalogSku(i.upc).toUpperCase() === sSo)) ||
            (extractedSku &&
              (cleanCatalogSku(i.locationSku).toUpperCase() === extractedSku ||
                cleanCatalogSku(i.upc).toUpperCase() === extractedSku)) ||
            (sOrd &&
              (cleanCatalogSku(i.locationSku).toUpperCase() === sOrd ||
                cleanCatalogSku(i.upc).toUpperCase() === sOrd))
        ) ||
        matchMemoryDenInventoryItem({
          sku,
          upc: extractedUpc,
          title: split.title || rawOrderDesc,
          price: Number(d.grossAmount || 0),
          extraText: `${d.soNumber || ''} ${d.orderId || ''}`,
          allowPrefixForPayout: true,
          activeItems,
          claimedItemIdToSku: claimed,
          multiBinResolvedBySku: multiBins,
        });

      const resolvedBinSku = cleanCatalogSku(item?.locationSku || item?.sku || sku).toUpperCase();
      const resolvedUpc = cleanCatalogSku(item?.upc || sSo).toUpperCase();
      const isPreverifiedBin = Object.entries(PREVERIFIED_MD_MULTI_QTY_BINS).some(
        ([skuKey, b]) =>
          skuKey === resolvedBinSku ||
          (resolvedUpc &&
            ((b.upc && b.upc.toUpperCase() === resolvedUpc) ||
              (b.altUpc && b.altUpc.toUpperCase() === resolvedUpc)))
      );

      if (item && !item.soldPrice && (d.netPayout || d.grossAmount)) {
        item.soldPrice = Number(d.netPayout || d.grossAmount || 0);
      }

      const bucket = resolvePartnerBucketForSaleRow({
        sku,
        upc: item?.upc || extractedUpc,
        title: item?.title || split.title || rawOrderDesc || soUpper,
      });
      const inferredPrefix =
        item?.upc ||
        (isCommons
          ? 'COMMONS-'
          : bucket === 'BB'
            ? 'BB-'
            : bucket === 'PDXGL'
              ? 'PDXGL-'
              : 'HUCK-');

      const displayTitle = (
        item?.title ||
        split.title ||
        rawOrderDesc.replace(/\s*\[COST:\d+(?:\.\d+)?\]\s*/gi, ' ').trim() ||
        soUpper ||
        'Register sale'
      ).trim();

      const isUnlinkedSo = /^SO-/i.test(soUpper);
      const isUnlinkedGenericTitle =
        !item && (/^ticket\s*#/i.test(displayTitle) || /^order\s+/i.test(displayTitle) || /^md-payout/i.test(displayTitle));
      const isMatched =
        !isCommons && !isIntentionalNoSku
          ? !isUnlinkedSo && !isUnlinkedGenericTitle && Boolean(item || isPreverifiedBin)
          : true;

      return {
        id: d.$id,
        title: displayTitle,
        soldAt: d.saleDate || d.$createdAt,
        amount: Number(d.grossAmount || 0),
        matched: isMatched,
        ownerPrefix: inferredPrefix,
      };
    });
  };

  /** Latest register-sync stamp across all system raw-CSV manifests (no hardcoded locations). */
  const loadLastSync = async () => {
    const docs = await manifestsApi.listManifests('system', undefined, 'system_sales_sync_raw_csv');
    const latest = docs
      .map((m: any) => Date.parse(m.$updatedAt || m.updatedAt || ''))
      .filter((t) => !isNaN(t))
      .sort((a, b) => b - a)[0];
    lastSyncAt.value = latest ? new Date(latest).toISOString() : null;
  };

  const loadExpenses = async () => {
    const rows = await coopExpensesApi.listExpenses(currentTeam.value?.$id || 'huck_collective', 500);
    pendingSharedExpenses.value = rows.filter(
      (e) => e.status === 'pending' && e.scope !== 'personal_write_off'
    ).length;
    expenses.value = rows
      .filter((e) => e.status !== 'rejected')
      .map((e) => ({
        id: e.id,
        title: e.description || e.category,
        amount: e.coopSharedAmount || e.amount,
        status: e.status === 'reimbursed' ? ('reimbursed' as const) : ('pending' as const),
        scope: e.scope,
      }));
  };

  const loadPendingLaborCount = async () => {
    try {
      const headers = await getCoopJwtHeaders();
      const res = await fetch('/api/coop/labor', { method: 'GET', headers });
      if (res.ok) {
        const body = await res.json();
        pendingLaborCount.value = Number(body?.summary?.pendingCount || 0);
        if (Array.isArray(body?.entries)) {
          laborEntries.value = body.entries;
        }
        return;
      }
    } catch {
      // Non-fatal fallback
    }
    pendingLaborCount.value = 0;
  };

  const loadDrops = async () => {
    try {
      const headers = await getCoopJwtHeaders();
      const res = await fetch('/api/coop/social-tracker', { method: 'GET', headers });
      if (res.ok) {
        const body = await res.json();
        if (Array.isArray(body?.campaigns)) {
          const normalized = body.campaigns.map((c: any, idx: number) => normalizeSocialCampaign(c, idx));
          drops.value = mapSocialCampaignsToDashboardDrops(normalized);
          return;
        }
      }
    } catch {
      // Non-fatal fallback: never block /dashboard hydration
    }
    drops.value = [];
  };

  const profile = computed(() => {
    const uid = user.value?.$id;
    const email = user.value?.email?.trim().toLowerCase();
    const cleanName = String(user.value?.name || '').replace(/\(.*?\)/g, '').trim().toLowerCase();
    if (uid) {
      const byUid = roster.value.find((m) => m.userId && m.userId === uid);
      if (byUid) return byUid;
    }
    if (email) {
      const byEmail = roster.value.find(
        (m) => (!m.userId || !uid || m.userId === uid) && m.email && m.email.trim().toLowerCase() === email
      );
      if (byEmail) return byEmail;
    }
    if (!cleanName) return undefined;
    return roster.value.find(
      (m) => !m.userId && !m.email && m.name.replace(/\(.*?\)/g, '').trim().toLowerCase() === cleanName
    );
  });

  const member = computed<DashboardMember>(() => ({
    name: profile.value?.name || user.value?.name || 'Member',
    // No roster match (e.g. the owner): show every hat, as before
    hats: profile.value?.hats?.length ? profile.value.hats : (Object.keys(MEMBER_HAT_META) as MemberHat[]),
    inventoryPrefix: profile.value?.inventoryPrefix,
    prefixStatus: profile.value?.prefixStatus,
    requestedPrefix: profile.value?.requestedPrefix,
    historicalPrefixes: profile.value?.historicalPrefixes,
  }));

  const statement = computed<DashboardStatementLite | null>(() => {
    const rawActive = String(member.value.inventoryPrefix || '').trim().toUpperCase();
    if (!rawActive) return null;
    const ownedPrefixes = Array.from(
      new Set(
        [rawActive, ...(member.value.historicalPrefixes || [])]
          .map((p) => String(p || '').trim().toUpperCase())
          .filter(Boolean)
      )
    );
    const curMonth = pacificMonthKey(new Date().toISOString());
    const monthSales = sales.value.filter(
      (s) =>
        pacificMonthKey(s.soldAt) === curMonth &&
        ownedPrefixes.some((px) => String(s.ownerPrefix || '').toUpperCase().startsWith(px))
    );
    if (monthSales.length === 0) return null;
    const rawById = new Map<string, any>();
    for (const d of rawSalesDocs.value) rawById.set(d.$id, d);
    const grossSales = Number(monthSales.reduce((acc, s) => acc + s.amount, 0).toFixed(2));
    const venueFee = Number(
      monthSales
        .reduce((acc, s) => acc + Number(rawById.get(s.id)?.commissionFee || 0), 0)
        .toFixed(2)
    );
    const netDeposit = Math.max(0, Number((grossSales - venueFee).toFixed(2)));
    const agreement = findConsignorAgreement(policyConfig.value.consignors, rawActive);
    if (agreement) {
      const settled = calculateConsignorSettlement({
        agreement,
        netStoreDeposit: netDeposit,
        grossRatio: 0,
        boothRent: 0,
        isMonthInProgress: true,
      });
      return {
        month: curMonth,
        ready: settled.payout > 0,
        grossSales,
        venueFee,
        rentOffset: Number((settled.rentDeduction + settled.coopCommission).toFixed(2)),
        payout: settled.payout,
        dealLabel: settled.formulaLabel,
      };
    }
    const curatorShare = (Number(policyConfig.value.curatorSharePct) || 70) / 100;
    const payout = Number((netDeposit * curatorShare).toFixed(2));
    const rentOffset = Number((netDeposit - payout).toFixed(2));
    return {
      month: curMonth,
      ready: payout > 0,
      grossSales,
      venueFee,
      rentOffset,
      payout,
      dealLabel: `Co-op Waterfall (${policyConfig.value.curatorSharePct}% Curator / ${policyConfig.value.commonsSharePct}% Commons)`,
    };
  });

  const pendingPrefixRequests = computed(() =>
    roster.value
      .filter(
        (m) =>
          Boolean(m.requestedPrefix) &&
          (m.prefixStatus === 'requested' || m.requestedPrefix !== m.inventoryPrefix)
      )
      .map((m) => ({
        name: m.name,
        email: m.email,
        requestedPrefix: String(m.requestedPrefix || ''),
      }))
  );

  const snapshot = computed(() => ({
    ...emptySnapshot(),
    items: inventoryItems.value || [],
    purchases: purchases.value || [],
    proposals: proposals.value,
    laborEntries: laborEntries.value,
    sales: sales.value,
    expenses: expenses.value,
    drops: drops.value,
    lastSyncAt: lastSyncAt.value,
    statement: statement.value,
    shortfall: Math.max(0, Number(policyConfig.value.carriedOverShortfall || 0)),
    joinRequests: joinRequests.value,
    coopMessages: coopMessages.value,
    pendingPrefixRequests: pendingPrefixRequests.value,
    pendingSharedExpenses: pendingSharedExpenses.value,
    pendingLaborCount: pendingLaborCount.value,
  }));

  const loading = computed(() => initialLoading.value || inventoryLoading.value);

  const init = async () => {
    if (!messagesListenerAttached && typeof window !== 'undefined') {
      messagesListenerAttached = true;
      window.addEventListener('coop-messages-updated', ((ev: CustomEvent) => {
        if (typeof ev?.detail?.pending === 'number') {
          coopMessages.value = ev.detail.pending;
        }
      }) as EventListener);
    }
    try {
      const tasks: Promise<unknown>[] = [];
      if (inventoryItems.value.length === 0) {
        // @ts-ignore existing signature takes a search string
        tasks.push(fetchInventory(''));
      }
      if (purchases.value.length === 0) tasks.push(fetchPurchases());
      tasks.push(
        loadCoopGovernanceState([], currentTeam.value?.$id || 'huck_collective').then(({ state }) => {
          const normalized = normalizePolicyConfig(state.policyConfig);
          policyConfig.value = normalized;
          roster.value = normalized.members;
          proposals.value = state.proposals || [];
          if (laborEntries.value.length === 0) {
            laborEntries.value = state.laborEntries || [];
          }
        })
      );
      tasks.push(
        loadDrops(),
        loadLastSync(),
        loadExpenses(),
        loadJoinRequests(),
        loadCoopMessages(),
        loadPendingLaborCount()
      );
      await Promise.allSettled(tasks);
      // Sales need inventory loaded first so each sale can be tied to its owner
      await loadSales().catch((e) => console.warn('[Dashboard] Sales load failed:', e));
    } catch (e) {
      console.error('[Dashboard] Error loading dashboard data:', e);
    } finally {
      initialLoading.value = false;
      hideLoader();
    }
  };

  const logHours = async (hat: MemberHat) => {
    const { syncedToCloud } = await logSweatEquityLaborEntry(
      {
        member: profile.value?.name,
        partner: 'SWEAT',
        category: hat === 'enabler' ? 'Booth Restock' : hat === 'builder' ? 'Tech & Admin' : 'Social & Marketing',
        hours: 1.5,
        notes: `${MEMBER_HAT_META[hat].label} contribution logged from My Role dashboard`,
      },
      currentTeam.value?.$id || 'huck_collective'
    );
    return { syncedToCloud };
  };

  return {
    mode: 'live',
    snapshot,
    member,
    hasMemberProfile: computed(() => !!profile.value),
    loading,
    isAdmin,
    init,
    logHours,
  };
}
