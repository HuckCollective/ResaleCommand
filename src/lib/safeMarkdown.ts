import { marked } from 'marked';

/**
 * Strips literal `\$` escapes pasted from AI/LaTeX markdown outputs so `$3,000/mo` renders cleanly.
 */
export function cleanEscapedCurrency(text: string | null | undefined): string {
  return String(text ?? '').replace(/\\\$/g, '$');
}

/**
 * Automatically upgrades single-paragraph "wall of bullets" text (e.g. `1. SECTION: • item • item 2. NEXT: • item`)
 * into structured Markdown headings and lists when the text lacks newline list formatting.
 */
export function normalizeWallOfBullets(raw: string | null | undefined): string {
  const cleaned = cleanEscapedCurrency(raw).trim();
  if (!cleaned) return '';

  const alreadyStructured = /(?:^|\n)\s*(?:#{1,6}\s|[-*+]\s|\d+\.\s.+?\n)/m.test(cleaned);
  if (alreadyStructured && !cleaned.includes(' • ')) {
    return cleaned;
  }

  let next = cleaned;
  if (next.includes('•')) {
    next = next
      // Break numbered ALL-CAPS / Title section headers onto their own ### heading line
      .replace(/(?:^|\s+)(\d+\.\s+[A-Z0-9$][A-Z0-9$/%&()+,\-–—' ]{5,90}:?)\s*(?=•|\n|$)/g, '\n\n### $1\n')
      // Convert inline bullet dots into Markdown list items
      .replace(/\s*•\s+/g, '\n- ');
  }

  return next.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Produces a clean plain-text excerpt from Markdown for compact proposal & message cards.
 */
export function stripMarkdownExcerpt(md: string | null | undefined, maxLen = 150): string {
  const plain = cleanEscapedCurrency(md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/(?:^|\n)\s*#{1,6}\s+/g, ' ')
    .replace(/[*_~>#]+/g, '')
    .replace(/\s*•\s*/g, ' • ')
    .replace(/\s+/g, ' ')
    .trim();

  if (plain.length <= maxLen) return plain;
  return `${plain.slice(0, maxLen).trimEnd()}…`;
}

/**
 * XSS-safe GitHub-Flavored Markdown renderer:
 * 1. Cleans `\$` escapes and normalizes wall-of-bullets paragraphs.
 * 2. Escapes raw HTML tags (`<` / `>`) in source text while preserving blockquote `> ` lines.
 * 3. Renders GFM via `marked` and strips unsafe `javascript:` / `vbscript:` / `data:` link schemes.
 */
export function renderSafeMarkdown(md: string | null | undefined): string {
  const normalized = normalizeWallOfBullets(md);
  if (!normalized) return '';

  // Escape raw HTML brackets while preserving Markdown blockquotes at line starts (`> quote`)
  const escaped = normalized
    .split('\n')
    .map((line) => {
      const quoteMatch = line.match(/^(\s*>+\s?)(.*)$/);
      if (quoteMatch) {
        const prefix = quoteMatch[1];
        const rest = quoteMatch[2].replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `${prefix}${rest}`;
      }
      return line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    })
    .join('\n');

  const rawHtml = marked.parse(escaped, {
    gfm: true,
    breaks: true,
    async: false,
  }) as string;

  return rawHtml
    .replace(/href="\s*(?:javascript|vbscript|data):[^"]*"/gi, 'href="#"')
    .replace(/<a\s+href="(https?:\/\/[^"]+)"/gi, '<a href="$1" target="_blank" rel="noopener noreferrer"');
}
