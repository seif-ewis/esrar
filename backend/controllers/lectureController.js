const Lecture = require('../models/lecture');
const mongoose = require('mongoose');
// --- CORRECTED IMPORT: Import the specific classes we need ---
const { UploadManager, FileApi } = require("@bytescale/sdk");

// --- CORRECTED INITIALIZATION: Create an instance for both uploading and file management ---
const uploadManager = new UploadManager({
  apiKey: process.env.BYTESCALE_API_KEY
});

const fileApi = new FileApi({
  apiKey: process.env.BYTESCALE_API_KEY
});

const bytescaleAccountId = process.env.BYTESCALE_ACCOUNT_ID;

// --- CORRECTED CREATE FUNCTION ---

exports.createLecture = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Lecture audio file is required.' });
    }

    const { fileUrl, filePath } = await uploadManager.upload({
      data: req.file.buffer,
      originalFileName: req.file.originalname,
    });

    // Get all fields from the body, including accessibilityNeed
    const { courseId, title, description, duration, accessibilityNeed } = req.body; 
    
    const newLecture = new Lecture({
      courseId, title, description, duration, accessibilityNeed, // <-- Ensure it's included here
      fileUrl: fileUrl,
      filePath: filePath
    });

    await newLecture.save();
    
    const populatedLecture = await Lecture.findById(newLecture._id).populate('courseId');
    res.status(201).json(populatedLecture);

  } catch (err) {
    console.error("Error during Bytescale lecture upload:", err);
    res.status(500).json({ message: 'Failed to upload file.', error: err.message });
  }
};
// --- CORRECTED DELETE FUNCTION ---

exports.deleteLecture = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }

    const lectureToDelete = await Lecture.findById(id);
    if (!lectureToDelete) {
      return res.status(404).json({ message: 'Lecture not found' });
    }

    if (lectureToDelete.filePath) {
        // Use the fileApi to delete the file with your specific accountId
        await fileApi.deleteFile({
    accountId: bytescaleAccountId, // Use the variable
    filePath: lectureToDelete.filePath
        });
        console.log(`Successfully deleted file from Bytescale: ${lectureToDelete.filePath}`);
    }

    await Lecture.findByIdAndDelete(id);

    res.status(200).json({ message: 'Lecture deleted successfully' });

  } catch(err) {
    console.error("Error during lecture deletion:", err);
    res.status(500).json({ message: 'Failed to delete lecture', error: err.message });
  }
};

// --- Other functions remain the same ---

exports.getAllLectures = async (req, res) => {
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

    const lectures = await Lecture.find(filter).populate('courseId');
    res.json(lectures);
  } catch (err) { 
      res.status(500).json({ message: 'Failed to fetch lectures', error: err.message });
  }
};

exports.getLectureById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ message: 'Invalid ID' });
    const lecture = await Lecture.findById(id).populate('courseId');
    if (!lecture) return res.status(404).json({ message: 'Not found' });
    res.status(200).json(lecture);
  } catch (err) { res.status(500).json({ message: 'Failed to fetch lecture', error: err.message }); }
};

// --- REWRITTEN UPDATE FUNCTION ---
exports.updateLecture = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid ID' });
    }
    
    // Explicitly copy all text fields from the request body
    const updateData = { ...req.body };

    // Check if a new file has been uploaded
    if (req.file) {
      const existingLecture = await Lecture.findById(id);

      const { fileUrl, filePath } = await uploadManager.upload({
        data: req.file.buffer,
        originalFileName: req.file.originalname
      });

      updateData.fileUrl = fileUrl;
      updateData.filePath = filePath;

      if (existingLecture && existingLecture.filePath) {
        await fileApi.deleteFile({
    accountId: bytescaleAccountId, // Use the variable
    filePath: existingLecture.filePath
        });
      }
    }
    
    const updatedLecture = await Lecture.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate('courseId');

    if (!updatedLecture) {
      return res.status(404).json({ message: 'Not found' });
    }
    
    res.status(200).json(updatedLecture);
  } catch (err) {
    console.error("Error updating lecture:", err);
    res.status(400).json({ message: 'Failed to update lecture', error: err.message });
  }
};