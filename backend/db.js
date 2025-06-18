const mongoose = require('mongoose');

const connectDB = async () => {
  // This will now ONLY use the connection string from your .env file.
  
  console.log("--- [server.js] is using this connection string: ---");
  console.log(process.env.MONGO_URI);
  
  const connectionString = process.env.MONGO_URI;

  if (!connectionString) {
    console.error('❌ FATAL ERROR: MONGO_URI is not defined in your .env file.');
    process.exit(1); // Exit if the key is not found
  }

  try {
    await mongoose.connect(connectionString);
    console.log('✅ MongoDB connected successfully');
  } catch (err) {
    console.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;