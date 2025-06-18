// backend/models/lecture.js

const mongoose = require('mongoose');

const lectureSchema = new mongoose.Schema({
  title: String,
  description: String,
  duration: Number,
  fileUrl: String,
  filePath: String,
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  accessibilityNeed: {
    type: String,
    enum: ['general', 'colorBlindness', 'deaf', 'blind', 'hyperopia', 'myopia', 'dyslexia'],
    default: 'general'
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('Lecture', lectureSchema);