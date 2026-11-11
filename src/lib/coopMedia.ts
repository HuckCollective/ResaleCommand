import { Permission, Role } from 'appwrite';
import { storage, ID } from './appwrite';
import { getAssetUrl } from './inventory';
import { cleanEscapedCurrency } from './safeMarkdown';

export const COOP_MEDIA_BUCKET_ID = 'coop_media';

export function getCoopMediaUrl(
  fileIdOrUrl: string | null | undefined,
  options?: { preview?: boolean; width?: number; height?: number; quality?: number }
): string {
  return getAssetUrl(fileIdOrUrl, {
    ...options,
    bucket: COOP_MEDIA_BUCKET_ID,
  });
}

function sanitizeFileSlug(input: string, fallback = 'attachment'): string {
  const clean = String(input || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return clean || fallback;
}

/**
 * Uploads one or more File screenshots/photos to the dedicated `coop_media` Appwrite Storage bucket.
 * Requires an authenticated member session (`Role.users()`).
 */
export async function uploadCoopMediaFiles(
  files: (File | Blob | any)[],
  prefix = 'coop'
): Promise<string[]> {
  const uploadedIds: string[] = [];
  if (!Array.isArray(files) || files.length === 0) return uploadedIds;

  for (let i = 0; i < files.length; i++) {
    const raw = files[i]?.file instanceof File ? files[i].file : files[i];
    if (!(raw instanceof Blob)) continue;

    const extFromType =
      raw.type === 'image/png'
        ? 'png'
        : raw.type === 'image/webp'
          ? 'webp'
          : raw.type === 'image/gif'
            ? 'gif'
            : 'jpg';

    const originalName = raw instanceof File && raw.name ? raw.name : `${prefix}-${Date.now()}-${i + 1}.${extFromType}`;
    const safeName = `${sanitizeFileSlug(prefix)}-${Date.now()}-${sanitizeFileSlug(originalName)}`;
    const uploadFile =
      raw instanceof File
        ? new File([raw], safeName, { type: raw.type || 'image/jpeg' })
        : new File([raw], safeName, { type: raw.type || 'image/jpeg' });

    const created = await storage.createFile(COOP_MEDIA_BUCKET_ID, ID.unique(), uploadFile, [
      Permission.read(Role.any()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ]);

    if (created?.$id) {
      uploadedIds.push(created.$id);
    }
  }

  return uploadedIds;
}

/**
 * Archives a clean `.md` Markdown file with YAML frontmatter into `coop_media` for audit portability.
 * Best-effort: returns the created file `$id` or `undefined` if offline/unauthenticated.
 */
export async function syncProposalMarkdownSnapshot(proposal: {
  id: string;
  title: string;
  proposer: string;
  proposerPartner: string;
  category: string;
  status: string;
  deadline: string;
  financialImpact?: string;
  description: string;
  rationale: string;
  createdAt: string;
}): Promise<string | undefined> {
  if (typeof File === 'undefined') return undefined;

  try {
    const mdContent = [
      '---',
      `id: "${proposal.id}"`,
      `title: "${cleanEscapedCurrency(proposal.title).replace(/"/g, '\\"')}"`,
      `proposer: "${proposal.proposer}"`,
      `partner: "${proposal.proposerPartner}"`,
      `category: "${proposal.category}"`,
      `status: "${proposal.status}"`,
      `deadline: "${proposal.deadline}"`,
      `financialImpact: "${cleanEscapedCurrency(proposal.financialImpact || '').replace(/"/g, '\\"')}"`,
      `createdAt: "${proposal.createdAt}"`,
      `exportedAt: "${new Date().toISOString()}"`,
      '---',
      '',
      `# ${cleanEscapedCurrency(proposal.title)}`,
      '',
      proposal.financialImpact ? `> **Financial / Policy Impact:** ${cleanEscapedCurrency(proposal.financialImpact)}\n` : '',
      '## Proposal Specification',
      '',
      cleanEscapedCurrency(proposal.description),
      '',
      proposal.rationale ? `## WSDE Surplus & Co-op Rationale\n\n${cleanEscapedCurrency(proposal.rationale)}\n` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const slug = sanitizeFileSlug(proposal.id, 'proposal');
    const mdFile = new File([mdContent], `${slug}.md`, { type: 'text/markdown' });
    const created = await storage.createFile(COOP_MEDIA_BUCKET_ID, ID.unique(), mdFile, [
      Permission.read(Role.any()),
      Permission.update(Role.users()),
      Permission.delete(Role.users()),
    ]);
    return created?.$id;
  } catch {
    return undefined;
  }
}
