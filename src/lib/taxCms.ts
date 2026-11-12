import { getCollection, getEntry } from 'astro:content';
import { marked } from 'marked';
import type { MemberHat } from './memberHats';

/**
 * Pure server-side Markdown renderers for `src/content/tax/rules.md` and `src/content/roles/*.md`.
 * Deliberately imports zero Appwrite or database modules so both `/dashboard`
 * and the public `/demo` page render Schedule C Tax Rules + Role Help at SSR time
 * with zero client JS bloat and full Check 14D isolation.
 */
export async function loadTaxPlaybookHtml(): Promise<string> {
  const entry = await getEntry('tax', 'rules');
  if (!entry?.body) return '';
  return await marked.parse(entry.body);
}

export type RoleHelpHtmlMap = Partial<Record<MemberHat, string>>;

export async function loadRoleHelpHtmlMap(): Promise<RoleHelpHtmlMap> {
  const entries = await getCollection('roleHelp');
  const out: RoleHelpHtmlMap = {};
  await Promise.all(
    entries.map(async (entry) => {
      if (entry.body) {
        out[entry.data.hatId] = await marked.parse(entry.body);
      }
    })
  );
  return out;
}

