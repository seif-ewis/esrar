require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./db');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());

// Serves static files from the 'public' folder
app.use(express.static(path.join(__dirname, '../public')));

connectDB();

// API Route Imports
const authRoutes = require('./routes/authRoutes');
const chatRoutes = require('./routes/chatRoutes');
const courseRoutes = require('./routes/courseRoutes');
const documentRoutes = require('./routes/documentRoutes');
const lectureRoutes = require('./routes/lectureRoutes');
const specialtyRoutes = require('./routes/specialtyRoutes');
const userRoutes = require('./routes/userRoutes');
const videoRoutes = require('./routes/videoRoutes');
const visitRoutes = require('./routes/visitRoutes');

// API Route Usage
app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/lectures', lectureRoutes);
app.use('/api/specialties', specialtyRoutes);
app.use('/api/users', userRoutes);
app.use('/api/videos', videoRoutes);
app.use('/api/visits', visitRoutes);


// --- THIS IS THE CRUCIAL ADDITION ---
// This catch-all route handles direct navigation and page refreshes.
// It sends the main HTML file, allowing your frontend routing to take over.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/login.html'));
});
// --- END OF ADDITION ---


// Server Start
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));