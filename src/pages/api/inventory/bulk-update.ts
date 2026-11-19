import type { APIRoute } from 'astro';
import { getItemsCollectionId, getPurchasesCollectionId } from '../../../lib/appwriteEnv';
import {
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  requireCoopMember,
} from '../../../lib/coopLedgerServer';
import {
  canItemBePlacedOrPrinted,
  evaluateItemAccess,
  isPlacementMutation,
  sanitizeCoCuratorUpdatePayload,
} from '../../../lib/curatorOwnership';
import type { MemberCapabilities } from '../../../lib/memberAccess';
import {
  coCurationDocIdForItem,
  normalizeCoCurationRecord,
  type CoCurationRecord,
} from '../../../lib/onlineCoCuration';

export const prerender = false;

const DEFAULT_COLLECTION_ID = getItemsCollectionId();

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopMember(request, ctx);

    const body = await request.json();
    const { itemIds, updates, collectionId, dbId } = body || {};

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Select at least one item to update.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!updates || typeof updates !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Update details are missing.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetDbId = dbId || ctx.dbId;
    const targetCollectionId = collectionId || DEFAULT_COLLECTION_ID;
    const db = ctx.databases;

    // Sanitize updates (Golden Rule #1: storageLocation must NEVER be blank/unassigned)
    const safeData: Record<string, any> = {};
    if (updates.storageLocation !== undefined) {
      const trimmedLoc = String(updates.storageLocation ?? '').trim();
      safeData.storageLocation =
        !trimmedLoc || trimmedLoc.toLowerCase() === 'backstock' ? 'HG' : trimmedLoc;
    }
    if (updates.status !== undefined) {
      safeData.status = updates.status;
    }
    if (updates.upc !== undefined) {
      safeData.upc = updates.upc;
    }
    if (updates.locationSku !== undefined) {
      safeData.locationSku = updates.locationSku === '' ? null : updates.locationSku;
    }
    if (updates.sellingLocations !== undefined && Array.isArray(updates.sellingLocations)) {
      safeData.sellingLocations = updates.sellingLocations;
    }
    if (updates.conditionNotes !== undefined) {
      safeData.conditionNotes = updates.conditionNotes;
    }

    const callerCaps: Partial<MemberCapabilities> = {
      role: caller.isFounder ? 'founder' : 'curator',
      prefix: caller.linkedPrefix || '',
      prefixStatus: caller.prefixStatus || (caller.linkedPrefix ? 'locked' : 'unset'),
      ownedPrefixes: Array.from(
        new Set([
          ...(caller.ownedPrefixes || []),
          ...(Array.isArray(caller.linkedMember?.historicalPrefixes)
            ? caller.linkedMember.historicalPrefixes
            : []),
        ])
      ),
      isConsignor: false,
    };

    const purchaseBuyerCache = new Map<string, string>();
    const purchasesColId = getPurchasesCollectionId();
    const resolvePurchaseBuyerId = async (purchaseId?: string): Promise<string> => {
      const pid = String(purchaseId || '').trim();
      if (!pid) return '';
      if (purchaseBuyerCache.has(pid)) return purchaseBuyerCache.get(pid) || '';
      try {
        const pDoc: any = await db.getDocument(targetDbId, purchasesColId, pid);
        const buyerId = String(pDoc?.buyerId || '').trim();
        purchaseBuyerCache.set(pid, buyerId);
        return buyerId;
      } catch {
        purchaseBuyerCache.set(pid, '');
        return '';
      }
    };

    const fetchExistingItem = async (
      id: string
    ): Promise<{ doc: any; colId: string } | null> => {
      try {
        const doc = await db.getDocument(targetDbId, targetCollectionId, id);
        return { doc, colId: targetCollectionId };
      } catch (err: any) {
        if (err?.code === 404 || err?.message?.includes('not be found')) {
          const altCollectionId = targetCollectionId === 'items' ? 'items_dev' : 'items';
          try {
            const doc = await db.getDocument(targetDbId, altCollectionId, id);
            return { doc, colId: altCollectionId };
          } catch {
            return null;
          }
        }
        return null;
      }
    };

    const fetchActiveCoCuration = async (itemId: string): Promise<CoCurationRecord | null> => {
      try {
        const doc: any = await db.getDocument(
          targetDbId,
          'manifests',
          coCurationDocIdForItem(itemId)
        );
        if (typeof doc?.itemsSnapshot === 'string' && doc.itemsSnapshot.trim().startsWith('{')) {
          return normalizeCoCurationRecord(JSON.parse(doc.itemsSnapshot));
        }
      } catch {
        // No co-curation manifest for this item
      }
      return null;
    };

    let updatedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const blockedReasons: string[] = [];
    const wantPlacement = isPlacementMutation(safeData);

    const CHUNK_SIZE = 20;
    for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
      const chunk = itemIds.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (id: string) => {
        try {
          if (caller.isFounder) {
            if (wantPlacement) {
              const found = await fetchExistingItem(id);
              if (found) {
                const projected = { ...found.doc, ...safeData };
                const placementCheck = canItemBePlacedOrPrinted(projected, callerCaps, {
                  userId: caller.userId,
                });
                if (!placementCheck.allowed) {
                  return {
                    success: false,
                    blocked: true,
                    id,
                    error: placementCheck.reason,
                  };
                }
              }
            }
            try {
              await db.updateDocument(targetDbId, targetCollectionId, id, safeData);
              return { success: true, id };
            } catch (err: any) {
              if (err?.code === 404 || err?.message?.includes('not be found')) {
                const altCollectionId =
                  targetCollectionId === 'items' ? 'items_dev' : 'items';
                await db.updateDocument(targetDbId, altCollectionId, id, safeData);
                return { success: true, id };
              }
              throw err;
            }
          }

          // Non-Founder path: verify ownership or active Co-Curator carve-out + Pre-Placement Lock
          const found = await fetchExistingItem(id);
          if (!found) {
            return { success: false, id, error: 'Item could not be found.' };
          }
          const { doc, colId } = found;
          const purchaseBuyerId = await resolvePurchaseBuyerId(doc?.purchaseId);

          let decision = evaluateItemAccess(doc, callerCaps, {
            userId: caller.userId,
            purchaseBuyerId,
          });
          let activeCoCuration: CoCurationRecord | null = null;

          if (!decision.canEditFull) {
            activeCoCuration = await fetchActiveCoCuration(id);
            decision = evaluateItemAccess(doc, callerCaps, {
              userId: caller.userId,
              purchaseBuyerId,
              activeCoCuration,
            });
          }

          if (!decision.canSaveAny) {
            return {
              success: false,
              blocked: true,
              id,
              error: decision.readOnlyReason,
            };
          }

          const effectiveData = decision.canEditFull
            ? safeData
            : sanitizeCoCuratorUpdatePayload(safeData, doc);

          if (Object.keys(effectiveData).length === 0) {
            return {
              success: false,
              blocked: true,
              id,
              error:
                'Co-Curators cannot modify protected cost, barcode, or accounting fields.',
            };
          }

          if (isPlacementMutation(effectiveData)) {
            const projected = { ...doc, ...effectiveData };
            const placementCheck = canItemBePlacedOrPrinted(projected, callerCaps, {
              userId: caller.userId,
              purchaseBuyerId,
              activeCoCuration,
            });
            if (!placementCheck.allowed) {
              return {
                success: false,
                blocked: true,
                id,
                error: placementCheck.reason,
              };
            }
          }

          await db.updateDocument(targetDbId, colId, id, effectiveData);
          return { success: true, id };
        } catch (err: any) {
          if (err instanceof CoopHttpError) {
            return { success: false, blocked: true, id, error: err.message };
          }
          return {
            success: false,
            id,
            error: err?.message || 'Unable to update item.',
          };
        }
      });

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.success) {
          updatedCount++;
        } else if ((res as any).blocked) {
          skippedCount++;
          failedCount++;
          if (res.error) blockedReasons.push(res.error);
          if (errors.length < 5) errors.push(`Item ${res.id}: ${res.error}`);
        } else {
          failedCount++;
          if (errors.length < 5) errors.push(`Item ${res.id}: ${res.error}`);
        }
      }

      if (i + CHUNK_SIZE < itemIds.length) {
        await new Promise((r) => setTimeout(r, 60));
      }
    }

    if (updatedCount === 0 && skippedCount > 0) {
      return new Response(
        JSON.stringify({
          error:
            blockedReasons[0] ||
            'You can only update items under your own Curator SKU or active Co-Curation.',
          code: 'FORBIDDEN_OR_PREFIX_LOCKED',
          skippedCount,
          errors,
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        total: itemIds.length,
        updatedCount,
        failedCount,
        skippedCount: skippedCount > 0 ? skippedCount : undefined,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  } catch (err: any) {
    if (err instanceof CoopHttpError) {
      return errorResponse(err);
    }
    console.error('Server bulk-update error:', err);
    return new Response(
      JSON.stringify({
        error: 'Unable to complete bulk update — please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
