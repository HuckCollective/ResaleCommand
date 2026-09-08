
// DEPRECATED - This file has been replaced by scripts/wipe_db.js
// Please use `node scripts/wipe_db.js --run` instead.
export const prerender = false;
export async function GET() {
    return new Response("Gone", { status: 410 });
}
