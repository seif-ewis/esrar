// backend/models/Course.js

const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
    name: { 
        type: String, 
        required: [true, 'Course name is required'], // Added custom error message
        trim: true // Remove whitespace from both ends of a string
    }, 
    description: {
        type: String,
        default: '' // Ensure description is always a string, even if empty
    },
    icon: { // Assuming 'icon' is a path or name of an icon
        type: String,
        default: ''
    }, 
    specialtyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Specialty', // This should match the name of your Specialty model
        required: [true, 'Specialty ID is required for a course']
    }
}, { 
    timestamps: true // Adds createdAt and updatedAt fields automatically
});

// Create and export the Course model
module.exports = mongoose.model('Course', courseSchema);