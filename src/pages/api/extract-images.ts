
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const { url } = await request.json();

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL is required' }), { status: 400 });
        }

        // 0. ShopGoodwill API Strategy (Much better than scraping)
        let sgwId = null;
        
        // Check if raw ID was passed or URL contains it
        if (url.match(/^\d+$/)) {
            sgwId = url;
        } else {
            const match = url.match(/shopgoodwill\.com\/item\/(\d+)/i);
            if (match) sgwId = match[1];
        }

        if (sgwId) {
            console.log(`Detected ShopGoodwill ID: ${sgwId}`);
            try {
                const apiRes = await fetch(`https://buyerapi.shopgoodwill.com/api/ItemDetail/GetItemDetailModelByItemId/${sgwId}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                        'Origin': 'https://shopgoodwill.com',
                        'Referer': 'https://shopgoodwill.com/'
                    }
                });
                if (apiRes.ok) {
                    const data = await apiRes.json();
                    if (data && (data.title || data.itemName)) {
                        const imgServer = data.imageServer || 'https://shopgoodwillimages.azureedge.net/production/';
                        const images: string[] = [];
                        if (data.imageUrlString) {
                            data.imageUrlString.split(';').forEach((p: string) => {
                                const clean = p.trim().replace(/\\/g, '/');
                                if (clean) images.push(imgServer + clean);
                            });
                        } else if (data.imageURL) {
                            const fixUrl = (u: string) => u ? (u.startsWith('//') ? 'https:' + u : u) : '';
                            images.push(fixUrl(data.imageURL));
                        }
                        
                        return new Response(JSON.stringify({ 
                            success: true, 
                            images: [...new Set(images)], // Dedup
                            title: data.title || data.itemName,
                            price: data.currentPrice || data.minimumBid || 0
                        }), { status: 200 });
                    }
                }
            } catch (err: any) {
                console.error("Failed SGW API Parse in extract-images", err);
            }
        }

        // 1. Fallback: Standard HTML Scraping
        let scrapeUrl = url;
        if (sgwId && !url.startsWith('http')) {
             scrapeUrl = `https://shopgoodwill.com/item/${sgwId}`; 
        }

        if (!scrapeUrl.startsWith('http')) {
             return new Response(JSON.stringify({ error: 'Invalid URL. If using an ID, make sure logic handles it.' }), { status: 400 });
        }

        const response = await fetch(scrapeUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
        });

        if (!response.ok) {
            return new Response(JSON.stringify({ error: 'Failed to fetch page' }), { status: 400 });
        }

        const html = await response.text();
        const imageUrls = new Set<string>();

        // 2. Extract OpenGraph Image (High Quality)
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogMatch && ogMatch[1]) {
            imageUrls.add(ogMatch[1]);
        }
        
        // 2b. Extract app-image-gallery (High Quality Gallery)
        const galleryRegex = /<app-image-gallery[^>]*\[itemImages\]="([^"]*)"/i; 
        const galleryMatch = html.match(galleryRegex);
        if (galleryMatch) {
            try {
                const jsonStr = galleryMatch[1].replace(/&quot;/g, '"');
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed)) {
                    parsed.forEach((img: any) => {
                         const u = img.imageURL || img.url || img;
                         if (u && typeof u === 'string') imageUrls.add(u);
                    });
                }
            } catch (e) {
                // Ignore parse errors
            }
        }

        // 3. Extract ShopGoodwill Product Images (specific patterns)
        // Look for typical product image patterns or finding all img tags
        // ShopGoodwill often uses regex like src=".../12345.jpg"
        const imgRegex = /<img[^>]+src=["'](https:\/\/[^"']+)["'][^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
            const src = match[1];
            // Filter junk
            if (src.match(/\.(jpg|jpeg|png|webp)$/i) && !src.includes('logo') && !src.includes('icon')) {
                 imageUrls.add(src);
            }
        }
        
        // 4. Fallback: specific shopgoodwill logic if generic fails
        // They often put images in a script tag or JSON blob too, but let's try basic scraping first.

        return new Response(JSON.stringify({ 
            success: true, 
            images: Array.from(imageUrls) 
        }), { status: 200 });

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
