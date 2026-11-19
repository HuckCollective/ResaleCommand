import type { APIRoute } from 'astro';
import { getItemsCollectionId, getPurchasesCollectionId } from '../../../lib/appwriteEnv';
import {
  CoopHttpError,
  errorResponse,
  getCoopServerContext,
  requireCoopMember,
} from '../../../lib/coopLedgerServer';
import { evaluateItemAccess } from '../../../lib/curatorOwnership';
import type { MemberCapabilities } from '../../../lib/memberAccess';

export const prerender = false;

const DEFAULT_COLLECTION_ID = getItemsCollectionId();

export const POST: APIRoute = async ({ request }) => {
  try {
    const ctx = getCoopServerContext();
    const caller = await requireCoopMember(request, ctx);

    const body = await request.json();
    const { itemIds, collectionId, dbId } = body || {};

    if (!Array.isArray(itemIds) || itemIds.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Select at least one item to delete.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const targetDbId = dbId || ctx.dbId;
    const targetCollectionId = collectionId || DEFAULT_COLLECTION_ID;
    const db = ctx.databases;

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

    let deletedCount = 0;
    let failedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const blockedReasons: string[] = [];

    const CHUNK_SIZE = 20;
    for (let i = 0; i < itemIds.length; i += CHUNK_SIZE) {
      const chunk = itemIds.slice(i, i + CHUNK_SIZE);
      const promises = chunk.map(async (id: string) => {
        try {
          if (!caller.isFounder) {
            const found = await fetchExistingItem(id);
            if (!found) {
              return { success: false, id, error: 'Item could not be found.' };
            }
            const purchaseBuyerId = await resolvePurchaseBuyerId(found.doc?.purchaseId);
            const decision = evaluateItemAccess(found.doc, callerCaps, {
              userId: caller.userId,
              purchaseBuyerId,
            });
            if (!decision.canEditFull) {
              return {
                success: false,
                blocked: true,
                id,
                error:
                  decision.readOnlyReason ||
                  'Only the item owner or an Account Steward can delete this item.',
              };
            }
            await db.deleteDocument(targetDbId, found.colId, id);
            return { success: true, id };
          }

          await db.deleteDocument(targetDbId, targetCollectionId, id);
          return { success: true, id };
        } catch (err: any) {
          return {
            success: false,
            id,
            error: err?.message || 'Unable to delete item.',
          };
        }
      });

      const results = await Promise.all(promises);
      for (const res of results) {
        if (res.success) {
          deletedCount++;
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

    if (deletedCount === 0 && skippedCount > 0) {
      return new Response(
        JSON.stringify({
          error:
            blockedReasons[0] ||
            'You can only delete items under your own Curator SKU.',
          code: 'FORBIDDEN_OWNERSHIP',
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
        deletedCount,
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
    console.error('Server bulk-delete error:', err);
    return new Response(
      JSON.stringify({
        error: 'Unable to delete items — please try again.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};
