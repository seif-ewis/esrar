const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
// Import the new getVideoById function
const { 
    getAllVideos, 
    getVideoById, 
    createVideo, 
    deleteVideo, 
    updateVideo 
} = require('../controllers/videoController');

// Handles GET request to /api/videos (with optional filtering)
router.get('/', getAllVideos);

// --- NEW ROUTE ADDED HERE ---
// Handles GET request to /api/videos/:id
router.get('/:id', getVideoById);

// Handles POST request to /api/videos
router.post('/',auth, createVideo);

// Handles PUT request to /api/videos/:id
router.put('/:id',auth, updateVideo);

// Handles DELETE request to /api/videos/:id
router.delete('/:id',auth, deleteVideo);

module.exports = router;
