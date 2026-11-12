import { getEntry } from 'astro:content';
import { marked } from 'marked';

/**
 * Pure server-side Markdown renderer for `src/content/tax/rules.md`.
 * Deliberately imports zero Appwrite or database modules so both `/dashboard`
 * and the public `/demo` page can render the Schedule C Tax Playbook at SSR time
 * with zero client JS bloat and full Check 14D isolation.
 */
export async function loadTaxPlaybookHtml(): Promise<string> {
  const entry = await getEntry('tax', 'rules');
  if (!entry?.body) return '';
  return await marked.parse(entry.body);
}
