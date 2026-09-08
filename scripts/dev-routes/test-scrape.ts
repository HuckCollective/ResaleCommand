
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request }) => {
    const targetUrl = 'https://www.facebook.com/share/1P3zwphJ5G/';
    let logs: string[] = [];

    try {
        const pageRes = await fetch(targetUrl, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36'
            } 
        });
        
        const html = await pageRes.text();
        
        // 1. Get OpenGraph Image
        const ogMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        logs.push(`OG Image: ${ogMatch ? ogMatch[1] : 'NONE'}`);
        
        const imageUrls = new Set<string>();
        if(ogMatch) imageUrls.add(ogMatch[1]);
        
        const imgRegex = /<img[^>]+src=["'](https:\/\/[^"'\s]+|\/\/[^"'\s]+)["'][^>]*>/gi;
        let match;
        while ((match = imgRegex.exec(html)) !== null) {
            const src = match[1];
            if (src.match(/\.(jpg|jpeg|png|webp)(\?|&|$)/i) && !src.includes('logo') && !src.includes('icon')) {
                    imageUrls.add(src);
            }
        }
        
        logs.push(`Found ${imageUrls.size} potential images: ${Array.from(imageUrls).join(', ')}`);
        
        let successfulFetches = 0;
        for (const imgUrl of Array.from(imageUrls).slice(0, 5)) {
            const res = await fetch(imgUrl, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
                    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
                    'Referer': 'https://www.facebook.com/',
                } 
            });
            if (res.ok) {
                const blob = await res.blob();
                logs.push(`Fetch ${imgUrl}: SUCCESS! Type: ${blob.type}, Size: ${blob.size}`);
                if (blob.type.startsWith('image/')) successfulFetches++;
            } else {
                logs.push(`Fetch ${imgUrl}: FAILED (HTTP ${res.status})`);
            }
        }
        
        return new Response(JSON.stringify({ logs, successfulFetches }), { status: 200, headers: {'Content-Type': 'application/json'} });
    } catch(e: any) {
        return new Response(e.message, { status: 500 });
    }
};
