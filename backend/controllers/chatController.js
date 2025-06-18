// backend/controllers/chatController.js

const { GoogleGenerativeAI } = require("@google/generative-ai");
const { MongoClient } = require("mongodb");
const { marked } = require("marked"); // ✅ Add this for Markdown to HTML conversion

// --- Configuration ---
const DB_URI = process.env.MONGO_URI;
const DB_NAME = "educational-cms";
const DOC_EMBEDDINGS_COLLECTION = "doc_embeddings";
const VECTOR_INDEX_NAME = "vector_index";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const embeddingModel = genAI.getGenerativeModel({ model: "embedding-001" });
const generativeModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

exports.generateChatResponse = async (req, res) => {
  const client = new MongoClient(DB_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const collection = db.collection(DOC_EMBEDDINGS_COLLECTION);

    const { message } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "رسالة غير صالحة" });
    }

    // Friendly shortcut for greetings or identity questions
    const lowerMsg = message.trim().toLowerCase();
    if (
      ["hi", "hello", "مرحبا", "اهلا", "السلام عليكم", "ما اسمك", "من أنشأك", "من انت"].some((greet) =>
        lowerMsg.includes(greet)
      )
    ) {
      return res.json({
        reply: `<div class="bot-message">
          <p>👋 مرحبًا! أنا <strong>مساعدك الذكي</strong> المصمم لمساعدتك في الدراسة والبحث.</p>
          <p>اسألني عن أي موضوع أو ارفع ملفًا وسأقوم بمساعدتك بناءً على محتواه. 😊</p>
        </div>`,
      });
    }

    // Create embedding from user message
    const queryEmbedding = await embeddingModel.embedContent(message);

    // Vector search in MongoDB Atlas
    const searchResults = await collection
      .aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: "embedding",
            queryVector: queryEmbedding.embedding.values,
            numCandidates: 100,
            limit: 5,
          },
        },
      ])
      .toArray();

    const matchedDocs = searchResults
      .filter((doc) => doc.text && doc.metadata && doc.metadata.source)
      .map((doc) => ({
        title: doc.metadata.source,
        content: doc.text,
      }));

    const context = matchedDocs
      .map((doc) => `🔹 <strong>${doc.title}</strong><br>${doc.content}`)
      .join("<br><br>-----------------------------<br><br>");

    const prompt = `
أنت مساعد ذكي وودود، هدفك مساعدة المستخدمين بطريقة تفاعلية.
إذا كان السؤال شخصيًا أو عامًا مثل "ما اسمك؟" أو "كيف حالك؟"، أجب بشكل طبيعي.
أما إذا كان السؤال يعتمد على محتوى المستندات، فاستعن بالمحتوى التالي:

${matchedDocs.length ? context : "⚠️ لا توجد مستندات مرتبطة حالياً"}

❓ <strong>سؤال المستخدم:</strong>
${message}
`;

    const result = await generativeModel.generateContent(prompt);
    const rawReply = result.response.text();
    const html = marked.parse(rawReply); // ✅ Markdown → HTML

    // Wrap the reply in a styled container
    const styledReply = `
      <div class="bot-message">
        <div class="ai-reply">${html}</div>
        ${
          matchedDocs.length
            ? `<hr><p class="source-info">📄 تم استخدام ${matchedDocs.length} وثيقة في هذه الإجابة.</p>`
            : ""
        }
      </div>
    `;

    res.json({ reply: styledReply });
  } catch (error) {
    console.error("Error in chat AI controller:", error);
    res.status(500).json({
      error: "حدث خطأ أثناء محاولة الإجابة. الرجاء المحاولة لاحقًا.",
    });
  } finally {
    await client.close();
  }
};
