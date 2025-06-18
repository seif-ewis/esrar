const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // ✅ already done
const userController = require('../controllers/userController');


// Protected: Only logged-in users with a valid JWT can access these

router.get('/', auth, userController.getAllUsers);       // List all users
router.get('/:id', auth, userController.getUserById);    // Get single user
router.post('/', auth, userController.createUser);       // Create user
router.put('/:id', auth, userController.updateUser);     // Update user
router.delete('/:id', auth, userController.deleteUser);  // Delete user

module.exports = router;
