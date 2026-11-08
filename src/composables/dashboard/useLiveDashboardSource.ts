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
import { manifestsApi } from '../../lib/manifests';
import { getSavedDropcasts } from '../../lib/dropcastModel';
import { JOIN_REQUEST_LOCATION_ID, JOIN_REQUEST_STATUS } from '../../lib/joinRequests';
import {
  PREVERIFIED_MD_MULTI_QTY_BINS,
  buildLockedMultiBinMap,
  matchMemoryDenInventoryItem,
  pacificMonthKey,
  resolvePartnerBucketForSaleRow,
  splitTrailingBoothSku,
} from '../../lib/salesBucketing';
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

  /** Pending "Connect With Us" requests (only members who can review them need the count). */
  const loadJoinRequests = async () => {
    const res = await databases.listDocuments(getDatabaseId(), 'manifests', [
      Query.equal('locationId', JOIN_REQUEST_LOCATION_ID),
      Query.equal('status', JOIN_REQUEST_STATUS.pending),
      Query.limit(1),
    ]);
    joinRequests.value = res.total;
  };

  /** Recent sales ledger docs. Uses `salesBucketing.ts` (Law 3) so Booth Bins (`0EJ097`, `0EJ0OF`, etc.) and SKU matches count as matched. */
  const loadSales = async () => {
    const res = await databases.listDocuments(getDatabaseId(), resolveCollectionId('sales'), [
      Query.limit(100),
      Query.orderDesc('$id'),
    ]);
    const activeItems = inventoryItems.value || [];
    const itemBySaleId = new Map<string, any>();
    for (const i of activeItems) if (i.saleId) itemBySaleId.set(String(i.saleId), i);
    const claimed = new Map<string, string>();
    const multiBins = buildLockedMultiBinMap(activeItems, claimed);

    const validDocs = (res.documents as any[]).filter(
      (d) => String(d.status || '').toLowerCase() !== 'cancelled'
    );
    rawSalesDocs.value = validDocs;
    sales.value = validDocs.map((d) => {
        const rawTitle = String(d.soNumber || d.orderId || '').trim();
        const split = splitTrailingBoothSku(rawTitle);
        const sku = String(d.sku || split.sku || '').trim().toUpperCase();
        const isPreverifiedBin = Boolean(sku && PREVERIFIED_MD_MULTI_QTY_BINS[sku]);
        const item =
          itemBySaleId.get(d.$id) ||
          matchMemoryDenInventoryItem({
            sku,
            upc: d.upc,
            title: split.title || rawTitle,
            price: Number(d.grossAmount || 0),
            activeItems,
            claimedItemIdToSku: claimed,
            multiBinResolvedBySku: multiBins,
          });
        const bucket = resolvePartnerBucketForSaleRow({
          sku,
          upc: item?.upc || d.upc,
          title: item?.title || rawTitle,
        });
        const inferredPrefix =
          item?.upc || (bucket === 'BB' ? 'BB-' : bucket === 'PDXGL' ? 'PDXGL-' : 'HUCK-');
        return {
          id: d.$id,
          title: item?.title || split.title || rawTitle || 'Register sale',
          soldAt: d.saleDate || d.$createdAt,
          amount: Number(d.grossAmount || 0),
          matched: Boolean(item || isPreverifiedBin),
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

  const loadDrops = () => {
    drops.value = getSavedDropcasts()
      .filter((c) => c.status === 'ready' || c.status === 'broadcasted')
      .map((c) => ({
        id: c.id,
        title: c.title,
        status: c.status === 'ready' ? ('ready' as const) : ('announced' as const),
      }));
  };

  const profile = computed(() => {
    const name = user.value?.name?.toLowerCase();
    if (!name) return undefined;
    return roster.value.find((m) => m.name.toLowerCase().includes(name));
  });

  const member = computed<DashboardMember>(() => ({
    name: profile.value?.name || user.value?.name || 'Member',
    // No roster match (e.g. the owner): show every hat, as before
    hats: profile.value?.hats?.length ? profile.value.hats : (Object.keys(MEMBER_HAT_META) as MemberHat[]),
    inventoryPrefix: profile.value?.inventoryPrefix,
  }));

  const statement = computed<DashboardStatementLite | null>(() => {
    const prefix = String(member.value.inventoryPrefix || 'HUCK-').toUpperCase();
    const curMonth = pacificMonthKey(new Date().toISOString());
    const monthSales = sales.value.filter(
      (s) => pacificMonthKey(s.soldAt) === curMonth && String(s.ownerPrefix || '').toUpperCase().startsWith(prefix)
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
    const agreement = findConsignorAgreement(policyConfig.value.consignors, prefix);
    if (agreement) {
      const settled = calculateConsignorSettlement(agreement, netDeposit, 0, 0, false);
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
  }));

  const loading = computed(() => initialLoading.value || inventoryLoading.value);

  const init = async () => {
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
          laborEntries.value = state.laborEntries || [];
        })
      );
      loadDrops();
      tasks.push(loadLastSync(), loadExpenses(), loadJoinRequests());
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
        category: hat === 'enabler' ? 'Booth Restock' : 'Social & Marketing',
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
