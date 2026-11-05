import { databases, storage, ID, Query } from './appwrite';
import { getDatabaseId, getBucketId } from './appwriteEnv';

export type ExpenseCategory =
  | 'Booth Rent & Mall Fees'
  | 'Thermal Tags & Merch Supplies'
  | 'Display Hardware & Fixtures'
  | 'Tech Commons & AI Credits'
  | 'Hauling & Sourcing Transport'
  | 'Cleaning & Facility Maintenance'
  | 'General Operational Commons'
  | 'Personal Schedule C Write-Off';

export type ExpenseStatus = 'pending' | 'approved' | 'reimbursed' | 'rejected';

export type ExpenseAllocationScope = 'coop_shared' | 'personal_write_off' | 'split';

export interface CoopExpenseItem {
  id: string;
  cartId: string;
  tenantId: string;
  amount: number;
  date: string;
  category: ExpenseCategory;
  member: string;
  partner: string;
  description: string;
  status: ExpenseStatus;
  reimbursedAt: string | null;
  receiptImageId: string | null;
  receiptUrl: string | null;
  /** Allocation scope separating Co-op Commons reimbursement from Personal IRS Schedule C write-offs */
  scope: ExpenseAllocationScope;
  /** Percentage (0-100) charged to the 30% Co-op Commons Pool */
  coopSharePct: number;
  /** Dollar amount charged to the 30% Co-op Commons Pool */
  coopSharedAmount: number;
  /** Dollar amount retained for the member's Personal IRS Schedule C Tax Write-Off Ledger */
  personalWriteOffAmount: number;
  rawNote?: string;
  createdAt?: string;
}

export interface NewCoopExpensePayload {
  amount: number;
  date: string;
  category: ExpenseCategory;
  member: string;
  partner?: string;
  description: string;
  scope?: ExpenseAllocationScope;
  coopSharePct?: number;
  receiptFile?: File | null;
  tenantId?: string;
}

const DB_ID = () => getDatabaseId();
const BUCKET_ID = () => getBucketId();
const EXPENSES_COL = 'expenses';

function roundCents(val: number): number {
  return Math.round((Number(val) || 0) * 100) / 100;
}

export function inferDefaultScopeForCategory(
  category: ExpenseCategory,
  description = ''
): { scope: ExpenseAllocationScope; coopSharePct: number } {
  const lower = `${category} ${description}`.toLowerCase();
  if (
    category === 'Personal Schedule C Write-Off' ||
    category === 'Hauling & Sourcing Transport' ||
    lower.includes('mileage') ||
    lower.includes('home office') ||
    lower.includes('personal') ||
    lower.includes('gas')
  ) {
    return { scope: 'personal_write_off', coopSharePct: 0 };
  }
  return { scope: 'coop_shared', coopSharePct: 100 };
}

export function computeScopeSplitAmounts(
  amount: number,
  scope: ExpenseAllocationScope,
  rawCoopPct?: number
): {
  scope: ExpenseAllocationScope;
  coopSharePct: number;
  coopSharedAmount: number;
  personalWriteOffAmount: number;
} {
  const total = roundCents(amount);
  let coopSharePct = 100;
  if (scope === 'personal_write_off') {
    coopSharePct = 0;
  } else if (scope === 'split') {
    const pct = Number.isFinite(Number(rawCoopPct)) ? Number(rawCoopPct) : 50;
    coopSharePct = Math.min(99, Math.max(1, Math.round(pct)));
  } else {
    coopSharePct = 100;
  }
  const coopSharedAmount = roundCents(total * (coopSharePct / 100));
  const personalWriteOffAmount = roundCents(Math.max(0, total - coopSharedAmount));
  return { scope, coopSharePct, coopSharedAmount, personalWriteOffAmount };
}

export function getReceiptImageUrl(fileId: string | null | undefined): string | null {
  if (!fileId) return null;
  if (fileId.startsWith('http')) return fileId;
  const endpoint = import.meta.env.PUBLIC_APPWRITE_ENDPOINT || 'https://sfo.cloud.appwrite.io/v1';
  const project = import.meta.env.PUBLIC_APPWRITE_PROJECT_ID || '69714b35003a8adab6bb';
  return `${endpoint}/storage/buckets/${BUCKET_ID()}/files/${fileId}/view?project=${project}`;
}

export function parseExpenseNote(noteStr: string | null | undefined): {
  category: ExpenseCategory;
  member: string;
  partner: string;
  description: string;
  status: ExpenseStatus;
  reimbursedAt: string | null;
  scope: ExpenseAllocationScope;
  coopSharePct: number;
} {
  const fallback = {
    category: 'General Operational Commons' as ExpenseCategory,
    member: 'Huckleberry Collective',
    partner: 'HUCK',
    description: noteStr || 'Operational Expense',
    status: 'reimbursed' as ExpenseStatus,
    reimbursedAt: null,
    scope: 'coop_shared' as ExpenseAllocationScope,
    coopSharePct: 100,
  };

  if (!noteStr) return fallback;

  // 1. Try parsing JSON format
  if (noteStr.trim().startsWith('{') && noteStr.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(noteStr);
      const category = (parsed.category as ExpenseCategory) || fallback.category;
      const description = parsed.desc || parsed.description || fallback.description;
      const inferred = inferDefaultScopeForCategory(category, description);
      const scope: ExpenseAllocationScope =
        parsed.scope === 'personal_write_off' || parsed.scope === 'split' || parsed.scope === 'coop_shared'
          ? parsed.scope
          : inferred.scope;
      const coopSharePct =
        parsed.coopSharePct !== undefined ? Number(parsed.coopSharePct) : inferred.coopSharePct;

      return {
        category,
        member: parsed.member || fallback.member,
        partner: parsed.partner || fallback.partner,
        description,
        status: (parsed.status as ExpenseStatus) || 'approved',
        reimbursedAt: parsed.reimbursedAt || null,
        scope,
        coopSharePct,
      };
    } catch {}
  }

  // 2. Try parsing prefix tag format e.g. "[BOOTH_SUPPLIES] Rollo labels (Tyler)"
  const tagMatch = noteStr.match(/^\[([A-Z_]+)\]\s*(.*)$/i);
  if (tagMatch) {
    const rawTag = tagMatch[1].toUpperCase();
    let cat: ExpenseCategory = 'General Operational Commons';
    if (rawTag.includes('RENT') || rawTag.includes('MALL')) cat = 'Booth Rent & Mall Fees';
    else if (rawTag.includes('LABEL') || rawTag.includes('TAG') || rawTag.includes('SUPPLIES')) cat = 'Thermal Tags & Merch Supplies';
    else if (rawTag.includes('DISPLAY') || rawTag.includes('HARDWARE')) cat = 'Display Hardware & Fixtures';
    else if (rawTag.includes('AI') || rawTag.includes('TECH') || rawTag.includes('CLOUD')) cat = 'Tech Commons & AI Credits';
    else if (rawTag.includes('GAS') || rawTag.includes('TRANSPORT') || rawTag.includes('HAUL')) cat = 'Hauling & Sourcing Transport';
    else if (rawTag.includes('PERSONAL')) cat = 'Personal Schedule C Write-Off';

    const desc = tagMatch[2] || noteStr;
    const inferred = inferDefaultScopeForCategory(cat, desc);
    return {
      category: cat,
      member: 'Core Member',
      partner: 'HUCK',
      description: desc,
      status: 'approved',
      reimbursedAt: null,
      scope: inferred.scope,
      coopSharePct: inferred.coopSharePct,
    };
  }

  // 3. Fallback for legacy notes (e.g. "gas", "Paper Bag", "Google Gemini AI API Cloud Billing")
  const lower = noteStr.toLowerCase();
  let cat: ExpenseCategory = 'General Operational Commons';
  if (lower.includes('gemini') || lower.includes('ai') || lower.includes('google')) cat = 'Tech Commons & AI Credits';
  else if (lower.includes('gas') || lower.includes('mileage')) cat = 'Hauling & Sourcing Transport';
  else if (lower.includes('bag') || lower.includes('box') || lower.includes('label')) cat = 'Thermal Tags & Merch Supplies';
  else if (lower.includes('rent') || lower.includes('memory den')) cat = 'Booth Rent & Mall Fees';

  const inferred = inferDefaultScopeForCategory(cat, noteStr);
  return {
    ...fallback,
    category: cat,
    description: noteStr,
    scope: inferred.scope,
    coopSharePct: inferred.coopSharePct,
  };
}

function hydrateExpenseDoc(doc: any): CoopExpenseItem {
  const amount = Number(doc.amount || 0);
  const parsed = parseExpenseNote(doc.note);
  const split = computeScopeSplitAmounts(amount, parsed.scope, parsed.coopSharePct);
  return {
    id: doc.$id,
    cartId: doc.cartId || '',
    tenantId: doc.tenantId || '',
    amount,
    date: doc.date || doc.$createdAt,
    category: parsed.category,
    member: parsed.member,
    partner: parsed.partner,
    description: parsed.description,
    status: parsed.status,
    reimbursedAt: parsed.reimbursedAt,
    receiptImageId: doc.receiptImageId || null,
    receiptUrl: getReceiptImageUrl(doc.receiptImageId),
    scope: split.scope,
    coopSharePct: split.coopSharePct,
    coopSharedAmount: split.coopSharedAmount,
    personalWriteOffAmount: split.personalWriteOffAmount,
    rawNote: doc.note || '',
    createdAt: doc.$createdAt,
  };
}

export const coopExpensesApi = {
  async listExpenses(tenantId?: string, maxItems: number = 5000): Promise<CoopExpenseItem[]> {
    try {
      let allDocs: any[] = [];
      let offset = 0;
      const pageSize = Math.min(maxItems, 1000);

      while (allDocs.length < maxItems) {
        const queries = [
          Query.orderDesc('date'),
          Query.limit(Math.min(pageSize, maxItems - allDocs.length)),
        ];
        if (tenantId && tenantId !== 'all') {
          queries.push(Query.equal('tenantId', tenantId));
        }
        if (offset > 0) {
          queries.push(Query.offset(offset));
        }

        const res = await databases.listDocuments(DB_ID(), EXPENSES_COL, queries);
        if (res.documents.length === 0) break;
        allDocs.push(...res.documents);
        offset += res.documents.length;

        if (allDocs.length >= res.total || res.documents.length < pageSize) {
          break;
        }
      }

      return allDocs.map(hydrateExpenseDoc);
    } catch (err) {
      console.error('[coopExpensesApi] Failed to list expenses:', err);
      return [];
    }
  },

  async createExpense(payload: NewCoopExpensePayload): Promise<CoopExpenseItem> {
    let receiptFileId: string | null = null;

    // 1. Upload receipt image if provided
    if (payload.receiptFile && payload.receiptFile.size > 0) {
      try {
        const upload = await storage.createFile(BUCKET_ID(), ID.unique(), payload.receiptFile);
        receiptFileId = upload.$id;
      } catch (uploadErr) {
        console.warn('[coopExpensesApi] Failed to upload receipt image:', uploadErr);
      }
    }

    const inferred = inferDefaultScopeForCategory(payload.category, payload.description);
    const scope = payload.scope || inferred.scope;
    const split = computeScopeSplitAmounts(
      payload.amount,
      scope,
      payload.coopSharePct !== undefined ? payload.coopSharePct : inferred.coopSharePct
    );

    // 2. Prepare structured note JSON
    const noteJson = JSON.stringify({
      category: payload.category,
      member: payload.member.trim(),
      partner: payload.partner ? payload.partner.trim().toUpperCase() : 'HUCK',
      desc: payload.description.trim(),
      status: 'pending',
      reimbursedAt: null,
      scope: split.scope,
      coopSharePct: split.coopSharePct,
    });

    const activeTenant = payload.tenantId || '69a9cbcb0038df55f6b9';

    const doc = await databases.createDocument(DB_ID(), EXPENSES_COL, ID.unique(), {
      cartId: `COOP-EXPENSE-${Date.now()}`,
      tenantId: activeTenant,
      amount: roundCents(payload.amount),
      note: noteJson,
      receiptImageId: receiptFileId,
      date: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString(),
    });

    return hydrateExpenseDoc(doc);
  },

  async updateExpenseStatus(
    id: string,
    currentExpense: CoopExpenseItem,
    newStatus: ExpenseStatus
  ): Promise<CoopExpenseItem> {
    const isReimbursed = newStatus === 'reimbursed';
    const updatedNote = JSON.stringify({
      category: currentExpense.category,
      member: currentExpense.member,
      partner: currentExpense.partner,
      desc: currentExpense.description,
      status: newStatus,
      reimbursedAt: isReimbursed ? new Date().toISOString() : null,
      scope: currentExpense.scope || 'coop_shared',
      coopSharePct: currentExpense.coopSharePct ?? 100,
    });

    const updated = await databases.updateDocument(DB_ID(), EXPENSES_COL, id, {
      note: updatedNote,
    });

    return hydrateExpenseDoc(updated);
  },

  async updateExpenseScope(
    id: string,
    currentExpense: CoopExpenseItem,
    newScope: ExpenseAllocationScope,
    newCoopSharePct?: number
  ): Promise<CoopExpenseItem> {
    const split = computeScopeSplitAmounts(currentExpense.amount, newScope, newCoopSharePct);
    const updatedNote = JSON.stringify({
      category: currentExpense.category,
      member: currentExpense.member,
      partner: currentExpense.partner,
      desc: currentExpense.description,
      status: currentExpense.status,
      reimbursedAt: currentExpense.reimbursedAt || null,
      scope: split.scope,
      coopSharePct: split.coopSharePct,
    });

    const updated = await databases.updateDocument(DB_ID(), EXPENSES_COL, id, {
      note: updatedNote,
    });

    return hydrateExpenseDoc(updated);
  },

  async deleteExpense(id: string, receiptImageId?: string | null): Promise<void> {
    if (receiptImageId) {
      try {
        await storage.deleteFile(BUCKET_ID(), receiptImageId);
      } catch (delErr) {
        console.warn('[coopExpensesApi] Failed to delete receipt file from storage:', delErr);
      }
    }
    await databases.deleteDocument(DB_ID(), EXPENSES_COL, id);
  },

  async attachReceipt(
    id: string,
    file: File,
    existingReceiptId?: string | null
  ): Promise<{ receiptImageId: string; receiptUrl: string }> {
    if (existingReceiptId) {
      try {
        await storage.deleteFile(BUCKET_ID(), existingReceiptId);
      } catch (delErr) {
        console.warn('[coopExpensesApi] Failed to delete previous receipt file:', delErr);
      }
    }
    const upload = await storage.createFile(BUCKET_ID(), ID.unique(), file);
    await databases.updateDocument(DB_ID(), EXPENSES_COL, id, {
      receiptImageId: upload.$id,
    });
    return {
      receiptImageId: upload.$id,
      receiptUrl: getReceiptImageUrl(upload.$id)!,
    };
  },
};
