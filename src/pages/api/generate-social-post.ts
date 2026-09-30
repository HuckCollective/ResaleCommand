export const prerender = false;

import type { APIRoute } from 'astro';
import { generateContentWithBackoff, parseAiPlainText } from '../../lib/gemini';
import { 
    buildSocialPostPrompt, 
    generateDynamicFallbackPost, 
    type SocialPostOptions 
} from '../../lib/social-prompts';

export const GET: APIRoute = async () => {
    return new Response(JSON.stringify({ status: 'ok', service: 'generate-social-post' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

export const POST: APIRoute = async ({ request }) => {
    try {
        const body = await request.json();
        const postOptions: SocialPostOptions = {
            items: body.items || [],
            locationName: body.locationName || 'Memory Den',
            authorHandle: body.authorHandle || 'resalecommand',
            platform: body.platform || 'instagram',
            tone: body.tone || 'lestat',
            customTone: body.customTone || '',
            includePrices: body.includePrices ?? true,
            customNotes: body.customNotes || '',
            hasLocationPhotos: Boolean(body.hasLocationPhotos),
            hasMeasurements: Boolean(body.hasMeasurements)
        };

        if (postOptions.items.length === 0) {
            return new Response(JSON.stringify({ error: 'At least one item is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Generate dynamic fallback copy as baseline
        const fallbackCaption = generateDynamicFallbackPost(postOptions);

        // Try AI generation if GEMINI_API_KEY is available
        const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return new Response(JSON.stringify({
                caption: fallbackCaption,
                source: 'template',
                message: 'Generated from dynamic template (GEMINI_API_KEY not configured)'
            }), {
                status: 200,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        try {
            const prompt = buildSocialPostPrompt(postOptions);
            const aiResponse = await generateContentWithBackoff(prompt);
            const rawText = aiResponse.response?.text?.() || '';
            const aiCaption = parseAiPlainText(rawText);

            if (aiCaption && aiCaption.length > 30) {
                return new Response(JSON.stringify({
                    caption: aiCaption,
                    source: 'gemini'
                }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        } catch (aiErr: any) {
            console.warn('[API generate-social-post] AI generation failed, falling back to dynamic template:', aiErr.message);
        }

        // Return fallback if AI generation produced empty output or encountered errors
        return new Response(JSON.stringify({
            caption: fallbackCaption,
            source: 'template'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (err: any) {
        console.error('[API generate-social-post] Error:', err);
        return new Response(JSON.stringify({ error: err.message || 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
};
