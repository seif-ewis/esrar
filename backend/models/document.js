// backend/models/document.js

const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  title: String,
  description: String,
  fileUrl: String,
  filePath: String,
  courseId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Course'
  },
  type: String,
  accessibilityNeed: {
    type: String,
    enum: ['general', 'colorBlindness', 'deaf', 'blind', 'hyperopia', 'myopia', 'dyslexia'],
    default: 'general'
  }
}, {
  timestamps: true // This automatically adds createdAt and updatedAt
});

module.exports = mongoose.model('Document', documentSchema);