// models/visitModel.js
const mongoose = require('mongoose');

const VisitSchema = new mongoose.Schema({
    timestamp: {
        type: Date,
        default: Date.now
    },
    // Optional: You could add more details here later
    // page: { type: String }, 
    // userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

module.exports = mongoose.model('Visit', VisitSchema);