async function run() {
  const targetUrl = "https://ctbids.com/estate-sale/45868/item/5299489/Vintage-Hunter-Tooled-Black-Leather-Knife-Sheath-Belt-Set-Size-3";
  const pageRes = await fetch(targetUrl, { 
      headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36' 
      } 
  });
  const html = await pageRes.text();
  
  const ogTitleMatch = html.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:title["']/i);
  console.log("OG Title:", ogTitleMatch ? ogTitleMatch[1] : "No match");

  const ogImageMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  console.log("OG Image:", ogImageMatch ? ogImageMatch[1] : "No match");
}
run();
