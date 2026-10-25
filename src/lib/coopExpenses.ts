import { databases, storage, ID, Query } from './appwrite';
import { getDatabaseId, getBucketId } from './appwriteEnv';

export type ExpenseCategory = 
  | 'Booth Rent & Mall Fees'
  | 'Thermal Tags & Merch Supplies'
  | 'Display Hardware & Fixtures'
  | 'Tech Commons & AI Credits'
  | 'Hauling & Sourcing Transport'
  | 'Cleaning & Facility Maintenance'
  | 'General Operational Commons';

export type ExpenseStatus = 'pending' | 'approved' | 'reimbursed' | 'rejected';

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
  receiptFile?: File | null;
  tenantId?: string;
}

const DB_ID = () => getDatabaseId();
const BUCKET_ID = () => getBucketId();
const EXPENSES_COL = 'expenses';

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
} {
  const fallback = {
    category: 'General Operational Commons' as ExpenseCategory,
    member: 'Huckleberry Collective',
    partner: 'HUCK',
    description: noteStr || 'Operational Expense',
    status: 'reimbursed' as ExpenseStatus,
    reimbursedAt: null
  };

  if (!noteStr) return fallback;

  // 1. Try parsing JSON format
  if (noteStr.trim().startsWith('{') && noteStr.trim().endsWith('}')) {
    try {
      const parsed = JSON.parse(noteStr);
      return {
        category: (parsed.category as ExpenseCategory) || fallback.category,
        member: parsed.member || fallback.member,
        partner: parsed.partner || fallback.partner,
        description: parsed.desc || parsed.description || fallback.description,
        status: (parsed.status as ExpenseStatus) || 'approved',
        reimbursedAt: parsed.reimbursedAt || null
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

    return {
      category: cat,
      member: 'Core Member',
      partner: 'HUCK',
      description: tagMatch[2] || noteStr,
      status: 'approved',
      reimbursedAt: null
    };
  }

  // 3. Fallback for legacy notes (e.g. "gas", "Paper Bag", "Google Gemini AI API Cloud Billing")
  const lower = noteStr.toLowerCase();
  let cat: ExpenseCategory = 'General Operational Commons';
  if (lower.includes('gemini') || lower.includes('ai') || lower.includes('google')) cat = 'Tech Commons & AI Credits';
  else if (lower.includes('gas') || lower.includes('mileage')) cat = 'Hauling & Sourcing Transport';
  else if (lower.includes('bag') || lower.includes('box') || lower.includes('label')) cat = 'Thermal Tags & Merch Supplies';
  else if (lower.includes('rent') || lower.includes('memory den')) cat = 'Booth Rent & Mall Fees';

  return {
    ...fallback,
    category: cat,
    description: noteStr
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
          Query.limit(Math.min(pageSize, maxItems - allDocs.length))
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

      return allDocs.map(doc => {
        const parsed = parseExpenseNote(doc.note);
        return {
          id: doc.$id,
          cartId: doc.cartId || '',
          tenantId: doc.tenantId || '',
          amount: Number(doc.amount || 0),
          date: doc.date || doc.$createdAt,
          category: parsed.category,
          member: parsed.member,
          partner: parsed.partner,
          description: parsed.description,
          status: parsed.status,
          reimbursedAt: parsed.reimbursedAt,
          receiptImageId: doc.receiptImageId || null,
          receiptUrl: getReceiptImageUrl(doc.receiptImageId),
          rawNote: doc.note || '',
          createdAt: doc.$createdAt
        };
      });
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

    // 2. Prepare structured note JSON
    const noteJson = JSON.stringify({
      category: payload.category,
      member: payload.member.trim(),
      partner: payload.partner ? payload.partner.trim().toUpperCase() : 'HUCK',
      desc: payload.description.trim(),
      status: 'pending',
      reimbursedAt: null
    });

    const activeTenant = payload.tenantId || '69a9cbcb0038df55f6b9';

    const doc = await databases.createDocument(
      DB_ID(),
      EXPENSES_COL,
      ID.unique(),
      {
        cartId: `COOP-EXPENSE-${Date.now()}`,
        tenantId: activeTenant,
        amount: Math.round(Number(payload.amount) * 100) / 100,
        note: noteJson,
        receiptImageId: receiptFileId,
        date: payload.date ? new Date(payload.date).toISOString() : new Date().toISOString()
      }
    );

    const parsed = parseExpenseNote(doc.note);
    return {
      id: doc.$id,
      cartId: doc.cartId || '',
      tenantId: doc.tenantId || '',
      amount: Number(doc.amount || 0),
      date: doc.date,
      category: parsed.category,
      member: parsed.member,
      partner: parsed.partner,
      description: parsed.description,
      status: parsed.status,
      reimbursedAt: parsed.reimbursedAt,
      receiptImageId: doc.receiptImageId || null,
      receiptUrl: getReceiptImageUrl(doc.receiptImageId),
      rawNote: doc.note,
      createdAt: doc.$createdAt
    };
  },

  async updateExpenseStatus(id: string, currentExpense: CoopExpenseItem, newStatus: ExpenseStatus): Promise<CoopExpenseItem> {
    const isReimbursed = newStatus === 'reimbursed';
    const updatedNote = JSON.stringify({
      category: currentExpense.category,
      member: currentExpense.member,
      partner: currentExpense.partner,
      desc: currentExpense.description,
      status: newStatus,
      reimbursedAt: isReimbursed ? new Date().toISOString() : null
    });

    const updated = await databases.updateDocument(
      DB_ID(),
      EXPENSES_COL,
      id,
      {
        note: updatedNote
      }
    );

    const parsed = parseExpenseNote(updated.note);
    return {
      ...currentExpense,
      status: parsed.status,
      reimbursedAt: parsed.reimbursedAt,
      rawNote: updated.note
    };
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

  async attachReceipt(id: string, file: File, existingReceiptId?: string | null): Promise<{ receiptImageId: string; receiptUrl: string }> {
    if (existingReceiptId) {
      try {
        await storage.deleteFile(BUCKET_ID(), existingReceiptId);
      } catch (delErr) {
        console.warn('[coopExpensesApi] Failed to delete previous receipt file:', delErr);
      }
    }
    const upload = await storage.createFile(BUCKET_ID(), ID.unique(), file);
    await databases.updateDocument(DB_ID(), EXPENSES_COL, id, {
      receiptImageId: upload.$id
    });
    return {
      receiptImageId: upload.$id,
      receiptUrl: getReceiptImageUrl(upload.$id)!
    };
  }
};
