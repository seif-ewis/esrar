// backend/controllers/courseController.js

const Course = require('../models/Course');
const mongoose = require('mongoose');

// Get all courses, with optional filtering by specialtyId
exports.getAllCourses = async (req, res) => {
    // DEBUG STEP 1: Log the exact query received from the frontend.
    console.log(`[Controller] Received request for courses. Query:`, req.query);

    try {
        const { specialtyId } = req.query;
        const filter = {};

        // Check if a specialtyId was provided and is a valid string
        if (specialtyId && specialtyId !== 'undefined' && specialtyId !== 'null') {
            
            // DEBUG STEP 2: Log that we are attempting to apply the filter.
            console.log(`[Controller] Attempting to filter by specialtyId: ${specialtyId}`);

            if (!mongoose.Types.ObjectId.isValid(specialtyId)) {
                console.log(`[Controller] Invalid specialtyId format. Returning empty array.`);
                return res.json([]);
            }
            // This is the line that applies the filter to the database query
            filter.specialtyId = specialtyId;

        } else {
             // DEBUG STEP 3: Log if we are fetching all courses because no valid ID was found.
             console.log(`[Controller] No valid specialtyId provided. Fetching all courses.`);
        }

        const courses = await Course.find(filter).populate('specialtyId');
        
        // DEBUG STEP 4: Log how many courses were found after the query.
        console.log(`[Controller] Found ${courses.length} courses matching the filter.`);

        res.json(courses);

    } catch (err) {
        console.error('[Controller] Error in getAllCourses:', err);
        res.status(500).json({ message: 'Failed to fetch courses', error: err.message });
    }
};


// --- The rest of your functions remain unchanged ---

// Get a single course by its ID
exports.getCourseById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Course ID format' });
        }

        const course = await Course.findById(id).populate('specialtyId');
        
        if (!course) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json(course);
    } catch (err) {
        console.error('Error in getCourseById:', err);
        if (err.name === 'CastError') { 
            return res.status(400).json({ message: 'Invalid Course ID format (CastError)' });
        }
        res.status(500).json({ message: 'Failed to fetch course', error: err.message });
    }
};

// Create a new course
exports.createCourse = async (req, res) => {
    try {
        const newCourse = new Course(req.body);
        await newCourse.save();
        const populatedCourse = await Course.findById(newCourse._id).populate('specialtyId');
        res.status(201).json(populatedCourse);
    } catch (err) {
        console.error('Error in createCourse:', err);
        if (err.name === 'ValidationError') {
            return res.status(400).json({ message: err.message, errors: err.errors });
        }
        res.status(500).json({ message: 'Failed to add course', error: err.message });
    }
};


// Add this new function to courseController.js
exports.updateCourse = async (req, res) => {
    try {
        const { id } = req.params;
        const updatedData = req.body;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Course ID format' });
        }

        const updatedCourse = await Course.findByIdAndUpdate(id, updatedData, { new: true, runValidators: true }).populate('specialtyId');

        if (!updatedCourse) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json(updatedCourse);
    } catch (err) {
        console.error('Error in updateCourse:', err);
        res.status(500).json({ error: err.message || 'Server error during course update' });
    }
};

// Delete a course by ID
exports.deleteCourse = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'Invalid Course ID format' });
        }

        const deletedCourse = await Course.findByIdAndDelete(id);
        if (!deletedCourse) {
            return res.status(404).json({ message: 'Course not found' });
        }
        res.status(200).json({ message: 'Course deleted successfully' });
    } catch (err) {
        console.error('Error in deleteCourse:', err);
        res.status(500).json({ message: 'Failed to delete course', error: err.message });
    }
};
