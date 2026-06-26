import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY in environment!");
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    tools: [{ googleSearch: {} }]
});

async function runTest() {
    const targetUrl = 'https://www.ebay.com/itm/236889112802';
    const prompt = `
Please find the details of this eBay listing: ${targetUrl}

Tell me:
1. Title
2. Price
3. Shipping cost
4. Description or list of books
5. Image URLs if any
`;
    try {
        console.log("Calling Gemini with search grounding...");
        const result = await model.generateContent({
            contents: [{ role: 'user', parts: [{ text: prompt }] }]
        });
        
        const response = result.response;
        console.log("Response text:");
        console.log(response.text());
        
        // Print grounding metadata if available
        if (response.candidates?.[0]?.groundingMetadata) {
            console.log("\nGrounding Metadata:");
            console.log(JSON.stringify(response.candidates[0].groundingMetadata, null, 2));
        }
    } catch (e) {
        console.error("Gemini Error:", e);
    }
}

runTest();
