async function run() {
  const targetUrl = "https://hibid.com/lot/305782240/bellatrix-lestrange-dark-witch-dagger-harry-potter?ref=catalog";
  const pageRes = await fetch(targetUrl, { 
      headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' 
      } 
  });
  console.log("Status:", pageRes.status);
  const html = await pageRes.text();
  
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  console.log("OG Title:", ogTitleMatch ? ogTitleMatch[1] : "No match");

  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  console.log("OG Image:", ogImageMatch ? ogImageMatch[1] : "No match");
  
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  console.log("Title Match:", titleMatch ? titleMatch[1] : "No match");
  
  console.log("HTML Start:", html.substring(0, 300));
}
run();
