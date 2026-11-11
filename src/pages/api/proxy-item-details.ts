
import { parsePacificDateToIso } from '../../lib/dateTimeUtils';

export const POST = async ({ request }: { request: Request }) => {
    try {
        const body = await request.json();
        const { itemId } = body;

        if (!itemId) {
            return new Response(JSON.stringify({ error: 'Item ID is required' }), { status: 400 });
        }

        const apiUrl = `https://buyerapi.shopgoodwill.com/api/ItemDetail/GetItemDetailByItemId/${itemId}`;
        const response = await fetch(apiUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Origin': 'https://shopgoodwill.com',
                'Referer': 'https://shopgoodwill.com/'
            }
        });

        if (response.ok) {
            try {
                const data = await response.json();
                if (data && (data.itemId || data.title)) {
                    const rawCompany = data.sellerCompanyName || data.sellerName || data.seller_name || '';
                    const pickupCity = data.pickupCity || data.sellerCity || '';
                    const pickupState = data.pickupState || data.sellerState || '';
                    const cityState = pickupCity && pickupState ? `${pickupCity}, ${pickupState}` : (pickupCity || pickupState || '');
                    const cleanCompany = String(rawCompany || '')
                        .replace(/^Goodwill\s+Industries\s+of\s+(?:the\s+)?/i, 'Goodwill ')
                        .replace(/^Goodwill\s+of\s+(?:the\s+)?/i, 'Goodwill ')
                        .replace(/,\s*Inc\.?$/i, '')
                        .trim();
                    data.sellerName = cleanCompany
                        ? (cityState && !cleanCompany.toLowerCase().includes(String(pickupCity).toLowerCase() || '__none__')
                            ? `${cleanCompany} (${cityState})`
                            : cleanCompany)
                        : (cityState ? `Goodwill — ${cityState}` : (data.sellerName || null));
                    data.shippingWeight = parseFloat(data.shippingWeight || data.weight || data.dimensionalWeight || 0) || 0;
                    data.canCombineShipping = data.canCombineShipping !== undefined ? Boolean(data.canCombineShipping) : true;
                    if (data.endTime) {
                        data.endTimeIso = parsePacificDateToIso(data.endTime);
                    }

                    // Check for invalid main image (Logo/Placeholder)
                    if (data.imageURL && (data.imageURL.includes('Logo.svg') || data.imageURL.includes('General/'))) {
                         console.log(`[Proxy] API returned Logo as main image. Checking alternatives...`);
                         let foundAlt = false;
                         if (data.additionalImages && Array.isArray(data.additionalImages)) {
                             const alt = data.additionalImages.find((img: any) => {
                                 const url = img.imageURL || img.url || img;
                                 return url && !url.includes('Logo.svg') && !url.includes('General/');
                             });
                             if (alt) {
                                 data.imageURL = alt.imageURL || alt.url || alt;
                                 foundAlt = true;
                                 console.log(`[Proxy] Promoted alternative image: ${data.imageURL}`);
                             }
                         }
                         if (!foundAlt) {
                             delete data.imageURL; // Remove bad image
                         }
                    }

                    // If we still don't have an image, try scraping
                    if (!data.imageURL) {
                        console.log(`[Proxy] API had no valid image. Falling back to Scraper...`);
                        const scrapeRes = await scrapeFallback(itemId);
                        const scrapeData = await scrapeRes.json();
                        if (scrapeData.imageURL) {
                            data.imageURL = scrapeData.imageURL;
                            data.additionalImages = scrapeData.additionalImages;
                            data.debugImages = scrapeData.debugImages; // Pass debug info
                            console.log(`[Proxy] Scraper found image: ${data.imageURL}`);
                        }
                    }

                    return new Response(JSON.stringify(data), { status: 200 });
                }
            } catch (e) {
                // JSON parse failed, proceed to fallback
            }
        }
        
        console.warn(`[Proxy] API failed/empty for ${itemId}, attempting scraping fallback...`);
        return await scrapeFallback(itemId);

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}

async function scrapeFallback(itemId: string) {
    try {
        const publicUrl = `https://shopgoodwill.com/item/${itemId}`;
        const res = await fetch(publicUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!res.ok) {
            return new Response(JSON.stringify({}), { status: 200 }); // Give up
        }

        const html = await res.text();
        console.log(`[Proxy] Scrape Fallback for ${itemId} - HTML Length: ${html.length}`);
        
        const data: any = { itemId };

        // 1. Extract Title
        const titleMatch = html.match(/<title>(.*?)<\/title>/i) || html.match(/class="product-title"[^>]*>(.*?)<\/h/i);
        if (titleMatch) data.title = titleMatch[1].replace('| ShopGoodwill.com', '').trim();

        // 2. Extract Price
        const priceMatch = html.match(/\$([\d,]+\.\d{2})/);
        if (priceMatch) data.currentPrice = priceMatch[1].replace(',', '');

        // 3. Extract Description
        // (Rough attempt, usually inside a specific div)
        const descMatch = html.match(/class="product-description"[^>]*>([\s\S]*?)<\/div>/i);
        if (descMatch) data.description = descMatch[1].trim();

        // 4. Extract Images
        let images: string[] = [];
        
        // Strategy A: app-image-gallery
        const galleryRegex = /<app-image-gallery[^>]*\[itemImages\]="([^"]*)"/i; 
        const galleryMatch = html.match(galleryRegex);
        if (galleryMatch) {
             try {
                const jsonStr = galleryMatch[1].replace(/&quot;/g, '"');
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed)) {
                    images = parsed.map((img: any) => img.imageURL || img.url || img);
                }
             } catch(e) {}
        }

        // Strategy C: OG Image (High Quality Fallback)
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
            images.push(ogMatch[1]);
        }

        // Strategy D: Looser Regex
        if (images.length === 0) {
            // Match ANY azureedge image in src
            const looseRegex = /src=["'](https?:\/\/[^"']*\.azureedge\.net\/[^"']*)["']/g;
            let m;
            while ((m = looseRegex.exec(html)) !== null) {
                images.push(m[1]);
            }
        }

        // Debug: Log what we found raw
        console.log(`[Proxy] Raw Scrape Found: ${images.length}`, images);

        // Filter
        images = images.filter(url => !url.includes('Logo.svg') && !url.includes('General/'));

        if (images.length === 0) {
            console.warn(`[Proxy] Scraper found 0 valid images for ${itemId}`);
        }
        
        data.debugImages = images;

        if (images.length > 0) {
            data.imageURL = images[0]; // Main
            data.additionalImages = images.map(url => ({ imageURL: url })); // Match API shape
        }
        
        data.debugImages = images; // Debugging for client

        console.log(`[Proxy] Scraped ${itemId}: ${data.title ? 'Found Title' : 'No Title'}, ${images.length} Images`);
        return new Response(JSON.stringify(data), { status: 200 });

    } catch (e) {
        console.error("Scraping fallback failed", e);
        return new Response(JSON.stringify({}), { status: 200 }); // Return empty on error
    }
}
