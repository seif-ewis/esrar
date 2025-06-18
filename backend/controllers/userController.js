const User = require('../models/user');

exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password'); // Exclude passwords from the result
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching users.', error: error.message });
  }
};

// controllers/userController.js



exports.getUserById = async (req, res) => {
  console.log(`Attempting to find user with ID: ${req.params.id}`); // <-- ADDED THIS LINE

  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      console.log(`User not found for ID: ${req.params.id}`); // <-- ADDED THIS LINE
      return res.status(404).json({ message: 'User not found' });
    }
    console.log(`Successfully found user: ${user.name}`); // <-- ADDED THIS LINE
    res.status(200).json(user);
  } catch (error) {
    // This will print the exact database error to your server console
    console.error('--- ERROR IN getUserById ---'); // <-- ADDED THIS LINE
    console.error(error); // <-- ADDED THIS LINE
    console.error('--------------------------'); // <-- ADDED THIS LINE
    res.status(500).json({ message: 'Error fetching user.', error: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if the user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }
    
    // Create the user with the PLAIN TEXT password.
    // The model's pre-save hook in `user.js` will automatically and correctly hash it.
    const user = new User({
      name,
      email,
      password, // Pass the plain password
      role,
      status: 'active'
    });

    await user.save();

    // Do not send the password back in the response
    const userResponse = user.toObject();
    delete userResponse.password;

    res.status(201).json(userResponse);

  } catch (error) {
    res.status(500).json({ message: 'Error creating user.', error: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const { name, email, password, role, status } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update fields from the request
    user.name = name || user.name;
    user.email = email || user.email;
    user.role = role || user.role;
    user.status = status || user.status;

    // Only update the password if a new one was provided
    if (password) {
      user.password = password; // Assign the new plain text password
    }

    const updatedUser = await user.save(); // The pre-save hook will hash the new password if it was changed

    const userResponse = updatedUser.toObject();
    delete userResponse.password;

    res.status(200).json(userResponse);

  } catch (error) {
    res.status(500).json({ message: 'Error updating user.', error: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user.', error: error.message });
  }
};
