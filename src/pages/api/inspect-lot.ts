import type { APIRoute } from 'astro';
import { inspectPhotoGallery, type InspectionImage } from '../../lib/ai-inspection';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const { images, remoteImageUrls, base64Images, title, notes, cost, quantity, sourcingLocation, locations } = body;

        const preparedImages: InspectionImage[] = [];

        if (Array.isArray(images) && images.length > 0) {
            images.forEach((img: any, idx: number) => {
                if (typeof img === 'string') {
                    if (img.startsWith('data:')) {
                        preparedImages.push({ base64: img, index: idx });
                    } else {
                        preparedImages.push({ url: img, index: idx });
                    }
                } else if (img && typeof img === 'object') {
                    preparedImages.push({
                        url: img.url,
                        base64: img.base64,
                        mimeType: img.mimeType,
                        index: img.index !== undefined ? img.index : idx
                    });
                }
            });
        } else if (Array.isArray(remoteImageUrls) && remoteImageUrls.length > 0) {
            remoteImageUrls.forEach((url: string, idx: number) => {
                preparedImages.push({ url, index: idx });
            });
        } else if (Array.isArray(base64Images) && base64Images.length > 0) {
            base64Images.forEach((base64: string, idx: number) => {
                preparedImages.push({ base64, index: idx });
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
