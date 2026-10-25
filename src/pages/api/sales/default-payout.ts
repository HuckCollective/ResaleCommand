import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export const GET: APIRoute = async () => {
  try {
    const csvPath = path.resolve(process.cwd(), 'public', 'MemoryDen_MultiMonth_Payout_Full.csv');
    if (!fs.existsSync(csvPath)) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    const content = fs.readFileSync(csvPath, 'utf-8');
    return new Response(content, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
