const ENDPOINT = 'http://localhost:4321/api/identify-item';
const TEST_URL = 'https://shopgoodwill.com/item/278459386';

console.log(`Testing Scout Identify Item endpoint: ${ENDPOINT}`);
console.log(`URL to test: ${TEST_URL}`);

async function runTest() {
    try {
        const payload = JSON.stringify({
            images: [],
            notes: TEST_URL,
            zipCode: '97015'
        });

        const res = await fetch(ENDPOINT, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: payload
        });

        console.log(`\nHTTP Status: ${res.status}`);
        const text = await res.text();
        try {
            const json = JSON.parse(text);
            console.log('Result Success! Items count:', json.items?.length);
            if (json.items && json.items[0]) {
                const item = json.items[0];
                console.log('Title:', item.title || item.identity);
                console.log('Verdict:', item.purchase_strategy?.verdict);
                console.log('Asking Price:', item.purchase_strategy?.current_asking_price);
                console.log('Max Landed Cost:', item.purchase_strategy?.max_landed_cost);
                console.log('Boutique Estimate:', item.pricing_potential?.boutique || item.price_breakdown?.boutique_premium);
                console.log('Fair Estimate:', item.pricing_potential?.fair || item.price_breakdown?.fair);
                console.log('Best Platform:', item.market_report?.best_platform);
                console.log('Photos Count:', (item.fetched_images?.length || 0));
                console.log('Shipping Info:', JSON.stringify(item.shipping_info));
            }
        } catch (e) {
            console.log('Response (non-JSON):', text);
        }
    } catch (err) {
        console.error('Test failed:', err);
    }
}

runTest();
