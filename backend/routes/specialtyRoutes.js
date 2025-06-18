const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const specialtyController = require('../controllers/specialtyController'); // Import the controller

// GET all specialties
router.get('/', specialtyController.getAllSpecialties);

// POST new specialty
router.post('/',auth, specialtyController.createSpecialty);

// GET a single specialty by ID
router.get('/:id', specialtyController.getSpecialtyById);

// PUT route for updating specialties
router.put('/:id',auth, specialtyController.updateSpecialty);

// DELETE route for specialties
router.delete('/:id',auth, specialtyController.deleteSpecialty);

module.exports = router;