import { databases } from './appwrite';
import { Permission, Role } from 'appwrite';
import { getDatabaseId } from './appwriteEnv';

export type VaultNoteKind = 'idea' | 'prompt' | 'spec';

export interface VaultNote {
  id: string;
  kind: VaultNoteKind;
  title: string;
  body: string;
  done?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const FOUNDER_VAULT_DOC_ID = 'founder_vault_notes_v1';
const MANIFESTS_COL_ID = 'manifests';
const LOCAL_KEY = 'rc_founder_vault_v1';

export const VAULT_KIND_META: Record<VaultNoteKind, { icon: string; label: string }> = {
  idea: { icon: '💡', label: 'Idea' },
  prompt: { icon: '📋', label: 'Prompt' },
  spec: { icon: '📌', label: 'Spec' },
};

export const STARTER_VAULT_NOTES: VaultNote[] = [
  {
    id: 'starter-preview-trial',
    kind: 'prompt',
    title: 'Gemini Starter: Preview Member & Trial User Design',
    body: [
      'You are the Principal Product Architect, Cooperative Economist (WSDE / Mondragon), and UX/IA Co-Pilot for The Huckleberry Collective (thehc.llc) & Resale Command (resalecmd.com).',
      '',
      'GOAL: Architect a 2-stage onboarding experience.',
      '1. Preview Member: prospective partners explore the real dashboard, 70/30 waterfall and consignor simulators, labor pool and booth inventory read-only, switching between the 5 Member Hats (Founder, Curator, Promoter, Surplus Enabler, Consignor) with zero risk to production data. Clear "Apply to Join" CTA.',
      '2. Trial User: hands-on test-drive of Quick Scout / Deep Scan (capped free credits), Lot Splitter and label preview in an isolated DEMO- sandbox that never touches HUCK-/PDXGL-/BB- inventory, Ricochet sync or the co-op ledger.',
      'Define the upgrade path Guest > Preview Member > Trial User > Verified Co-op Member.',
      '',
      'RESPOND WITH: (1) permissions matrix + data isolation + AI quota protection, (2) top 3 UI components to build first, (3) 3 focused product questions. Keep it phone-friendly and end with a cumulative "SAVED MASTER SPEC & IDE QUEUE" block.',
    ].join('\n'),
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
  {
    id: 'starter-mobile-addon',
    kind: 'prompt',
    title: 'Gemini Mobile Add-On (paste at bottom of chat)',
    body: [
      'I am brainstorming from my phone and will execute IDE prompts later on my PC in Antigravity IDE.',
      'Keep responses phone-screen friendly (short punchy bullets).',
      'Whenever we lock a decision, maintain a cumulative "SAVED MASTER SPEC & IDE QUEUE" block at the bottom of your reply.',
    ].join('\n'),
    createdAt: '2026-11-07T00:00:00.000Z',
    updatedAt: '2026-11-07T00:00:00.000Z',
  },
];

export function newVaultNoteId(): string {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

function readLocal(): VaultNote[] {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocal(notes: VaultNote[]): void {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(notes));
  } catch (err) {
    console.warn('[founderVault] localStorage mirror warning:', err);
  }
}

export async function loadVaultNotes(): Promise<{ notes: VaultNote[]; synced: boolean }> {
  const local = readLocal();
  try {
    const doc: any = await databases.getDocument(getDatabaseId(), MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID);
    const parsed = JSON.parse(doc.itemsSnapshot || '{}');
    const notes: VaultNote[] = Array.isArray(parsed.notes) ? parsed.notes : local;
    writeLocal(notes);
    return { notes, synced: true };
  } catch (err: any) {
    if (err?.code === 404) {
      const seeded = local.length ? local : STARTER_VAULT_NOTES;
      const ok = await saveVaultNotes(seeded);
      return { notes: seeded, synced: ok };
    }
    return { notes: local.length ? local : STARTER_VAULT_NOTES, synced: false };
  }
}

export async function saveVaultNotes(notes: VaultNote[]): Promise<boolean> {
  writeLocal(notes);
  const dbId = getDatabaseId();
  const payload = {
    name: 'Founder Idea & Prompt Vault',
    tenantId: 'huck_collective',
    locationId: 'FOUNDER_VAULT',
    locationName: 'Founder Vault',
    status: 'vault_state',
    itemsSnapshot: JSON.stringify({ notes, updatedAt: new Date().toISOString() }),
    itemCount: notes.length,
    notes: JSON.stringify({ noteCount: notes.length }),
  };
  try {
    try {
      await databases.updateDocument(dbId, MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID, payload);
    } catch (updateErr: any) {
      if (updateErr?.code !== 404) throw updateErr;
      await databases.createDocument(dbId, MANIFESTS_COL_ID, FOUNDER_VAULT_DOC_ID, payload, [
        Permission.read(Role.any()),
        Permission.update(Role.any()),
        Permission.delete(Role.any()),
      ]);
    }
    return true;
  } catch (err) {
    console.warn('[founderVault] Appwrite sync fallback to localStorage:', err);
    return false;
  }
}

