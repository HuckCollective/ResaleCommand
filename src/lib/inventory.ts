import { databases, storage, ID, Query } from './appwrite';
import type { Models } from 'appwrite';
import { Permission, Role } from 'appwrite';

import { isAlphaMode } from '../stores/env';

const DB_ID = import.meta.env.PUBLIC_APPWRITE_DB_ID || 'resale_db'; 
export const getCollectionId = () => isAlphaMode.get() 
    ? (import.meta.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'alpha_items') 
    : (import.meta.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items');
const BUCKET_ID = import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images';

export interface ExtraItemData {
    cost?: string;
    sourcingLocation?: string;
    maxBuyPrice?: string;
    storageLocation?: string;
    orderId?: string;
    cartId?: string;
    title?: string;
    status?: 'scouted' | 'received' | 'placed' | 'sold';
    receiptFile?: File | null;
    imageFile?: File | null;
    galleryFiles?: File[];
    existingGalleryIds?: string[];
    resalePrice?: string;
    scoutData?: any;
    description?: string;
    marketDescription?: string;
    itemCondition?: string;
    imageId?: string; // Pre-uploaded image ID
    estLow?: string;
    estHigh?: string;
    boutiquePrice?: string | number;
    keywords?: string[];
    sellingLocations?: string[];
    components?: string;
    quantity?: number;
    parentLotId?: string;
    rawAnalysis?: string;
}

export function getSafeRawAnalysis(item: any): string | null {
    if (!item) return null;
    try {
        let str = JSON.stringify(item);
        if (str.length <= 4900) return str;
        
        // If it's too long, copy and prune comparables
        const pruned = { ...item };
        if (pruned.comparables && pruned.comparables.length > 3) {
            pruned.comparables = pruned.comparables.slice(0, 3);
        }
        str = JSON.stringify(pruned);
        if (str.length <= 4900) return str;

        // Prune lot_items if still too long
        if (pruned.lot_items && pruned.lot_items.length > 5) {
            pruned.lot_items = pruned.lot_items.slice(0, 5);
        }
        str = JSON.stringify(pruned);
        if (str.length <= 4900) return str;

        // Absolute fallback: keep only main fields
        return JSON.stringify({
            identity: item.identity,
            title: item.title,
            price_breakdown: item.price_breakdown,
            shipping_info: item.shipping_info,
            purchase_strategy: item.purchase_strategy,
            condition_notes: item.condition_notes,
            keywords: item.keywords
        });
    } catch (e) {
        return null;
    }
}

export async function saveItemToInventory(itemData: any, imageFile: File | null, extraData: ExtraItemData = {}, teamId?: string, ownerType: 'team' | 'user' = 'team') {
    if (!import.meta.env.PUBLIC_APPWRITE_DB_ID) {
        throw new Error("Missing PUBLIC_APPWRITE_DB_ID in .env");
    }

    console.log(`[Inventory] Save called. Bucket=${BUCKET_ID}, DB=${DB_ID}, Collection=${getCollectionId()}`);
    if (imageFile) console.log(`[Inventory] Has Image File: ${imageFile.name} (${imageFile.size})`);
    else console.log(`[Inventory] NO Image File passed.`);

    try {
        let imageId: string | null = extraData.imageId || null;

        // 1. Upload Image (FORCED ATTEMPT) - Only if not already provided
        if (!imageId && imageFile) {
            console.log(`[Inventory] FORCING Upload of: ${imageFile.name} (${imageFile.type}, ${imageFile.size} bytes)`);
            try {
                // Ensure ID.unique() is called fresh
                const upload = await storage.createFile(
                    BUCKET_ID || 'item_images', // Fallback
                    ID.unique(),
                    imageFile
                );
                imageId = upload.$id;
                console.log(`[Inventory] Image Upload Success: ${imageId}`);
            } catch (e: any) {
                console.error("Image upload failed (FORCED):", e);
                // Throw it so UI sees it
                throw new Error(`Image Upload Failed: ${e.message}`);
            }
        } else if (!imageId) {
            console.log(`[Inventory] Skipping Image Upload - no file or existing imageId provided.`);
        }
        let receiptImageId: string | null = null;
        if (extraData.receiptFile && extraData.receiptFile.size > 0 && BUCKET_ID) {
             try {
                const upload = await storage.createFile(
                     BUCKET_ID,
                     ID.unique(),
                     extraData.receiptFile
                );
                receiptImageId = upload.$id;
            } catch (e) {
                console.warn("Receipt upload failed:", e);
            }
        }

        // 1.5 Upload Gallery Images
        let galleryIds: string[] = [];
        if (extraData.existingGalleryIds) {
            galleryIds = [...extraData.existingGalleryIds];
        } else if ((extraData as any).galleryImageIds) {
            galleryIds = [...(extraData as any).galleryImageIds];
        }
        
        if (extraData.galleryFiles && extraData.galleryFiles.length > 0 && BUCKET_ID) {
            try {
                const uploads = await Promise.all(extraData.galleryFiles.map(file => 
                    storage.createFile(BUCKET_ID, ID.unique(), file)
                ));
                galleryIds = uploads.map(u => u.$id);
            } catch (e) {
                console.warn("Gallery upload failed:", e);
            }
        }
        
        let safeNotes = itemData.condition_notes || '';
        
        // Append extra analytics/data to notes since DB columns might be missing
        const extraInfo: string[] = [];
        if (extraData.cost) extraInfo.push(`Paid: $${extraData.cost}`);
        if (extraData.resalePrice) extraInfo.push(`Resale: $${extraData.resalePrice}`);
        if (extraData.maxBuyPrice) extraInfo.push(`Max Buy: $${extraData.maxBuyPrice}`);
        if (extraData.sourcingLocation) extraInfo.push(`Location: ${extraData.sourcingLocation}`);
        if (extraData.storageLocation) extraInfo.push(`Bin: ${extraData.storageLocation}`);
        if (extraData.orderId) extraInfo.push(`Order #: ${extraData.orderId}`);
        if (imageId) extraInfo.push(`[MAIN IMAGE ID: ${imageId}]`);
        if (galleryIds.length > 0) extraInfo.push(`[GALLERY IDS: ${galleryIds.join(', ')}]`);
        if (galleryIds.length > 0) extraInfo.push(`[GALLERY IDS: ${galleryIds.join(', ')}]`);
        if (receiptImageId) extraInfo.push(`[RECEIPT ID: ${receiptImageId}]`);
        // Save Estimates
        if (extraData.estLow) extraInfo.push(`Est. Low: $${extraData.estLow}`);
        if (extraData.estHigh) extraInfo.push(`Est. High: $${extraData.estHigh}`);
        if (extraData.boutiquePrice) extraInfo.push(`Boutique: $${extraData.boutiquePrice}`);

        if (extraData.scoutData) {
            try {
                // Generate Markdown Structure
                const items = Array.isArray(extraData.scoutData) ? extraData.scoutData : (extraData.scoutData.items || [extraData.scoutData]);
                let md = `# Scout Report - ${new Date().toLocaleDateString()}\n\n`;
                items.forEach((item: any, index: number) => {
                    md += `## ${index + 1}. ${item.title || item.identity || 'Item'}\n\n`;
                    if (item.condition_notes) md += `**Condition:** ${item.condition_notes}\n\n`;
                    if (item.red_flags?.length) md += `**🚩 Red Flags:** ${item.red_flags.join(', ')}\n\n`;
                    if (item.price_breakdown) {
                        md += `### Valuation\n`;
                        md += `- **Mint:** ${item.price_breakdown.mint || 'N/A'}\n`;
                        md += `- **Fair:** ${item.price_breakdown.fair || 'N/A'}\n`;
                        md += `- **Poor:** ${item.price_breakdown.poor || 'N/A'}\n\n`;
                    }
                    if (item.comparables?.length) {
                        md += `### Comparables\n`;
                        item.comparables.forEach((c: any) => { md += `- ${c.name}: ${c.price}\n`; });
                        md += '\n';
                    }
                });

                const jsonStr = JSON.stringify(extraData.scoutData);
                let fileId: string | null = null;
                let mdFileId: string | null = null;
                
                // Save MD File
                try {
                    const dateStr = new Date().toISOString().split('T')[0];
                    const mdFile = new File([md], `scout_${dateStr}.md`, { type: 'text/markdown' });
                    const mdUpload = await storage.createFile('reports', ID.unique(), mdFile);
                    mdFileId = mdUpload.$id;
                } catch(e) { console.warn("MD upload failed", e); }
                
                // Strategy 1: Try .json
                try {
                    const file = new File([jsonStr], 'scout.json', { type: 'application/json' });
                    const upload = await storage.createFile('reports', ID.unique(), file);
                    fileId = upload.$id;
                } catch(err1: any) {
                    
                    // SELF-REPAIR & RETRY
                    if (err1.code === 400 || err1.message?.includes('extension')) {
                        console.warn("Bucket missing .json support (CREATE), attempting auto-fix...");
                        try {
                            await fetch('/api/dev/fix-bucket');
                            
                            // Retry JSON
                            const file = new File([jsonStr], 'scout.json', { type: 'application/json' });
                            const upload = await storage.createFile('reports', ID.unique(), file);
                            fileId = upload.$id;
                        } catch (retryErr) {
                             // Fallback to TXT
                             try {
                                const file = new File([jsonStr], 'scout.txt', { type: 'text/plain' });
                                const upload = await storage.createFile('reports', ID.unique(), file);
                                fileId = upload.$id;
                             } catch(e3) {
                                 throw retryErr; 
                             }
                        }
                    } else {
                        // Fallback to TXT
                        try {
                            const file = new File([jsonStr], 'scout.txt', { type: 'text/plain' });
                            const upload = await storage.createFile('reports', ID.unique(), file);
                            fileId = upload.$id;
                        } catch (e4) {
                            throw err1;
                        }
                    }
                }

                if (fileId) extraInfo.push(`[SCOUT_REPORT_ID: ${fileId}]`);
                if (mdFileId) extraInfo.push(`[SCOUT_REPORT_MD: ${mdFileId}]`);
                
                if (!fileId && !mdFileId) {
                     throw new Error("File upload failed to return ID");
                }
            } catch (e) {
                console.warn("Failed to upload Scout Data file, using Lite Fallback", e);
                // Strategy 3: Lite Data (Base64)
                const lite = { 
                    ...extraData.scoutData, 
                    comparables: [], 
                    keywords: [],
                    red_flags: extraData.scoutData.red_flags || [],
                    price_breakdown: extraData.scoutData.price_breakdown
                };
                delete lite.description;
                delete lite.condition_notes;
                
                try {
                    const jsonLite = JSON.stringify(lite);
                    const b64 = typeof btoa === 'function' ? btoa(jsonLite) : Buffer.from(jsonLite).toString('base64');
                    extraInfo.push(`[SCOUT_DATA_LITE: ${b64}]`);
                } catch(e2) {
                    console.warn("Lite save failed", e2);
                }
            }
        }
        
        if (extraInfo.length > 0) {
            safeNotes += '\n\n--- IMPORT DETAILS ---\n' + extraInfo.join('\n');
        }

        // TRUNCATE NOTES to avoid 1000 char limit error
        // Reduced to 800 to account for multi-byte emojis causing byte-length overflow
        if (safeNotes.length > 800) {
            console.warn("Notes too long (" + safeNotes.length + "), truncating to 800.");
            safeNotes = safeNotes.substring(0, 800);
        }

        const scoutObj = extraData.scoutData || (itemData && (itemData.price_breakdown || itemData.comparables) ? itemData : null);
        const doc: any = {
            title: itemData.title,
            identity: typeof itemData.identity === 'object' ? JSON.stringify(itemData.identity) : itemData.identity,
            conditionNotes: safeNotes,
            status: extraData.status || 'acquired',
            tenantId: teamId || null,
            imageId: imageId || undefined,
            galleryImageIds: galleryIds.length > 0 ? galleryIds : undefined,
            receiptImageId: receiptImageId || undefined,
            cost: extraData.cost !== undefined ? parseFloat(extraData.cost.toString()) || 0 : undefined,
            resalePrice: extraData.resalePrice !== undefined ? parseFloat(extraData.resalePrice.toString()) || 0 : undefined,
            soldPrice: extraData.soldPrice !== undefined && extraData.soldPrice !== '' ? parseFloat(extraData.soldPrice.toString()) || 0 : undefined,
            maxBuyPrice: extraData.maxBuyPrice !== undefined ? parseFloat(extraData.maxBuyPrice.toString()) || 0 : undefined,
            sourcingLocation: extraData.sourcingLocation || undefined,
            storageLocation: extraData.storageLocation || undefined,
            cartId: extraData.cartId || undefined,
            marketDescription: extraData.marketDescription || undefined,
            keywords: Array.isArray(extraData.keywords) ? extraData.keywords : (extraData.scoutData && Array.isArray(extraData.scoutData.keywords) ? extraData.scoutData.keywords : undefined),
            components: extraData.components || undefined,
            quantity: extraData.quantity || 1,
            parentLotId: extraData.parentLotId || undefined,
            rawAnalysis: extraData.rawAnalysis !== undefined 
                ? (extraData.rawAnalysis === '' ? null : extraData.rawAnalysis)
                : (scoutObj ? getSafeRawAnalysis(scoutObj) : undefined)
        };

        // Remove undefined keys to satisfy Appwrite's strict document validation
        Object.keys(doc).forEach(key => doc[key] === undefined && delete doc[key]);


        let permissions: string[] = [];
        if (teamId) {
            const role = ownerType === 'team' ? Role.team(teamId) : Role.user(teamId);
            permissions = [
                Permission.read(role),
                Permission.update(role),
                Permission.delete(role),
            ];
        }

        // 3. Create Document
        const response = await databases.createDocument(
            DB_ID,
            getCollectionId(),
            ID.unique(),
            doc,
            permissions
        );

// ... existing code ...
        return response;
    } catch (error) {
        console.error("Appwrite Save Error:", error);
        throw error;
    }
}

export async function getInventoryItems(teamId?: string) {
    try {
        const response = await databases.listDocuments(
            DB_ID,
            getCollectionId(),
            [
                Query.orderDesc('$createdAt'),
                Query.limit(100),
                ...(teamId ? [Query.equal('tenantId', teamId)] : [])
            ]
        );
        return response.documents; 
    } catch (error) {
        console.error("Error fetching inventory:", error);
        return [];
    }
}

export async function deleteInventoryItem(documentId: string) {
    try {
        // 1. Fetch the item to find associated images
        const item = await databases.getDocument(DB_ID, getCollectionId(), documentId);
        
        const imagesToDelete = new Set<string>();

        // A. Check Standard Fields
        if (item.imageId) imagesToDelete.add(item.imageId);
        if (item.receiptImageId) imagesToDelete.add(item.receiptImageId);
        if (item.galleryImageIds && Array.isArray(item.galleryImageIds)) {
            item.galleryImageIds.forEach((id: string) => imagesToDelete.add(id));
        }

        // B. Check Notes for "Safe Mode" IDs
        if (item.conditionNotes) {
            // Main Image
            const mainMatch = item.conditionNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/i);
            if (mainMatch) imagesToDelete.add(mainMatch[1].trim());

            // Gallery
            const galleryMatch = item.conditionNotes.match(/\[GALLERY IDS: ([^\]]+)\]/i);
            if (galleryMatch) {
                galleryMatch[1].split(',').forEach((s: string) => {
                    const id = s.trim();
                    if (id) imagesToDelete.add(id);
                });
            }

            // Receipt
            const receiptMatch = item.conditionNotes.match(/\[RECEIPT ID: ([^\]]+)\]/i);
            if (receiptMatch) imagesToDelete.add(receiptMatch[1].trim());

            // Scout Report
            const scoutMatch = item.conditionNotes.match(/\[SCOUT_REPORT_ID: ([^\]]+)\]/i);
            if (scoutMatch) imagesToDelete.add(scoutMatch[1].trim());
        }

        // 2. Delete Identified Images (Only in production, not in Alpha/Dev sandbox to prevent breaking shared images)
        if (imagesToDelete.size > 0 && BUCKET_ID && !isAlphaMode.get()) {
            console.log(`Deleting ${imagesToDelete.size} images for item ${documentId}...`);
            await Promise.allSettled(Array.from(imagesToDelete).map(id => 
                storage.deleteFile(BUCKET_ID, id).catch(e => console.warn(`Failed to delete image ${id}:`, e))
            ));
        }

        // 3. Delete Document
        await databases.deleteDocument(
            DB_ID, 
            getCollectionId(), 
            documentId
        );
        return true;
    } catch (error) {
        console.error("Error deleting item:", error);
        throw error;
    }
}

export async function updateInventoryItem(documentId: string, updates: Partial<ExtraItemData>) {
    try {
        // 1. Fetch current document to safely update notes
        const currentDoc = await databases.getDocument(DB_ID, getCollectionId(), documentId);
        let notes = currentDoc.conditionNotes || '';

        // Helper to update or append values in notes
        const updateNoteValue = (key: string, value: string) => {
            // Escape key for regex usage (e.g. "Est. Low" -> "Est\. Low")
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            // Use [ \t]* to prevent matching \n and eating the next line
            const regex = new RegExp(`^${escapedKey}:[ \\t]*(.*)$`, 'mi');
            
            if (regex.test(notes)) {
                notes = notes.replace(regex, () => `${key}: ${value}`);
            } else {
                notes = notes + `\n${key}: ${value}`;
            }
        };

        // Helper for bracket tags [TAG: Value]
        const updateTagValue = (tag: string, value: string) => {
            const regex = new RegExp(`\\[${tag}:[ \\t]*([^\\]]+)\\]`, 'i');
            if (regex.test(notes)) {
                notes = notes.replace(regex, () => `[${tag}: ${value}]`);
            } else {
                notes = notes + `\n\n[${tag}: ${value}]`;
            }
        };

        const data: any = {};
        
        // Handle Status (This exists in schema)
        if (updates.status) data.status = updates.status;
        if (updates.title) data.title = updates.title;
        if (updates.description) data.marketDescription = updates.description;
        if (updates.components !== undefined) data.components = updates.components;
        if (updates.quantity !== undefined) data.quantity = updates.quantity;
        if (updates.parentLotId !== undefined) data.parentLotId = updates.parentLotId;

        // --- Handle File Uploads & Update Notes ---

        // Receipt
        if (updates.receiptFile && BUCKET_ID) {
             const upload = await storage.createFile(BUCKET_ID, ID.unique(), updates.receiptFile);
             updateTagValue('RECEIPT ID', upload.$id);
        }

        // Main Image
        let newMainUploadId: string | null = null;
        if (updates.imageFile && BUCKET_ID) {
             const upload = await storage.createFile(BUCKET_ID, ID.unique(), updates.imageFile);
             data.imageId = upload.$id;
             newMainUploadId = upload.$id;
             updateTagValue('MAIN IMAGE ID', upload.$id);
        } else if (updates.imageId !== undefined) {
             data.imageId = updates.imageId;
             if (updates.imageId) {
                 updateTagValue('MAIN IMAGE ID', updates.imageId);
             } else {
                 notes = notes.replace(/\[MAIN IMAGE ID: [^\]]+\]\n?\n?/gi, '');
             }
        }

        // Determine existing IDs to keep
        let currentGalleryIds: string[] = [];
        
        if (updates.existingGalleryIds !== undefined) {
            // Frontend is explicitly telling us what gallery IDs to KEEP
            currentGalleryIds = [...updates.existingGalleryIds];
        } else {
            // Fallback for partial updates
            const galleryMatch = notes.match(/\[GALLERY IDS: ([^\]]+)\]/i);
            if (galleryMatch) {
                currentGalleryIds = galleryMatch[1].split(',').map((s: string) => s.trim()).filter((s: string) => s);
            } else if (currentDoc.galleryImageIds) {
                currentGalleryIds = [...currentDoc.galleryImageIds];
            }
        }

        // Upload new gallery files
        if (updates.galleryFiles && updates.galleryFiles.length > 0 && BUCKET_ID) {
            const uploads = await Promise.all(updates.galleryFiles.map(file => 
                storage.createFile(BUCKET_ID, ID.unique(), file)
            ));
            const newIds = uploads.map(u => u.$id);
            currentGalleryIds = [...currentGalleryIds, ...newIds];
        }

        // Clean up deleted images from storage
        const imagesToDelete = new Set<string>();
        
        // Check if main image was replaced/removed
        if (currentDoc.imageId && updates.imageId !== undefined && currentDoc.imageId !== updates.imageId && currentDoc.imageId !== newMainUploadId) {
            imagesToDelete.add(currentDoc.imageId);
        }
        
        // Safely check old notes so we don't accidentally match the newly inserted tag
        const oldNotes = currentDoc.conditionNotes || '';
        const oldMainMatch = oldNotes.match(/\[MAIN IMAGE ID: ([^\]]+)\]/i);
        if (oldMainMatch) {
            const oldId = oldMainMatch[1].trim();
            if (updates.imageId !== undefined && oldId !== updates.imageId && oldId !== newMainUploadId) {
                imagesToDelete.add(oldId);
            }
        }

        // Check if gallery images were removed
        if (updates.existingGalleryIds !== undefined) {
             const oldGalleryMatch = oldNotes.match(/\[GALLERY IDS: ([^\]]+)\]/i);
             const oldGalleryIds = oldGalleryMatch ? oldGalleryMatch[1].split(',').map((s: string) => s.trim()).filter((s: string) => s) : (currentDoc.galleryImageIds || []);
             
             oldGalleryIds.forEach((oldId: string) => {
                 if (!updates.existingGalleryIds!.includes(oldId)) {
                     imagesToDelete.add(oldId);
                 }
             });
        }

        // Delete the removed images from the bucket (Only in production, not in Alpha/Dev sandbox to prevent breaking shared images)
        if (imagesToDelete.size > 0 && BUCKET_ID && !isAlphaMode.get()) {
            console.log(`Deleting ${imagesToDelete.size} removed images from bucket...`);
            await Promise.allSettled(Array.from(imagesToDelete).map(id => 
                storage.deleteFile(BUCKET_ID, id).catch(e => console.warn(`Failed to delete removed image ${id}:`, e))
            ));
        }

        // Update Gallery Tag & Field if changed
        if ((updates.galleryFiles?.length || 0) > 0 || updates.existingGalleryIds !== undefined) {
             data.galleryImageIds = currentGalleryIds; // Appwrite requires [] to clear array, not null
             if (currentGalleryIds.length > 0) {
                updateTagValue('GALLERY IDS', currentGalleryIds.join(', '));
             } else {
                notes = notes.replace(/\[GALLERY IDS: [^\]]+\]\n?\n?/g, '');
             }
        }

        // --- Handle Text Fields (Safe Mode updates to Notes) ---

        // --- Handle Text Fields ---

        // Helper to handle clearing or updating both Schema and Notes
        // Since some users might expect data inside notes vs schema
        if (updates.cost !== undefined) {
             if (updates.cost === '') {
                 data.cost = null; // Clear from schema
                 updateNoteValue('Paid', ''); // We could remove the line, but blanking works
             } else {
                 data.cost = parseFloat(updates.cost.toString()); 
                 updateNoteValue('Paid', `$${data.cost.toFixed(2)}`);
             }
        }
        
        if (updates.resalePrice !== undefined) {
             if (updates.resalePrice === '') {
                 data.resalePrice = null;
                 updateNoteValue('Resale', '');
             } else {
                 data.resalePrice = parseFloat(updates.resalePrice.toString());
                 updateNoteValue('Resale', `$${data.resalePrice.toFixed(2)}`);
             }
        }
        
        if (updates.soldPrice !== undefined) {
             if (updates.soldPrice === '') {
                 data.soldPrice = null;
                 updateNoteValue('Sold', '');
             } else {
                 data.soldPrice = parseFloat(updates.soldPrice.toString());
                 updateNoteValue('Sold', `$${data.soldPrice.toFixed(2)}`);
             }
        }

        if (updates.sourcingLocation !== undefined) {
            data.sourcingLocation = updates.sourcingLocation === '' ? null : updates.sourcingLocation;
            updateNoteValue('Location', updates.sourcingLocation);
        }

        if (updates.estLow !== undefined) updateNoteValue('Est. Low', updates.estLow === '' ? '' : `$${parseFloat(updates.estLow.toString()).toFixed(2)}`);
        if (updates.estHigh !== undefined) updateNoteValue('Est. High', updates.estHigh === '' ? '' : `$${parseFloat(updates.estHigh.toString()).toFixed(2)}`);
        if (updates.boutiquePrice !== undefined) updateNoteValue('Boutique', updates.boutiquePrice === '' ? '' : `$${parseFloat(updates.boutiquePrice.toString()).toFixed(2)}`);

        if (updates.itemCondition !== undefined) {
            const mdText = updates.itemCondition;
            const shortCondition = mdText ? mdText.split('\n')[0].substring(0, 100).trim() : '';
            updateNoteValue('Condition', shortCondition);
            
            if (BUCKET_ID && mdText.trim().length > 0) {
                 try {
                     const mdFile = new File([mdText], `scout_${documentId}.md`, { type: 'text/markdown' });
                     const mdUpload = await storage.createFile('reports', ID.unique(), mdFile);
                     updateTagValue('SCOUT_REPORT_MD', mdUpload.$id);
                 } catch(e) {
                     console.warn("Failed to upload MD report", e);
                 }
            } else if (mdText.trim().length === 0) {
                 notes = notes.replace(/\[SCOUT_REPORT_MD: [^\]]+\]\n?\n?/gi, '');
            }
        }

        if (updates.storageLocation !== undefined) {
            data.storageLocation = updates.storageLocation === '' ? null : updates.storageLocation;
            updateNoteValue('Bin', updates.storageLocation);
        }
        
        if (updates.sellingLocations !== undefined) {
            data.sellingLocations = updates.sellingLocations;
        }

        if (updates.keywords !== undefined) {
            data.keywords = Array.isArray(updates.keywords) ? updates.keywords : [];
        }

        if (updates.orderId !== undefined) {
            // No top-level orderId column in standard flow, but save to notes
            updateNoteValue('Order #', updates.orderId);
        }
        
        if (updates.estLow !== undefined) {
            updateNoteValue('Est. Low', updates.estLow === '' ? '' : `$${parseFloat(updates.estLow).toFixed(2)}`);
        }
        if (updates.estHigh !== undefined) {
            updateNoteValue('Est. High', updates.estHigh === '' ? '' : `$${parseFloat(updates.estHigh).toFixed(2)}`);
        }
        
        // Save Scout Data (Base64 encoded JSON to avoid regex issues)
        if (updates.scoutData) {
            try {
                const jsonStr = JSON.stringify(updates.scoutData);
                let fileId: string | null = null;
                
                try {
                    // Strategy 1: Try .json
                    const file = new File([jsonStr], 'scout.json', { type: 'application/json' });
                    const upload = await storage.createFile('reports', ID.unique(), file);
                    fileId = upload.$id;
                } catch(err1: any) {
                    // SELF-REPAIR: If extension not allowed, try to call fix-bucket endpoint
                    if (err1.code === 400 || err1.message.includes('extension')) {
                        console.warn("Bucket missing .json support, attempting auto-fix...");
                        try {
                            await fetch('/api/dev/fix-bucket');
                            // Retry once
                            const file = new File([jsonStr], 'scout.json', { type: 'application/json' });
                            const upload = await storage.createFile('reports', ID.unique(), file);
                            fileId = upload.$id;
                        } catch (retryErr) {
                            try {
                                const file = new File([jsonStr], 'scout.txt', { type: 'text/plain' });
                                const upload = await storage.createFile('reports', ID.unique(), file);
                                fileId = upload.$id;
                            } catch(e3) {
                                 // Check 'fileId' to see if we succeeded in inner blocks? No, just throw to outer catch for Lite
                                 throw retryErr; 
                             }
                        }
                    } else {
                        // Fallback to Strategy 2
                        try {
                            const file = new File([jsonStr], 'scout.txt', { type: 'text/plain' });
                            const upload = await storage.createFile('reports', ID.unique(), file);
                            fileId = upload.$id;
                        } catch(e4) {
                             throw err1;
                        }
                    }
                }

                if (fileId) {
                    updateTagValue('SCOUT_REPORT_ID', fileId);
                    // Clean up old tags
                    notes = notes.replace(/\[SCOUT_DATA: [^\]]+\]/g, '');
                    notes = notes.replace(/\[SCOUT_DATA_LITE: [^\]]+\]/g, '');
                } else {
                    throw new Error("File upload failed to return ID");
                }

            } catch (e) {
                console.warn("File upload failed (" + e.message + "), falling back to LITE data text storage");
                
                // Strategy 3: Lite Data - Minified to fit in Notes
                // Strip heavy arrays/text that is already in description
                const lite = { 
                    ...updates.scoutData, 
                    comparables: [], // In Desc
                    keywords: [],    // In Desc
                    red_flags: updates.scoutData.red_flags || [],
                    price_breakdown: updates.scoutData.price_breakdown
                };
                
                // Remove other heavy props if any?
                delete lite.description; // In Desc
                delete lite.condition_notes; // In Notes
                
                try {
                    const jsonLite = JSON.stringify(lite);
                    // Use a safe base64
                    const b64 = typeof btoa === 'function' ? btoa(jsonLite) : Buffer.from(jsonLite).toString('base64');
                    
                    updateTagValue('SCOUT_DATA_LITE', b64);
                    
                    // Clean up ID tag if we fell back
                    notes = notes.replace(/\[SCOUT_REPORT_ID: [^\]]+\]/g, '');
                } catch(e2) {
                    console.warn("Lite save failed", e2);
                }
            }
        }
        
        // Always update notes
        // CRITICAL: Ensure we don't exceed Appwrite's 1000 char limit for this string attribute (if not a text area)
        // Using strict 800 char limit
        if (notes.length > 800) {
            console.warn("Inventory Note too long (" + notes.length + " chars). Truncating to 800.");
            notes = notes.substring(0, 800);
        }
        data.conditionNotes = notes;

        if (updates.rawAnalysis !== undefined) {
            data.rawAnalysis = updates.rawAnalysis === '' ? null : updates.rawAnalysis;
        } else if (updates.scoutData) {
            const raw = getSafeRawAnalysis(updates.scoutData);
            if (raw) data.rawAnalysis = raw;
        }

        console.log("DEBUG: Safe Mode Update keys:", Object.keys(data));
        
        const response = await databases.updateDocument(
            DB_ID,
            getCollectionId(),
            documentId,
            data
        );
        return response;
    } catch (error) {
         console.error("Error updating item:", error);
         throw error;
    }
}
