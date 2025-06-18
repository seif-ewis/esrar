// routes/visitRoutes.js
const express = require('express');
const router = express.Router();
const Visit = require('../models/visitModel');

// @route   POST /api/visits/log
// @desc    Log a new visit
// @access  Public
router.post('/log', async (req, res) => {
    try {
        const newVisit = new Visit();
        await newVisit.save();
        res.status(201).json({ message: 'Visit logged successfully.' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/visits/stats
// @desc    Get visit statistics for the last 30 days
// @access  Public (or Admin in a real app)
router.get('/stats', async (req, res) => {
    try {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const stats = await Visit.aggregate([
            {
                $match: {
                    timestamp: { $gte: thirtyDaysAgo }
                }
            },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } },
                    count: { $sum: 1 }
                }
            },
            {
                $sort: { _id: 1 } // Sort by date ascending
            }
        ]);
        
        res.json(stats);

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;