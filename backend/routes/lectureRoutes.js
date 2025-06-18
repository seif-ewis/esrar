const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const multer = require('multer'); // We need to import multer

// Import all the necessary controller functions
const {
    getAllLectures,
    getLectureById,
    createLecture,
    updateLecture,
    deleteLecture
} = require('../controllers/lectureController');


// --- Multer Configuration for Cloudinary ---
// We use 'memoryStorage' to hold the file in memory before uploading.
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });


// --- Route Definitions ---

// GET all lectures (stays the same)
router.get('/', getAllLectures);

// GET a single lecture by ID (stays the same)
router.get('/:id', getLectureById);

// --- MODIFIED ROUTE ---
// The 'upload.single('lectureFile')' part is the new middleware.
// It will process an audio file uploaded in a form field named 'lectureFile'.
router.post('/',auth, upload.single('lectureFile'), createLecture);

// PUT (update) a lecture by ID (stays the same)
router.put('/:id',auth, upload.single('lectureFile'), updateLecture);

// DELETE a lecture by ID (stays the same)
router.delete('/:id',auth, deleteLecture);

module.exports = router;
