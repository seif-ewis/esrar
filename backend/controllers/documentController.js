const Document = require('../models/document');
const mongoose = require('mongoose');
const { UploadManager, FileApi } = require("@bytescale/sdk");
const embedDocument = require('../utils/embedDocument');
const { MongoClient } = require('mongodb');

const uploadManager = new UploadManager({
  apiKey: process.env.BYTESCALE_API_KEY 
});

const fileApi = new FileApi({
  apiKey: process.env.BYTESCALE_API_KEY
});
const bytescaleAccountId = process.env.BYTESCALE_ACCOUNT_ID;

// --- CORRECTED CREATE FUNCTION ---

exports.createDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Document file is required.' });
    }

    const { fileUrl, filePath } = await uploadManager.upload({
      data: req.file.buffer,
      originalFileName: req.file.originalname,
    });

    const { courseId, title, description, type, accessibilityNeed } = req.body;

    const newDocument = new Document({
      courseId,
      title,
      description,
      type,
      accessibilityNeed,
      fileUrl,
      filePath
    });

    await newDocument.save();

    // --- CORRECT AUTOMATION STEP ---
    // This is the only call needed to process the document for the AI.
    // It runs in the background so the user gets a fast response.
    embedDocument({
      title: newDocument.title,
      fileUrl: newDocument.fileUrl
    })
    .then(() => console.log(`[✔] Document embedding started for: ${newDocument.title}`))
    .catch(err => console.error(`[❌] Document embedding failed for: ${newDocument.title}`, err));
    
    // The redundant 'exec' block for process.py has been removed.

    const populatedDocument = await Document.findById(newDocument._id).populate('courseId');
    res.status(201).json(populatedDocument);

  } catch (err) {
    console.error("Error during Bytescale document upload:", err);
    res.status(500).json({ message: 'Failed to upload file.', error: err.message });
  }
};


// --- CORRECTED DELETE FUNCTION ---
exports.deleteDocument = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);

  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const docToDelete = await Document.findById(id);
    if (!docToDelete) {
      return res.status(404).json({ message: 'Document not found' });
    }

    // --- DIAGNOSTIC LOGGING ---
    console.log(`--- Deletion Process Started for Document ID: ${id} ---`);
    console.log(`Document Title to Delete: "${docToDelete.title}"`);

    await client.connect();
    const db = client.db('educational-cms');
    const embeddingsCollection = db.collection('doc_embeddings');

    // The query we are sending to MongoDB
    const deleteQuery = { "metadata.source": docToDelete.title };
    console.log('Running deleteMany on embeddings with query:', JSON.stringify(deleteQuery));

    const deleteResult = await embeddingsCollection.deleteMany(deleteQuery);
    
    // This log is the most important one.
    console.log(`[✔] MongoDB Query Complete. Embeddings deleted: ${deleteResult.deletedCount}`);
    // --- END DIAGNOSTIC LOGGING ---

    if (docToDelete.filePath) {
      await fileApi.deleteFile({
        accountId: bytescaleAccountId,
        filePath: docToDelete.filePath
      });
      console.log(`Successfully deleted file from Bytescale: ${docToDelete.filePath}`);
    }

    await Document.findByIdAndDelete(id);

    res.status(200).json({ message: 'Document and its embeddings deleted successfully' });

  } catch(err) {
    console.error("Error during document deletion:", err);
    res.status(500).json({ message: 'Failed to delete document', error: err.message });
  } finally {
    await client.close();
    console.log('--- Deletion Process Finished ---');
  }
};


// --- Other functions remain the same ---


exports.getAllDocuments = async (req, res) => {
  try {
    const filter = {};
    const { courseId, accessibilityNeed } = req.query; // Get both params

    if (req.query.courseId) {
        filter.courseId = req.query.courseId;
    }
    
    // --- THIS IS THE CRUCIAL FILTERING LOGIC ---
    if (accessibilityNeed) {
        filter.accessibilityNeed = { $in: [accessibilityNeed, 'general'] };
    }

    const documents = await Document.find(filter).populate('courseId');
    res.json(documents);
  } catch (err) { 
      res.status(500).json({ message: 'Failed to fetch documents', error: err.message });
  }
};

exports.getDocumentById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    const document = await Document.findById(id).populate('courseId');
    if (!document) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(document);
  } catch (err) { res.status(500).json({ message: 'Failed to fetch document', error: err.message }); }
};

// --- REWRITTEN UPDATE FUNCTION ---
exports.updateDocument = async (req, res) => {
  const client = new MongoClient(process.env.MONGO_URI);
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    // Get the document *before* the update to check its old title
    const existingDoc = await Document.findById(id);
    if (!existingDoc) {
      return res.status(404).json({ message: 'Document not found' });
    }
    const oldTitle = existingDoc.title;
    const newTitle = req.body.title;

    const updateData = { ...req.body };

    // If the title has changed, we must update the embeddings collection
    if (newTitle && newTitle !== oldTitle) {
      console.log(`Title changed from "${oldTitle}" to "${newTitle}". Updating embeddings...`);
      await client.connect();
      const db = client.db('educational-cms');
      const embeddingsCollection = db.collection('doc_embeddings');
      
      const updateResult = await embeddingsCollection.updateMany(
        { "metadata.source": oldTitle }, // Find documents with the OLD title
        { $set: { "metadata.source": newTitle } } // Set their source to the NEW title
      );

      console.log(`[✔] Updated ${updateResult.modifiedCount} embedding(s) with the new title.`);
    }

    if (req.file) {
      // Your existing file upload logic remains the same
      const { fileUrl, filePath } = await uploadManager.upload({
        data: req.file.buffer,
        originalFileName: req.file.originalname
      });
      updateData.fileUrl = fileUrl;
      updateData.filePath = filePath;
      if (existingDoc && existingDoc.filePath) {
        await fileApi.deleteFile({ accountId: bytescaleAccountId, filePath: existingDoc.filePath });
      }
      // If a new file is uploaded, you should re-embed the whole document
      embedDocument({ title: newTitle, fileUrl: fileUrl })
        .then(() => console.log(`[✔] Re-embedding started for updated document: ${newTitle}`))
        .catch(err => console.error(`[❌] Re-embedding failed for: ${newTitle}`, err));
    }

    const updatedDocument = await Document.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('courseId');

    res.status(200).json(updatedDocument);
  } catch (err) {
    console.error("Error updating document:", err);
    res.status(400).json({ message: 'Failed to update document', error: err.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
};