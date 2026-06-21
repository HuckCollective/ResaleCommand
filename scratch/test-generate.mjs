import { Client, Databases, Storage } from 'node-appwrite';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { Buffer } from 'node:buffer';
import dotenv from 'dotenv';
dotenv.config();

// Initialize Appwrite
const client = new Client()
  .setEndpoint(process.env.PUBLIC_APPWRITE_ENDPOINT)
  .setProject(process.env.PUBLIC_APPWRITE_PROJECT_ID);
  // .setKey(process.env.APPWRITE_API_KEY);

const databases = new Databases(client);
const storage = new Storage(client);

const DB_ID = process.env.PUBLIC_APPWRITE_DB_ID || 'resale_db';
let COLLECTION_ID = process.env.PUBLIC_APPWRITE_COLLECTION_ID || 'items_dev';
const ALPHA_COLLECTION_ID = process.env.PUBLIC_APPWRITE_ALPHA_COLLECTION_ID || 'items_dev';
const BUCKET_ID = process.env.PUBLIC_APPWRITE_BUCKET_ID || 'item_images';

const itemId = '69b1f7760026d8febdbf'; // Test Item ID

async function run() {
  try {
    console.log(`[Test] fetching item document for id: ${itemId}`);
    let item = await databases.getDocument(DB_ID, COLLECTION_ID, itemId);
    console.log(`[Test] Fetched item: "${item.title}"`);

    const imageIds = [];
    if (item.imageId) imageIds.push(item.imageId);
    if (item.galleryImageIds && Array.isArray(item.galleryImageIds)) {
      imageIds.push(...item.galleryImageIds);
    }

    console.log(`[Test] Downloading ${imageIds.length} images...`);
    const imageParts = await Promise.all(imageIds.map(async (id) => {
      try {
        const buffer = await storage.getFileDownload(BUCKET_ID, id);
        return {
          inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: 'image/jpeg'
          }
        };
      } catch (e) {
        console.error(`[Test] Failed to download image ${id}:`, e.message);
        return null;
      }
    }));

    const validImageParts = imageParts.filter(p => p !== null);
    console.log(`[Test] Downloaded ${validImageParts.length} valid images`);

    // Call Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Missing GEMINI_API_KEY");
    }
    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = "gemini-2.5-flash";
    console.log(`[Test] Initializing model: ${modelName}`);
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: "You are a master appraiser."
    });

    const prompt = `
    You are an expert eBay reseller. Write a compelling, SEO-friendly product description for this item${validImageParts.length > 0 ? ' based on the provided photos.' : '.'}
    
    Item Title: ${item.title}
    Brand/Keywords: ${item.keywords || 'N/A'}
    Details: ${item.conditionNotes || 'N/A'}
    
    The description MUST be written in plain text (no HTML, no Markdown) and include:
    - A catchy headline.
    - Key features bullet points.
    - Condition assessment.
    
    CRITICAL: Return ONLY the plain text string. Do NOT wrap the output in any code blocks.
    `;

    console.log(`[Test] Generating content via Gemini...`);
    const result = await model.generateContent([prompt, ...validImageParts]);
    const response = await result.response;
    const text = response.text();
    console.log(`[Test] Gemini text returned successfully! Length: ${text.length}`);
    console.log(text.substring(0, 500) + "...\n");

    console.log(`[Test] Attempting database update without API key...`);
    try {
      await databases.updateDocument(DB_ID, COLLECTION_ID, itemId, {
        marketDescription: text
      });
      console.log(`[Test] Database update succeeded!`);
    } catch (e) {
      console.error(`[Test] Database update failed (expected if guest cannot write):`, e.message);
    }
  } catch (err) {
    console.error("❌ Test failed with error:", err);
  }
}

run();
