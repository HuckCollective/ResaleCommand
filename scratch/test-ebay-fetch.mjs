async function testAllOrigins() {
    try {
        console.log("Fetching httpbin.org/ip via AllOrigins...");
        const res = await fetch("https://api.allorigins.win/get?url=" + encodeURIComponent("https://httpbin.org/ip"));
        console.log("Status:", res.status, res.statusText);
        const data = await res.json();
        console.log("Response contents:", data.contents);
    } catch (e) {
        console.error("AllOrigins error:", e);
    }
}

testAllOrigins();
