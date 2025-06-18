const express = require('express');
const router = express.Router();
const chatController = require('../controllers/chatController');// This defines the route: POST /api/chat
router.post('/', chatController.generateChatResponse);

module.exports = router;