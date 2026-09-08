
// DEPRECATED - Use `node scripts/fix-bucket.mjs` instead.
export const prerender = false;
export async function GET() {
    return new Response("Gone", { status: 410 });
}
