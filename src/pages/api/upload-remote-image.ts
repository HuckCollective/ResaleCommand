export const prerender = false;

import { Client, Storage, ID } from 'node-appwrite';
import { InputFile } from 'node-appwrite/file';
import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const url = body.url;

        if (!url) {
            return new Response(JSON.stringify({ error: "Missing url" }), { status: 400 });
        }

        // Sanitize the URL (e.g. replace invalid backslashes from ShopGoodwill databases)
        const cleanUrl = url.replace(/\\/g, '/').trim();

        // ShopGoodwill block standard Node fetch user-agents and require a referer, so we spoof a standard browser
        let referer = undefined;
        try {
            const u = new URL(cleanUrl);
            referer = u.origin + '/';
        } catch(e){}
        
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
        };
        if (referer) {
            headers['Referer'] = referer;
        }

        // 1. Download image from external URL
        const imgRes = await fetch(cleanUrl, { headers });

        if (!imgRes.ok) {
            return new Response(JSON.stringify({ error: `Image fetch failed: ${imgRes.statusText}` }), { status: imgRes.status });
        }

        const arrayBuffer = await imgRes.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        
        let contentType = imgRes.headers.get('content-type') || 'image/jpeg';
        
        // Anti-hotlink check (ShopGoodwill sometimes 200s an HTML login block page instead of the image)
        if (contentType.includes('text/html')) {
             return new Response(JSON.stringify({ error: "Remote server blocked direct image download (returned tracking HTML payload)" }), { status: 403 });
        }

        let ext = contentType.split('/')[1] || '';
        if (ext === 'jpeg') ext = 'jpg';
        if (ext === 'svg+xml') ext = 'svg';

        const validExts = ['jpg', 'png', 'gif', 'webp', 'avif', 'svg'];
        if (!validExts.includes(ext)) {
             ext = 'jpg'; // Fallback to safe known type if server gave weird MIME
        }
        
        const filename = `remote_import_${Date.now()}.${ext}`;

        // Create the InputFile wrapper required by Appwrite
        const fileUpload = InputFile.fromBuffer(buffer, filename);

        // 2. Setup Appwrite Admin Client
        if (!import.meta.env.APPWRITE_API_KEY) {
            throw new Error("Missing APPWRITE_API_KEY for Server-side upload.");
        }

        const client = new Client()
            .setEndpoint(import.meta.env.PUBLIC_APPWRITE_ENDPOINT)
            .setProject(import.meta.env.PUBLIC_APPWRITE_PROJECT_ID)
            .setKey(import.meta.env.APPWRITE_API_KEY);

        const storage = new Storage(client);
        const BUCKET_ID = body.bucketId || import.meta.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images';

        // 3. Upload to Appwrite Bucket
        const upload = await storage.createFile(
            BUCKET_ID,
            ID.unique(),
            fileUpload
        );

        return new Response(JSON.stringify({
            success: true,
            fileId: upload.$id,
            base64: `data:${contentType};base64,${buffer.toString('base64')}`
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: any) {
        console.error("Remote Image Upload Error:", error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
};
