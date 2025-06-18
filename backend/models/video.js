// backend/models/video.js

const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema({
  title: String,
  description: String,
  url: String,
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  duration: Number,
  accessibilityNeed: {
    type: String,
    enum: ['general', 'colorBlindness', 'deaf', 'blind', 'hyperopia', 'myopia', 'dyslexia'],
    default: 'general'
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('Video', videoSchema);