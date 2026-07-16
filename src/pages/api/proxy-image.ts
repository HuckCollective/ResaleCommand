
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, url }) => {
    const imageUrl = url.searchParams.get('url');

    if (!imageUrl) {
        return new Response('Missing URL', { status: 400 });
    }

    // Sanitize any broken shopgoodwill backslashes
    const cleanUrl = imageUrl.replace(/\\/g, '/').trim();

    try {
        const headers: Record<string, string> = {
            // Mimic browser to avoid getting blocked
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0'
        };
        if (cleanUrl.includes('/storage/buckets/')) {
            const projectId = process.env.PUBLIC_APPWRITE_PROJECT_ID;
            const apiKey = process.env.APPWRITE_API_KEY;
            if (projectId) headers['X-Appwrite-Project'] = projectId;
            if (apiKey) headers['X-Appwrite-Key'] = apiKey;
        }

        const response = await fetch(cleanUrl, {
            redirect: 'follow', // Follow redirects!
            headers
        });

        if (!response.ok) {
            return new Response('Failed to fetch image', { status: response.status });
        }

        const blob = await response.blob();
        const contentType = response.headers.get('content-type') || 'image/jpeg';

        return new Response(blob, {
            status: 200,
            headers: {
                'Content-Type': contentType,
                'Cache-Control': 'public, max-age=3600'
            }
        });

    } catch (error) {
        return new Response('Proxy Error', { status: 500 });
    }
};
