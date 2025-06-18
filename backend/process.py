import os
import fitz  # PyMuPDF
import re
import google.generativeai as genai
from dotenv import load_dotenv
from pymongo import MongoClient

# --- Configuration ---
DOCS_FOLDER = os.path.join(os.path.dirname(__file__), '../documents')
PDF_FILE_NAME = "seif cv.pdf"
# ---------------------

def sanitize_text(text):
    """A very aggressive text cleaning function."""
    text = re.sub(r'[^\x20-\x7E\n\r\t]', ' ', text)
    text = re.sub(r'\s+', ' ', text)
    return text.strip()

def chunk_text(text, chunk_size=1000, overlap=100):
    """Splits text into chunks of a specified size."""
    chunks = []
    for i in range(0, len(text), chunk_size - overlap):
        chunks.append(text[i:i + chunk_size])
    return chunks

# --- Main Execution ---
print("--- Starting Full Processing Pipeline ---")

# 1. Load Environment Variables (.env file)
load_dotenv()
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY')
MONGO_URI = os.getenv('MONGO_URI')
DB_NAME = "educational-cms"
DOC_EMBEDDINGS_COLLECTION = "doc_embeddings"

if not GEMINI_API_KEY or not MONGO_URI:
    print("❌ ERROR: GEMINI_API_KEY or MONGO_URI not found in .env file.")
    exit()

# 2. Connect to MongoDB
print("Connecting to MongoDB...")
try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    collection = db[DOC_EMBEDDINGS_COLLECTION]
    # Clear old embeddings for this document
    collection.delete_many({"sourceTitle": PDF_FILE_NAME})
    print("✅ Successfully connected to MongoDB and cleared old entries.")
except Exception as e:
    print(f"❌ ERROR: Could not connect to MongoDB. {e}")
    exit()

# 3. Configure Google AI Client
genai.configure(api_key=GEMINI_API_KEY)

# 4. Extract and Sanitize Text from PDF
pdf_path = os.path.join(DOCS_FOLDER, PDF_FILE_NAME)
print(f"Reading and cleaning text from '{PDF_FILE_NAME}'...")
try:
    doc = fitz.open(pdf_path)
    full_text = ""
    for page in doc:
        full_text += page.get_text()
    doc.close()
    clean_text = sanitize_text(full_text)
    print("✅ Text successfully extracted and sanitized.")
except Exception as e:
    print(f"❌ ERROR: Could not read the PDF file. {e}")
    exit()

# 5. Chunk the text
text_chunks = chunk_text(clean_text)
print(f"✅ Text was split into {len(text_chunks)} chunks.")

# 6. Embed chunks and store them in MongoDB
print("--- Sending chunks to Google AI and saving to MongoDB... ---")
all_embeddings_successful = True
for i, chunk in enumerate(text_chunks):
    try:
        result = genai.embed_content(
            model="models/text-embedding-004",
            content=chunk,
            task_type="RETRIEVAL_DOCUMENT"
        )
        
        # Create the document to insert into the database
        document = {
            "sourceTitle": PDF_FILE_NAME,
            "text": chunk,
            "embedding": result['embedding']
        }
        collection.insert_one(document)
        print(f"✅ Successfully processed and stored chunk #{i + 1}")

    except Exception as e:
        print(f"❌ FAILED to process chunk #{i + 1}. Error: {e}")
        all_embeddings_successful = False
        break

if all_embeddings_successful:
    print("\n🎉 Mission Accomplished! The entire process is complete and data is in your database.")