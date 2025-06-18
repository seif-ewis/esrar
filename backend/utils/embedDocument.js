// backend/utils/embedDocument.js

const axios = require('axios');
const pdfParse = require('pdf-parse');
// ✅ Use the same GoogleGenerativeAI library as your chat controller
const { GoogleGenerativeAI } = require("@google/generative-ai"); 
const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');
dotenv.config();

// ✅ Use consistent variable names that match your chat controller
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = 'educational-cms';
const DOC_EMBEDDINGS_COLLECTION = 'doc_embeddings';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ✅ Initialize the model exactly as you do in chatController.js
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });

async function downloadPDF(url) {
  const response = await axios.get(url, { responseType: 'arraybuffer' });
  return response.data;
}

function chunkText(text, chunkSize = 1000, overlap = 100) {
  const chunks = [];
  for (let i = 0; i < text.length; i += chunkSize - overlap) {
    chunks.push(text.slice(i, i + chunkSize));
  }
  return chunks;
}

async function embedDocument({ title, fileUrl }) {
  const pdfBuffer = await downloadPDF(fileUrl);
  const data = await pdfParse(pdfBuffer);
  const rawText = data.text;
  const chunks = chunkText(rawText);

  const client = new MongoClient(MONGO_URI);
  
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(DOC_EMBEDDINGS_COLLECTION);
    
    for (const chunk of chunks) {
      // ✅ Use the new model to create the embedding
      const result = await embeddingModel.embedContent(chunk);
      const embedding = result.embedding; // The embedding object from the new library

      // ✅ Store the vector from 'embedding.values' to match the chat controller's query
      await collection.insertOne({
        text: chunk, // Changed from 'content' to 'text' to match chat controller's filter
        metadata: { source: title },
        embedding: embedding.values // Store the raw vector array
      });
    }
    
    console.log(`[✔] Embedded and saved ${chunks.length} chunks from: ${title}`);

  } catch (error) {
    console.error(`[❌] Error during document embedding for ${title}:`, error);
  } finally {
    await client.close();
  }
}

module.exports = embedDocument;