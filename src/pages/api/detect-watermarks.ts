export const prerender = false;

import type { APIRoute } from 'astro';
import { getModel, generateContentWithBackoff } from '../../lib/gemini';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { imageUrl, imageBase64 } = body;

    if (!imageUrl && !imageBase64) {
      return new Response(JSON.stringify({ error: 'Image URL or base64 data required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    let mimeType = 'image/jpeg';
    let base64Data = '';

    if (imageBase64) {
      const match = imageBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
        base64Data = match[2];
      } else {
        base64Data = imageBase64;
      }
    } else if (imageUrl) {
      // Fetch image with browser headers to avoid CDN 403 block
      const fetchHeaders: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0'
      };
      try {
        const u = new URL(imageUrl);
        fetchHeaders['Referer'] = u.origin + '/';
      } catch {}

      const fetchRes = await fetch(imageUrl, { headers: fetchHeaders });
      if (!fetchRes.ok) {
        throw new Error(`Failed to fetch image: ${fetchRes.statusText}`);
      }
      const arrayBuffer = await fetchRes.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      base64Data = buffer.toString('base64');
      mimeType = fetchRes.headers.get('content-type') || 'image/jpeg';
    }

    const prompt = `Analyze this resale / auction product photo for any watermarks, auction site logos, copyright banners, or date stamps.
Common examples: "Property of Goodwill", "ShopGoodwill.com", eBay store watermarks, date stamps, auction lot labels.

Return a strictly valid JSON object matching this schema:
{
  "hasWatermarks": boolean,
  "watermarks": [
    {
      "text": "text found (e.g. Property of Goodwill NYNJ)",
      "position": "top" | "bottom" | "corner_br" | "corner_bl" | "corner_tr" | "corner_tl",
      "topPercent": number (0-100, where watermark starts from top),
      "bottomPercent": number (0-100, where watermark ends from top),
      "heightPercent": number (percentage of image height occupied by watermark),
      "confidence": number (0.0 to 1.0)
    }
  ],
  "suggestedTopCut": number (0-30, percentage to cut from top to fully remove header watermark),
  "suggestedBottomCut": number (0-30, percentage to cut from bottom to fully remove footer watermark)
}`;

    const model = getModel();
    const response = await generateContentWithBackoff(model, {
      contents: [{
        role: 'user',
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          { text: prompt }
        ]
      }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.response.text();
    let parsedResult;
    try {
      parsedResult = JSON.parse(text);
    } catch {
      // Fallback
      parsedResult = {
        hasWatermarks: true,
        watermarks: [
          { text: 'Goodwill Top Banner', position: 'top', heightPercent: 8 },
          { text: 'ShopGoodwill Logo', position: 'bottom', heightPercent: 12 }
        ],
        suggestedTopCut: 8,
        suggestedBottomCut: 12
      };
    }

    return new Response(JSON.stringify({ success: true, result: parsedResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err: any) {
    console.error('[API detect-watermarks] Error:', err);
    return new Response(JSON.stringify({ 
      error: err?.message || 'Failed to detect watermarks',
      fallback: {
        hasWatermarks: true,
        suggestedTopCut: 8,
        suggestedBottomCut: 12
      }
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
