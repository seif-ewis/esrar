// backend/routes/courseRoutes.js

const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // ✅ JWT middleware

const { 
    getAllCourses, 
    createCourse, 
    deleteCourse, 
    getCourseById,
    updateCourse 
} = require('../controllers/courseController');

// 📖 Public: Students can view course listings
router.get('/', getAllCourses);
router.get('/:id', getCourseById);

// 🔐 Protected: Only logged-in users can create/update/delete
router.post('/', auth, createCourse);
router.put('/:id', auth, updateCourse);
router.delete('/:id', auth, deleteCourse);

module.exports = router;
