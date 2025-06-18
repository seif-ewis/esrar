const Specialty = require('../models/specialty');
const mongoose = require('mongoose'); // Needed for ObjectId validation

const specialtyController = {
    // Get all specialties
    getAllSpecialties: async (req, res) => {
        try {
            const specialties = await Specialty.find();
            res.json(specialties);
        } catch (error) {
            console.error("Error fetching specialties:", error);
            res.status(500).json({ message: "Internal server error" });
        }
    },

    // Create a new specialty
    createSpecialty: async (req, res) => {
        try {
            const newSpecialty = new Specialty(req.body);
            await newSpecialty.save();
            res.status(201).json(newSpecialty);
        } catch (error) {
            console.error("Error creating specialty:", error);
            res.status(400).json({ message: "Failed to create specialty", error: error.message });
        }
    },

    // Get a single specialty by ID
    getSpecialtyById: async (req, res) => {
        try {
            const { id } = req.params;
            // Optional: Validate ID format
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: 'Invalid specialty ID format' });
            }

            const specialty = await Specialty.findById(id);
            if (!specialty) {
                return res.status(404).json({ message: 'Specialty not found' });
            }
            res.json(specialty);
        } catch (error) {
            console.error("Error fetching specialty by ID:", error);
            res.status(500).json({ message: 'Internal server error' });
        }
    },

    // Update a specialty by ID
    updateSpecialty: async (req, res) => {
        try {
            const { id } = req.params;
            const updatedData = req.body;

            // Optional: Validate ID format
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: 'Invalid specialty ID format for update' });
            }

            const updatedSpecialty = await Specialty.findByIdAndUpdate(id, updatedData, { new: true });
            if (!updatedSpecialty) {
                return res.status(404).json({ message: 'Specialty not found' });
            }
            res.status(200).json(updatedSpecialty);
        } catch (error) {
            console.error("Error updating specialty:", error);
            res.status(500).json({ message: 'Internal server error', error: error.message });
        }
    },

    // Delete a specialty by ID
    deleteSpecialty: async (req, res) => {
        const { id } = req.params;

        // Validate the format of the ID
        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ message: 'معرف العنصر غير صالح للحذف' });
        }

        try {
            const deleted = await Specialty.findByIdAndDelete(id);

            if (!deleted) {
                return res.status(404).json({ message: 'لم يتم العثور على التخصص' });
            }

            res.status(200).json({ message: 'تم حذف التخصص بنجاح' });
        } catch (err) {
            console.error("Error deleting specialty:", err);
            res.status(500).json({ message: 'خطأ في الخادم الداخلي', error: err.message });
        }
    }
};

module.exports = specialtyController;