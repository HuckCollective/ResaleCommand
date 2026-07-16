import type { APIRoute } from 'astro';
import { model, generateContentWithBackoff } from '../../lib/gemini';

export const prerender = false;

// Helper to parse eBay listing HTML
function parseEbay(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) || 
                       html.match(/<meta\s+name=["']twitter:title["']\s+content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].replace(/ \| eBay$/i, '').trim() : '';

    // Extract price from various formats
    const priceMatch = html.match(/itemprop="price"\s+content=["']([^"']+)["']/i) ||
                       html.match(/"price"\s*:\s*"([^"]+)"/i) || 
                       html.match(/class="x-price-primary">.*?<span[^>]*>\s*([^<]+)<\/span>/is) ||
                       html.match(/class="x-price-primary">.*?class="ux-textspans">([^<]+)/is);
    const price = priceMatch ? priceMatch[1].trim() : '';

    // Extract currency
    const currencyMatch = html.match(/itemprop="priceCurrency"\s+content=["']([^"']+)["']/i) ||
                          html.match(/"priceCurrency"\s*:\s*"([^"]+)"/i);
    const currency = currencyMatch ? currencyMatch[1].trim() : 'USD';

    // Extract description
    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    // Extract images
    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    const imgRegex = /<img[^>]+src=["'](https:\/\/i\.ebayimg\.com\/[^"'\s]+)["'][^>]*>/gi;
    let match;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 10) {
        imageUrls.add(match[1]);
        count++;
    }

    // Extract shipping
    let shippingCost = '';
    const shipMatch = html.match(/id=["']shipCost["'][^>]*>\s*([^<]+)/i) || 
                      html.match(/class=["']ux-labels-values__labels-content["']>\s*Shipping:\s*([^<]+)/is) ||
                      html.match(/class=["']ux-labels-values__labels-content["'].*?Shipping:.*?class=["']ux-textspans--bold["']>\s*([^<]+)/is) ||
                      html.match(/class=["']ux-labels-values__values-content["'].*?class=["']ux-textspans--bold["']>\s*(Free|[^<]+)/is) ||
                      html.match(/class=["']ux-labels-values__values-content["']>\s*(Free|[^<]+)/is);
    if (shipMatch) {
        shippingCost = shipMatch[1].replace(/<[^>]*>/g, '').trim();
    }

    return {
        platform: 'eBay',
        title,
        price: price ? `${currency} ${price}` : '',
        description,
        images: Array.from(imageUrls).slice(0, 5),
        shipping: shippingCost
    };
}

// Helper to parse Facebook Marketplace listing HTML
function parseFacebookMarketplace(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const rawTitle = titleMatch ? titleMatch[1].trim() : '';

    let title = rawTitle;
    let price = '';
    let location = '';

    if (rawTitle.includes(' - ')) {
        const parts = rawTitle.split(' - ');
        if (parts.length >= 3) {
            title = parts[0];
            if (parts[1].trim().startsWith('$')) {
                price = parts[1].trim();
                location = parts[2].trim();
            } else if (parts[2].trim().startsWith('$')) {
                price = parts[2].trim();
                location = parts[1].trim();
            } else {
                location = parts[1].trim();
                price = parts[2].trim();
            }
        } else if (parts.length === 2) {
            title = parts[0];
            if (parts[1].trim().startsWith('$')) {
                price = parts[1].trim();
            } else {
                location = parts[1].trim();
            }
        }
    }

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    return {
        platform: 'Facebook Marketplace',
        title,
        price,
        location,
        description,
        images: Array.from(imageUrls).slice(0, 3)
    };
}

// Helper to parse Poshmark listing HTML
function parsePoshmark(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const priceMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/"price"\s*:\s*"([^"]+)"/i);
    const price = priceMatch ? `$${priceMatch[1].trim()}` : '';

    const brandMatch = html.match(/<meta\s+property=["']product:brand["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/"brand"\s*:\s*{\s*"name"\s*:\s*"([^"]+)"/i);
    const brand = brandMatch ? brandMatch[1].trim() : '';

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    const imgRegex = /<img[^>]+src=["'](https:\/\/images\.poshmark\.com\/[^"'\s]+)["'][^>]*>/gi;
    let match;
    let count = 0;
    while ((match = imgRegex.exec(html)) !== null && count < 10) {
        imageUrls.add(match[1]);
        count++;
    }

    return {
        platform: 'Poshmark',
        title,
        price,
        brand,
        description,
        images: Array.from(imageUrls).slice(0, 5)
    };
}

// Helper to parse Mercari listing HTML
function parseMercari(html: string) {
    const titleMatch = html.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
    const title = titleMatch ? titleMatch[1].trim() : '';

    const priceMatch = html.match(/<meta\s+property=["']product:price:amount["']\s+content=["']([^"']+)["']/i) ||
                       html.match(/"price"\s*:\s*"([^"]+)"/i);
    const price = priceMatch ? `$${priceMatch[1].trim()}` : '';

    const descMatch = html.match(/<meta\s+property=["']og:description["']\s+content=["']([^"']+)["']/i) ||
                      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    const description = descMatch ? descMatch[1].trim() : '';

    const imageUrls = new Set<string>();
    const ogImg = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
    if (ogImg) imageUrls.add(ogImg[1]);

    return {
        platform: 'Mercari',
        title,
        price,
        description,
        images: Array.from(imageUrls).slice(0, 5)
    };
}

// Handle both POST and PUT, plus OPTIONS for CORS
export const ALL: APIRoute = async ({ request }) => {
    
    // 1. Handle Preflight / CORS
    if (request.method === "OPTIONS") {
        return new Response(null, {
            status: 204,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, PUT, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, X-Client-Claim",
            }
        });
    }

    if (request.method !== "POST" && request.method !== "PUT") {
         return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    try {
        if (!model) {
            console.error("Gemini model not initialized.");
            return new Response(JSON.stringify({ error: 'Gemini not configured', details: 'Missing GEMINI_API_KEY' }), { 
                status: 500,
                headers: { "Access-Control-Allow-Origin": "*" } 
            });
        }

        // Debug logging
        const urlObj = new URL(request.url);
        const expectedLen = urlObj.searchParams.get("len");
        console.log(`Debug - URL Received: ${request.url}`);
        console.log(`Debug - Using Model: gemini-2.5-flash`); // Confirm model update

        let imageParts: Array<{ inlineData: { data: string; mimeType: string } }> = [];
        let successfulImageUrl: string | null = null;
        let scrapedImages: string[] = [];
        let scrapedShipping: any = null;
        let zipCode: string | null = null;
        
        // Helper 3b: Fetch Image from URL and add to parts
        const fetchAndAddImage = async (imgUrl: string) => {
             if(!imgUrl) return;
             try {
                console.log(`Debug - Fetching Image: ${imgUrl}`);
                
                // Spoof referer matching the image host to bypass hotlink prevention
                let referer = undefined;
                try {
                    const u = new URL(imgUrl);
                    referer = u.origin + '/';
                } catch(e){}
                
                const headers: Record<string, string> = {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
                };
                if (referer) {
                    headers['Referer'] = referer;
                }
                if (imgUrl.includes('/storage/buckets/')) {
                    const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID;
                    const apiKey = process.env.APPWRITE_API_KEY;
                    if (projectId) headers['X-Appwrite-Project'] = projectId;
                    if (apiKey) headers['X-Appwrite-Key'] = apiKey;
                    console.log("Debug - Added Appwrite auth headers for storage URL fetch");
                }
                
                const res = await fetch(imgUrl, { headers });
                
                if(res.ok) {
                    const arrayBuffer = await res.arrayBuffer();
                    
                    // Robust helper to converting ArrayBuffer to Base64 in any env
                    const toBase64 = (buffer: ArrayBuffer) => {
                        let binary = '';
                        const bytes = new Uint8Array(buffer);
                        const len = bytes.byteLength;
                        for (let i = 0; i < len; i++) {
                            binary += String.fromCharCode(bytes[i]);
                        }
                        if (typeof btoa === 'function') {
                            return btoa(binary);
                        }
                        if (typeof globalThis.Buffer !== 'undefined') {
                            // @ts-ignore
                            return globalThis.Buffer.from(buffer).toString('base64');
                        }
                        return '';
                    };

                    const base64 = toBase64(arrayBuffer);
                    
                    if (base64) {
                        // Detect mime
                        let mime = res.headers.get('content-type');
                        
                        // Forcefully validate mime before pushing
                        if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                             // Attempt to infer or default
                             console.log("Debug - Forcing octet-stream to image/jpeg");
                             mime = 'image/jpeg';
                        }
                        
                        // Double check
                        if (!mime.startsWith('image/')) {
                             console.warn(`Debug - Invalid Mime for Gemini: ${mime}, skipping.`);
                             return; // Skip adding this part
                        }
                        
                        imageParts.push({
                            inlineData: {
                                data: base64,
                                mimeType: mime
                            }
                        });
                        successfulImageUrl = imgUrl; // Track success
                        console.log(`Debug - Successfully added image part. Mime: ${mime}, Length: ${base64.length}`);
                    }
                } else {
                    console.warn(`Debug - Image fetch status: ${res.status}`);
                }
             } catch(e) {
                 console.warn(`Failed to fetch external image: ${imgUrl}`, e);
             }
        };

        // 2. Read Body
        let rawBody = "";
        let userNotes = "";

        try {
            const ab = await request.arrayBuffer();
            if (ab.byteLength > 0) {
                rawBody = new TextDecoder().decode(ab);
            } else {
                // Fallback attempt
                rawBody = await request.text();
            }
        } catch (readError: any) {
            console.error("Debug - Failed to read request body:", readError);
            return new Response(JSON.stringify({ 
                error: "Read Failed", 
                details: `Server could not read request stream: ${readError.message}` 
            }), { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
        }

        console.log(`Debug - Body Length Read: ${rawBody ? rawBody.length : 0} | Expected: ${expectedLen}`);

        if (!rawBody || rawBody.length === 0) {
            return new Response(JSON.stringify({ 
                error: "Empty Body", 
                details: `Server received 0 bytes. (Expected: ${expectedLen}). URL: ${request.url}` 
            }), { 
                status: 400,
                headers: { "Access-Control-Allow-Origin": "*" } 
            });
        }
        
        // imageParts already declared at top of file

        if (rawBody.trim().startsWith("data:")) {
            // Option 1: Raw Data URL string (text/plain) - Single Image
            const parts = rawBody.split(",");
            const match = parts[0].match(/:(.*?);/);
            const mime = match ? match[1] : "image/jpeg";
            imageParts.push({
                inlineData: {
                    data: parts[1],
                    mimeType: mime
                }
            });
        } else if (rawBody.trim().startsWith("{")) {
            // Option 2: JSON payload
            try {
                const json = JSON.parse(rawBody);
                
                // Extract User Notes if present
                if (json.notes) {
                    userNotes = json.notes;
                }

                if (json.zipCode) {
                    zipCode = String(json.zipCode).trim();
                }
                
                // Helper to process a single data-url string
                const processDataUrl = (url: string) => {
                     if (url.startsWith("data:")) {
                         const parts = url.split(",");
                         const match = parts[0].match(/:(.*?);/);
                         let mime = match ? match[1] : "image/jpeg";
                         
                         // Robust Mime Validation (prevent 500s)
                         if (!mime || mime === 'application/octet-stream' || !mime.startsWith('image/')) {
                             mime = 'image/jpeg';
                         }
                         
                         return {
                             inlineData: {
                                 data: parts[1],
                                 mimeType: mime
                             }
                         };
                     }
                     return null;
                };

                // Check for 'images' array
                if (Array.isArray(json.images)) {
                    json.images.forEach((img: string) => {
                        const part = processDataUrl(img);
                        if (part) imageParts.push(part);
                    });
                } 
                // Fallback check for single 'image'
                else if (json.image) {
                     const part = processDataUrl(json.image);
                     if (part) imageParts.push(part);
                }
                
                // NEW: Allow passing direct 'imageUrl'
                if (json.imageUrl && imageParts.length === 0) {
                    scrapedImages = [json.imageUrl];
                    await fetchAndAddImage(json.imageUrl);
                }
                
                // NEW: Allow passing an array of remote URLs (e.g. from Appwrite)
                if (Array.isArray(json.remoteImageUrls)) {
                    scrapedImages = json.remoteImageUrls.slice(0, 5);
                    const promises = json.remoteImageUrls.slice(0, 5 - imageParts.length).map((imgUrl: string) => fetchAndAddImage(imgUrl));
                    await Promise.all(promises);
                }

            } catch (e) {
                console.error("JSON parse failed", e);
            }
        } 

        // 3. Smart URL Handling (The "Scout Link" Feature)
        // 3. Smart URL Handling (Deep Listing Analysis)
        if (userNotes) {
            const urlMatch = userNotes.match(/https?:\/\/[^\s]+/);
            if (urlMatch) {
                let targetUrl = urlMatch[0];
                console.log(`Debug - Found URL for Deep Parse: ${targetUrl}`);
                
                // Resolve eBay short URL redirects
                if (/ebay\.io/i.test(targetUrl)) {
                    try {
                        console.log(`Debug - Resolving eBay short URL redirect: ${targetUrl}`);
                        const redirectRes = await fetch(targetUrl, { method: 'GET', redirect: 'manual' });
                        const location = redirectRes.headers.get('location');
                        if (location) {
                            targetUrl = location;
                            console.log(`Debug - Resolved eBay short URL to: ${targetUrl}`);
                        }
                    } catch (e) {
                        console.error("Failed to resolve eBay short URL redirect", e);
                    }
                }
                
                const isEbay = /ebay\.(com|io|ca|co\.uk|com\.au|de|fr|it|es|nl|be|ch|at|pl|ie)/i.test(targetUrl);
                
                if (isEbay) {
                    if (imageParts.length === 0) {
                        return new Response(JSON.stringify({ 
                            error: "eBay Link Scouting Unsupported", 
                            details: "eBay blocks automated requests. To scout this item, please capture/upload a photo of the item, or describe it in the 'Additional Details' box." 
                        }), { 
                            status: 400,
                            headers: { 
                                "Access-Control-Allow-Origin": "*",
                                "Content-Type": "application/json"
                            } 
                        });
                    } else {
                        console.log("Debug - eBay URL with images, skipping fetch and using image-based analysis.");
                    }
                } else {
                    // A. ShopGoodwill API Strategy (High Fidelity)
                    const sgwMatch = targetUrl.match(/shopgoodwill\.com\/(?:item|viewitem)\/(\d+)/i);
                    if (sgwMatch) {
                        const itemId = sgwMatch[1];
                        let parsedData: any = null;
                        try {
                             const apiRes = await fetch(`https://buyerapi.shopgoodwill.com/api/ItemDetail/GetItemDetailModelByItemId/${itemId}`, {
                                 headers: { 
                                     'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                                     'Origin': 'https://shopgoodwill.com',
                                     'Referer': 'https://shopgoodwill.com/'
                                 }
                             });
                             if (apiRes.ok) {
                                 const itemData = await apiRes.json();
                                 if (itemData && (itemData.title || itemData.itemName)) {
                                      parsedData = itemData;
                                 }
                             }
                        } catch (err) {
                            console.error("Failed Deep SGW Parse", err);
                        }

                        if (parsedData) {
                             // Parse multiple images
                             const imgServer = parsedData.imageServer || 'https://shopgoodwillimages.azureedge.net/production/';
                             const imgUrls: string[] = [];
                             if (parsedData.imageUrlString) {
                                 parsedData.imageUrlString.split(';').forEach((p: string) => {
                                     const clean = p.trim().replace(/\\/g, '/');
                                     if (clean) imgUrls.push(imgServer + clean);
                                 });
                             } else if (parsedData.imageURL) {
                                 const fixUrl = (u: string) => u ? (u.startsWith('//') ? 'https:' + u : u) : '';
                                 imgUrls.push(fixUrl(parsedData.imageURL));
                             }
                             
                             if (imgUrls.length > 0) {
                                 successfulImageUrl = imgUrls[0];
                                 scrapedImages = imgUrls.slice(0, 5);
                             }

                             // Calculate Shipping if zipCode is provided
                             if (zipCode) {
                                 try {
                                     console.log(`[Deep Parse - SGW] Calculating shipping to ZIP: ${zipCode}`);
                                     const calcRes = await fetch(`https://buyerapi.shopgoodwill.com/api/ItemDetail/CalculateShipping`, {
                                         method: 'POST',
                                         headers: {
                                             'Content-Type': 'application/json',
                                             'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                                             'Origin': 'https://shopgoodwill.com',
                                             'Referer': 'https://shopgoodwill.com/'
                                         },
                                         body: JSON.stringify({
                                             itemId: parseInt(itemId),
                                             country: "US",
                                             province: null,
                                             zipCode: zipCode,
                                             quantity: 1,
                                             clientIP: "0.0.0.3"
                                         })
                                     });
                                     if (calcRes.ok) {
                                         const htmlText = await calcRes.text();
                                         const shipMatch = htmlText.match(/id=['"]shipping-span['"]>\$([0-9.]+)/i);
                                         const handMatch = htmlText.match(/Handling:\s*\$([0-9.]+)/i);
                                         const totalMatch = htmlText.match(/Total Shipping and Handling:\s*\$([0-9.]+)/i) || 
                                                            htmlText.match(/Total Shipping and Handling:.*?\$([0-9.]+)/is);
                                         const carrierMatch = htmlText.match(/Shipping Carrier:\s*([^<]+)/i);
                                         
                                         if (totalMatch) {
                                             scrapedShipping = {
                                                 shipping: shipMatch ? parseFloat(shipMatch[1]) : 0,
                                                 handling: handMatch ? parseFloat(handMatch[1]) : 0,
                                                 total: parseFloat(totalMatch[1]),
                                                 carrier: carrierMatch ? carrierMatch[1].trim() : 'FedEx',
                                                 zipCode: zipCode
                                             };
                                             console.log(`[Deep Parse - SGW] Calculated Shipping Total: $${scrapedShipping.total}`);
                                         }
                                     }
                                 } catch (calcErr) {
                                     console.error("Failed SGW CalculateShipping", calcErr);
                                 }
                             }

                             let contextText = `[Deep Parse - ShopGoodwill]\n`;
                             contextText += `Title: ${parsedData.title || parsedData.itemName}\n`;
                             contextText += `Current Bid: $${parsedData.currentPrice} | Bids: ${parsedData.bidCount} | Ends: ${parsedData.endTime}\n`;
                             if (scrapedShipping) {
                                 contextText += `Estimated Shipping: $${scrapedShipping.total} (${scrapedShipping.carrier}) to ZIP ${scrapedShipping.zipCode} (Shipping: $${scrapedShipping.shipping}, Handling: $${scrapedShipping.handling})\n`;
                             }
                             
                             const rawDesc = parsedData.description || "";
                             const cleanDesc = rawDesc.replace(/<[^>]*>?/gm, '').substring(0, 3000); // Strip HTML, keep 3000 chars
                             contextText += `Description: ${cleanDesc}\n\n`;
                             
                             // Prepend to user notes
                             userNotes = contextText + userNotes;
                             
                             // ONLY fetch external images if the client didn't provide any
                             if (imageParts.length === 0 && imgUrls.length > 0) {
                                 const promises = imgUrls.slice(0, 3).map(u => fetchAndAddImage(u));
                                 await Promise.all(promises);
                             }
                        } else {
                             // Fallback: Fetch public page HTML and parse
                             console.log(`[Deep Parse - SGW] API failed for ${itemId}, falling back to generic page parse.`);
                             try {
                                 const pageRes = await fetch(targetUrl, {
                                     headers: {
                                         'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
                                     }
                                 });
                                 if (pageRes.ok) {
                                     const html = await pageRes.text();
                                     const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                                     const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || 
                                                       html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i);
                                     
                                     let contextText = `[Deep Parse - ShopGoodwill Generic]\n`;
                                     if (titleMatch) contextText += `Title: ${titleMatch[1].replace('| ShopGoodwill.com', '').trim()}\n`;
                                     if (descMatch) contextText += `Description: ${descMatch[1].substring(0, 1000)}\n`;
                                     
                                     userNotes = contextText + "\n" + userNotes;
                                     
                                     // Try to extract images from page
                                     if (imageParts.length === 0) {
                                         const imageUrls = new Set<string>();
                                         const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
                                         const fixUrl = (u: string) => u ? (u.startsWith('//') ? 'https:' + u : u) : '';
                                         if (ogMatch) imageUrls.add(fixUrl(ogMatch[1]));
                                         
                                         const imgRegex = /src=["'](https?:\/\/[^"']*\.azureedge\.net\/[^"']*)["']/g;
                                         let match;
                                         let count = 0;
                                         while ((match = imgRegex.exec(html)) !== null && count < 10) {
                                             const src = fixUrl(match[1]);
                                             // Clean backslashes to forward slashes for the remote image url
                                             const cleanSrc = src.replace(/\\/g, '/');
                                             if (!cleanSrc.includes('Logo.svg') && !cleanSrc.includes('General/')) {
                                                 imageUrls.add(cleanSrc);
                                             }
                                             count++;
                                         }
                                         
                                         const topImages = Array.from(imageUrls).slice(0, 5);
                                         if (topImages.length > 0) {
                                             if (!successfulImageUrl) successfulImageUrl = topImages[0];
                                             scrapedImages = topImages;
                                         }
                                         
                                         if (imageParts.length === 0) {
                                             const promises = topImages.slice(0, 3).map(imgUrl => fetchAndAddImage(imgUrl));
                                             await Promise.all(promises);
                                         }
                                     }
                                 }
                             } catch (e) {
                                 console.error("Failed SGW fallback parse", e);
                             }
                        }
                    }
                    // B. Other Platform-Specific or Generic Scrapes
                    else {
                         try {
                            const pageRes = await fetch(targetUrl, { 
                                headers: { 
                                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' 
                                } 
                            });
                            if (pageRes.ok) {
                                const html = await pageRes.text();
                                
                                let scrapedData: any = null;
                                const finalUrl = (pageRes.url || targetUrl).toLowerCase();
                                
                                if (finalUrl.includes('facebook.com') || targetUrl.includes('facebook.com')) {
                                    scrapedData = parseFacebookMarketplace(html);
                                } else if (finalUrl.includes('poshmark.com') || targetUrl.includes('poshmark.com')) {
                                    scrapedData = parsePoshmark(html);
                                } else if (finalUrl.includes('mercari.com') || targetUrl.includes('mercari.com')) {
                                    scrapedData = parseMercari(html);
                                }
                                
                                let contextText = '';
                                const imageUrls = new Set<string>();
                                
                                if (scrapedData) {
                                    contextText = `[Deep Parse - ${scrapedData.platform}]\n`;
                                    contextText += `Title: ${scrapedData.title}\n`;
                                    if (scrapedData.price) contextText += `Asking/Current Price: ${scrapedData.price}\n`;
                                    if (scrapedData.brand) contextText += `Brand: ${scrapedData.brand}\n`;
                                    if (scrapedData.location) contextText += `Location: ${scrapedData.location}\n`;
                                    if (scrapedData.shipping) {
                                        contextText += `Shipping: ${scrapedData.shipping}\n`;
                                        
                                        const rawShip = scrapedData.shipping;
                                        if (rawShip.toLowerCase().includes('free')) {
                                            scrapedShipping = { shipping: 0, handling: 0, total: 0, carrier: 'eBay logistics', message: 'Free Shipping' };
                                        } else {
                                            const matches = rawShip.match(/[0-9.]+/);
                                            if (matches) {
                                                const amt = parseFloat(matches[0]);
                                                scrapedShipping = { shipping: amt, handling: 0, total: amt, carrier: 'eBay logistics', message: rawShip };
                                            }
                                        }
                                    }
                                    if (scrapedData.description) contextText += `Description: ${scrapedData.description.substring(0, 1500)}\n`;
                                    contextText += `\n`;
                                    
                                    scrapedData.images.forEach((img: string) => imageUrls.add(img));
                                } else {
                                    // C. Generic Full-Page Scrape (Fallback)
                                    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
                                    const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
                                    const descMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) || 
                                                      html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) || 
                                                      html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
                                    
                                    contextText = `[Deep Parse - Generic URL]\n`;
                                    if (ogTitleMatch) contextText += `Title: ${ogTitleMatch[1]}\n`;
                                    else if (titleMatch) contextText += `Title: ${titleMatch[1]}\n`;
                                    if (descMatch) contextText += `Description: ${descMatch[1].substring(0, 1000)}\n`;
                                    
                                    // Extract Structured JSON-LD Data (Critical for Pricing/Bids on obscure platforms)
                                    const ldRegex = /<script type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
                                    let ldMatch;
                                    let structuredData = '';
                                    while ((ldMatch = ldRegex.exec(html)) !== null) {
                                        structuredData += ldMatch[1] + '\n';
                                    }
                                    if (structuredData) {
                                        // Keep the first 1500 characters of structured data to prevent prompt bloat while grabbing price metadata
                                        contextText += `Structured Data: ${structuredData.substring(0, 1500)}\n`;
                                    }
                                    
                                    // Extract Images (Max 5)
                                    const ogMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
                                    const fixUrl = (u: string) => {
                                        if (!u) return '';
                                        let fixed = u.replace(/&amp;/g, '&');
                                        return fixed.startsWith('//') ? 'https:' + fixed : fixed;
                                    };
                                    
                                    if(ogMatch) imageUrls.add(fixUrl(ogMatch[1]));
                                    
                                    // Extract SGW app-image-gallery (High Quality Gallery fallback for Angular)
                                    const galleryRegex = /<app-image-gallery[^>]*\[itemImages\]=["']([^"']*)["']/i; 
                                    const galleryMatch = html.match(galleryRegex);
                                    if (galleryMatch) {
                                        try {
                                            const jsonStr = galleryMatch[1].replace(/&quot;/g, '"');
                                            const parsed = JSON.parse(jsonStr);
                                            if (Array.isArray(parsed)) {
                                                parsed.forEach((img: any) => {
                                                     const u = img.imageURL || img.url || img;
                                                     if (u && typeof u === 'string') imageUrls.add(fixUrl(u));
                                                });
                                            }
                                        } catch (e) {}
                                    }

                                    const imgRegex = /<img[^>]+src=["'](https:\/\/[^"'\s]+|\/\/[^"'\s]+)["'][^>]*>/gi;
                                    let match;
                                    let count = 0;
                                    while ((match = imgRegex.exec(html)) !== null && count < 20) {
                                        const src = fixUrl(match[1]);
                                        if (src.match(/\.(jpg|jpeg|png|webp)(\?|&|$)/i) && !src.includes('logo') && !src.includes('icon')) {
                                             imageUrls.add(src);
                                        }
                                        count++;
                                    }
                                }
                                
                                userNotes = contextText + "\n" + userNotes;

                                scrapedImages = Array.from(imageUrls).slice(0, 5);
                                if (scrapedImages.length > 0 && !successfulImageUrl) {
                                    successfulImageUrl = scrapedImages[0];
                                }

                                // ONLY fetch external images if the client didn't provide any
                                if (imageParts.length === 0) {
                                    const topImages = scrapedImages.slice(0, 3);
                                    const promises = topImages.map(imgUrl => fetchAndAddImage(imgUrl));
                                    await Promise.all(promises);
                                }
                            } else {
                                if (imageParts.length === 0) {
                                    return new Response(JSON.stringify({ 
                                        error: "Scouting Failed", 
                                        details: `Unable to access URL (Status: ${pageRes.status}). Please upload a photo or enter details manually.` 
                                    }), { 
                                        status: 400,
                                        headers: { 
                                            "Access-Control-Allow-Origin": "*",
                                            "Content-Type": "application/json"
                                        } 
                                    });
                                }
                            }
                         } catch(e: any) { 
                             console.warn("Deep Scrape failed", e);
                             if (imageParts.length === 0) {
                                 return new Response(JSON.stringify({ 
                                     error: "Scouting Failed", 
                                     details: `Failed to connect to the provided URL. Please upload a photo or enter details manually.` 
                                 }), { 
                                     status: 400,
                                     headers: { 
                                         "Access-Control-Allow-Origin": "*",
                                         "Content-Type": "application/json"
                                     } 
                                 });
                             }
                         }
                    }
                }
            }
        }

        // Relaxed Check: Allow if images exist OR if we have notes (now potentially enhanced)
        if (imageParts.length === 0 && !userNotes) {
                 return new Response(JSON.stringify({ error: "Parsing Failed", details: "No image data AND no notes found in body." }), { 
                    status: 400,
                    headers: { "Access-Control-Allow-Origin": "*" }
                });
        }

        const prompt = `
          Analyze this item for resale.
          
          CONTEXT / USER NOTES: "${userNotes}"
          (If a URL is provided in notes, visit it or infer details from it if possible, otherwise rely on general knowledge of such items).
          
          TASK:
          1. Detect if the listing is a bundle lot (multiple distinct items sold together under a single price, e.g. a clothing lot, box of books, bundle of games).
          2. If it is a bundle lot, return a SINGLE item in the 'items' array representing the entire lot.
          3. For a bundle lot:
             - The 'identity' and 'title' should describe the overall lot (e.g. "Free People Tops M Lot of 4").
             - The 'price_breakdown' should estimate the resale value of the ENTIRE lot combined if sold together, OR the sum of individual values.
             - The 'purchase_strategy' should evaluate the entire lot against the asking price.
             - Include a 'lot_items' array containing each individual item within the lot, specified as:
                 - 'name': Specific description of the component item.
                 - 'estimated_value': Resale value of this component if sold individually (e.g., "$25 - $35").
                 - 'condition': Inferred condition of this component.

          CRITICAL PRICING & IDENTIFICATION RULES:
          - PRICING MODEL & CONDITION MODIFIERS (Align with ResaleCommand Standards):
            1. 'mint': Price range if New/Mint. Set to 100% of fair market secondary value.
            2. 'fair': Price range if Used/Good. Set to 70-80% of mint value.
            3. 'poor': Price range if Poor/Damaged. Set to 20-40% of mint value.
            4. 'boutique_premium': Curated physical retail price (usually 30-50% higher than online/eBay sold prices due to curation/vintage appeal).
          
          - MARKUP STRATEGY & MINIMUM THRESHOLDS:
            If you have context about the acquisition cost (e.g., in user notes or a scraped price that represents your cost):
            1. Landed Cost Calculation: If shipping or handling cost is provided in context/notes, add it to the asking price/acquisition cost to calculate the true Landed Cost (Landed Cost = acquisition_cost + shipping_cost). Otherwise, Landed Cost is simply the acquisition_cost.
            2. Standard Markup: Target resale price should be **3.0x Landed Cost**.
            3. Minimum Markup Floor: Target resale price must be at least **2.0x Landed Cost**.
            4. High-Value Markup: Target resale price can be **1.5x Landed Cost** for high-ticket items (Landed Cost > $100).
            5. Minimum Absolute Profit threshold: You must expect at least **$15.00** in net profit (resalePrice - Landed Cost >= 15.00).
            6. Minimum Resale Listing Price: You must never list an item for less than **$25.00** resale price. If the item's fair value is under $25, recommend passing.
            
          - PURCHASE STRATEGY VERDICT DECISION FLOW:
            Evaluate the 'purchase_strategy' based on the asking price (if found in notes/scraped data) and the item's value:
            1. "BUY_NOW": If asking price <= 40% of fair market value (OR <= 40% of the curated physical retail booth value/'boutique_premium' if reselling in a physical booth location) AND potential profit >= $15 AND target resale price >= $25.
            2. "PASS": If target resale price < $25, AND expected profit < $15 (considering both online fair value and curated physical booth value/'boutique_premium'), OR if asking price is too close to/above target resale values.
            3. "WATCH": If it's an auction and the current bid is reasonable, or if the profit margin is marginal.
            4. "NEGOTIATE": If it's a fixed-price listing but allows offers, and the asking price is slightly above the BUY_NOW threshold.
            5. "CHASE_AUCTION": If it is a live auction and current price/bid is low compared to the estimated Max Buy Price (which is ~40% of fair value or booth value).
            *IMPORTANT*: Many users sell in curated booth locations (antique malls, physical consignment booths) where they can realize the higher 'boutique_premium' price. When evaluating profit margins and determining the verdict, factor in the 'boutique_premium' value as a valid resale target. If an item would normally be a PASS based on online fair value but is a BUY based on booth value, recommend BUY_NOW or watch/negotiate, and explain this in the advice.
            *AUCTION BID LIMITS*: If the item is an auction (or the verdict is CHASE_AUCTION or WATCH), calculate the Suggested Max Bid as: (Max Buy Price - Estimated Shipping - Handling). Explicitly state this Max Bid limit in the 'advice' string (e.g., "Suggested max bid is $25.00 to stay under the landed target of $44.09").

          - ACTIVELY READ TEXT & COVERS: Extract the EXACT title directly from the item. If it is a book, game, or media, read the cover text precisely (e.g., "Monster Manual", "Spell Compendium"). Pay close attention to small sub-text like "v.3.5".
          - SPECIFY EDITIONS: For tabletop games, RPGs (like Dungeons & Dragons), and textbooks, you MUST use the cover art style and layout to identify the EXACT EDITION (e.g., 1st Edition, v3.5, 4th Edition, 5e) and put it in the title.
          - STANDARD D&D 3.5: Standard 3.5e core books have MASSIVE, highly detailed painted metal borders, giant hinges, and locks covering the entire book. For example, the standard DMG has a huge silver lock mechanism with gems and the title is on a gold plaque. DO NOT call these "Premium". Call them "D&D 3.5e [Book Name]".
          - PREMIUM REPRINTS 3.5: ONLY call a book a "Premium Reprint" if the cover is mostly empty space featuring a SOLID flat faux-leather texture (solid dark green, dark red, or dark blue) across the entire cover. They DO NOT have massive painted silver locks or hinges. The title text floats directly on the plain leather texture above a single central globe/eye/crest.
          - ACTIVELY READ TAGS: Pay very close attention to any tags or labels. If you see a brand tag or "New With Tags" (NWT) label, you MUST use that exact brand for identification and reflect its true higher value.
          - BE CONSERVATIVE BUT ACCURATE: Do not randomly guess high-end designer names if there's no tag/logo, but DO trust clear branding when it is visible. 
          - For "Style" items (e.g. "Goth Style", "Victorian Style"), if no authentic brand/hallmark exists, price them as UNBRANDED/COSTUME ($10-$30 range). 
          - NWT (NEW WITH TAGS): If tags are attached, heavily weight the 'mint' price and specify "NWT" in condition_notes.
          - AVOID HALLUCINATIONS. If you are truly unsure and no tags exist, provide a low "Generic" estimate.
          
          OUTPUT FORMAT:
          Return strictly a JSON object with property "items": [ ... ].
          
          Each item object in the array must contain:
          - 'identity': A single string describing the item.
          - 'title': A short SEO-friendly title string.
          - 'keywords': An array of strings.
          - 'condition_notes': A VERY BRIEF (1-2 sentences max) condition assessment.
          - 'red_flags': An array of strings highlighting potential issues. Return empty if none.
          - 'price_breakdown': An object with estimated values:
              - 'mint': Price range if New/Mint.
              - 'fair': Price range if Used/Good.
              - 'poor': Price range if Poor/Damaged.
              - 'boutique_premium': Price range if sold in a curated physical boutique or antique shop.
              - 'confidence': (Low/Medium/High)
          - 'comparables': An array of EXACTLY 1 similar item sold on eBay/etc (BE BRIEF).
               - 'name': Specific item name/title.
               - 'price': approx sold price.
               - 'status': "Sold" or "Listed"
          - 'purchase_strategy': An object containing strategic advice for sourcing this item:
               - 'verdict': ONE of these strict enums: "PASS", "WATCH", "BUY_NOW", "NEGOTIATE", "CHASE_AUCTION".
               - 'current_asking_price': State the current bid or asking price if found.
               - 'max_bid': (Number) The absolute maximum bid or offer you recommend (excluding shipping).
               - 'max_landed_cost': (Number) The maximum total cost (including shipping) to stay profitable.
               - 'advice': ONE VERY BRIEF SENTENCE detailing the sourcing strategy.
          - 'lot_items': (Only if it is a bundle lot) An array of objects for each component item:
               - 'name': Specific name/description of the item.
               - 'estimated_value': Inferred individual resale value (e.g. "$20 - $30").
               - 'condition': Inferred condition of this item.
        `;

        const contentParts: any[] = [{ text: prompt }];
        if (imageParts.length > 0) {
            contentParts.push(...imageParts);
        }

        const result = await generateContentWithBackoff({
            contents: [{ role: 'user', parts: contentParts }],
            generationConfig: { responseMimeType: "application/json" }
        }, 3, 2000); // Only retry 3 times for real-time frontend calls to prevent 2.5 minute UI hangs
        
        const response = await result.response;
        
        const taskResponse = response.text();
        
        // Clean up potential markdown code blocks \`\`\`json ... \`\`\`
        let cleanedResponse = taskResponse.replace(/```json|```/g, '').trim();

        // Inject fetched image URLs and shipping info into response if available
        try {
            const jsonObj = JSON.parse(cleanedResponse);
            if (jsonObj.items && jsonObj.items.length > 0) {
                jsonObj.items.forEach((item: any, idx: number) => {
                    if (idx === 0) {
                        if (successfulImageUrl) {
                            item.fetched_image = successfulImageUrl;
                        }
                        if (scrapedImages && scrapedImages.length > 0) {
                            item.fetched_images = scrapedImages;
                        }
                        if (scrapedShipping) {
                            item.shipping_info = scrapedShipping;
                        }
                    }
                });
            }
            cleanedResponse = JSON.stringify(jsonObj);
        } catch (e) {
            console.warn("Could not parse Gemini response to inject scraped metadata", e);
        }

        return new Response(cleanedResponse, {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (error: any) {
        console.error("Detailed Gemini Analysis Error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        let errorMessage = error instanceof Error ? error.message : 'Unknown error';
        let statusCode = 500;
        
        if (error?.status === 429 || errorMessage.includes('429 Too Many Requests')) {
            errorMessage = "AI Rate Limit Reached (15 requests/min). Please wait 60 seconds and try again.";
            statusCode = 429;
        }
        
        return new Response(JSON.stringify({ error: 'Analysis failed', details: errorMessage, isRateLimit: statusCode === 429 }), { 
            status: statusCode,
            headers: { "Access-Control-Allow-Origin": "*" }
        });
    }
}
