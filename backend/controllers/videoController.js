// Replace the entire content of backend/controllers/videoController.js with this:

const Video = require('../models/video');
const mongoose = require('mongoose');

// GET ALL VIDEOS (with enhanced logging)

exports.getAllVideos = async (req, res) => {
  // --- DIAGNOSTIC LOGGING ---
  console.log('------------------------------------');
  console.log(`[videoController] Received request at: ${new Date().toLocaleTimeString()}`);
  console.log('[videoController] Full request query object:', req.query);
  // --- END LOGGING ---

  try {
    const filter = {};
    const { courseId, accessibilityNeed } = req.query; // Get both params from the request

    // Filter by Course ID if it exists
    if (courseId && mongoose.Types.ObjectId.isValid(courseId)) {
      filter.courseId = courseId;
    }

    // --- THIS IS THE FIX ---
    // If an accessibilityNeed is provided in the request, apply this filter
    if (accessibilityNeed) {
      // This tells the database: "Find videos where the accessibilityNeed is EITHER the
      // specific one requested (e.g., 'colorblind') OR 'general'".
      filter.accessibilityNeed = { $in: [accessibilityNeed, 'general'] };
    }

    const videos = await Video.find(filter).populate('courseId');
    
    console.log(`[videoController] Database query with filter returned ${videos.length} videos.`);
    console.log('------------------------------------\n');

    res.json(videos);

  } catch (err) {
    console.error('[videoController] An error occurred in getAllVideos:', err);
    res.status(500).json({ message: 'Failed to fetch videos', error: err.message });
  }
};
// GET A SINGLE VIDEO BY ITS ID
exports.getVideoById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Video ID format' });
        }
        const video = await Video.findById(id).populate('courseId');
        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }
        res.status(200).json(video);
    } catch (err) {
        console.error('Error in getVideoById:', err);
        res.status(500).json({ message: 'Failed to fetch video', error: err.message });
    }
};

// CREATE A NEW VIDEO
exports.createVideo = async (req, res) => {
  try {
    const newVideo = new Video(req.body);
    await newVideo.save();
    const populatedVideo = await Video.findById(newVideo._id).populate('courseId');
    res.status(201).json(populatedVideo);
  } catch (err) {
    res.status(400).json({ message: 'Failed to create video', error: err.message });
  }
};

// UPDATE A VIDEO
exports.updateVideo = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Video ID format' });
        }
        
        // This explicitly includes accessibilityNeed from the request body
        const updatedVideo = await Video.findByIdAndUpdate(id, req.body, { new: true, runValidators: true }).populate('courseId');
        
        if (!updatedVideo) {
            return res.status(404).json({ message: 'Video not found' });
        }
        res.status(200).json(updatedVideo);
    } catch (err) {
        res.status(400).json({ message: 'Failed to update video', error: err.message });
    }
};

// DELETE A VIDEO
exports.deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid Video ID format' });
    }
    const deletedVideo = await Video.findByIdAndDelete(id);
    if (!deletedVideo) {
      return res.status(404).json({ message: 'Video not found' });
    }
    res.status(200).json({ message: 'Video deleted successfully' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete video', error: err.message });
  }
};
