import type { APIRoute } from 'astro';
import { inspectPhotoGallery, type InspectionImage } from '../../lib/ai-inspection';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { images, remoteImageUrls, base64Images, title, notes, cost, quantity, sourcingLocation, locations } = body;

        const preparedImages: InspectionImage[] = [];
        let imgIdx = 0;

        // 1. Process direct base64 / raw images
        if (Array.isArray(images) && images.length > 0) {
            images.forEach((img: any) => {
                if (typeof img === 'string') {
                    if (img.startsWith('data:')) {
                        preparedImages.push({ base64: img, index: imgIdx++ });
                    } else {
                        preparedImages.push({ url: img, index: imgIdx++ });
                    }
                } else if (img && typeof img === 'object') {
                    preparedImages.push({
                        url: img.url,
                        base64: img.base64,
                        mimeType: img.mimeType,
                        index: img.index !== undefined ? img.index : imgIdx++
                    });
                }
            });
        }

        // 2. Process remote gallery URLs (e.g. from Appwrite / S3)
        if (Array.isArray(remoteImageUrls) && remoteImageUrls.length > 0) {
            remoteImageUrls.forEach((url: string) => {
                if (url && typeof url === 'string' && !preparedImages.some(p => p.url === url)) {
                    preparedImages.push({ url, index: imgIdx++ });
                }
            });
        }

        // 3. Process explicit base64Images array if provided
        if (Array.isArray(base64Images) && base64Images.length > 0) {
            base64Images.forEach((base64: string) => {
                if (base64 && !preparedImages.some(p => p.base64 === base64)) {
                    preparedImages.push({ base64, index: imgIdx++ });
                }
            });
        }

        if (preparedImages.length === 0) {
            return new Response(JSON.stringify({ error: "No images provided" }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const result = await inspectPhotoGallery(preparedImages, {
            title,
            notes,
            cost: typeof cost === 'number' ? cost : parseFloat(cost) || undefined,
            quantity: typeof quantity === 'number' ? quantity : parseInt(quantity, 10) || undefined,
            sourcingLocation,
            locations
        });

        return new Response(JSON.stringify(result), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (e: any) {
        console.error("[api/inspect-lot] Error:", e);
        return new Response(JSON.stringify({ error: e.message || "Failed to inspect lot" }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};

export const PUT: APIRoute = POST;
