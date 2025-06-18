const mongoose = require('mongoose');

const specialtySchema = new mongoose.Schema({
  name: {
    type : String,
    required: true,
    trim : true,
  } ,
  description: String,
  icon: String
  
});

const Specialty = mongoose.model('Specialty', specialtySchema);

module.exports = Specialty;
