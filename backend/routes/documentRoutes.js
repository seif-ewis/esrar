const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer'); // We need to import multer
const {
    getAllDocuments,
    getDocumentById,
    createDocument,
    updateDocument,
    deleteDocument
} = require('../controllers/documentController');

// --- Multer Configuration for Cloudinary ---
// We use 'memoryStorage' to temporarily hold the file in the server's memory
// before we send it to Cloudinary. We are no longer saving it to a local folder.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });



// Route to get all documents (stays the same)
router.get('/',auth, getAllDocuments);

// --- MODIFIED ROUTE ---
router.post('/',auth, upload.single('documentFile'), createDocument);

// Route to get a single document by its ID (stays the same)
router.get('/:id', getDocumentById);

// Route to update a document by its ID (stays the same)
router.put('/:id',auth, upload.single('documentFile'), updateDocument);

// Route to delete a document by its ID (stays the same)
router.delete('/:id',auth, deleteDocument);

module.exports = router;
