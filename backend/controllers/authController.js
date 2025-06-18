const User = require('../models/user');
const jwt = require('jsonwebtoken');

// --- User Registration ---
exports.register = async (req, res) => {
  try {
    let { name, email, password, role } = req.body; // Make role mutable

    // --- START: LOCKOUT PREVENTION LOGIC ---
    // Check if any user exists in the database.
    const userCount = await User.countDocuments();
    // If no users exist, this is the first registration, so force the role to 'admin'.
    if (userCount === 0) {
      role = 'admin';
      console.log('First user registration. Assigning admin role.');
    }
    // --- END: LOCKOUT PREVENTION LOGIC ---

    // 1. Check if user already exists
   const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'An account with this email already exists.' });
    }


    // 3. Create a new user instance with the HASHED password
   const newUser = new User({
      name,
      email,
      password, // Pass the plain password from the request
      role
    });

    // 4. Save the new user to the database
    await newUser.save();

    res.status(201).json({ message: 'User created successfully!', userId: newUser._id });

    } catch (err) {
    res.status(500).json({ message: 'Server error during registration.', error: err.message });
  }
};


// --- User Login ---
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Find the user by email (no change here)
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }
    console.log(`LOGIN ATTEMPT: User '${user.email}' has status: '${user.status}'`);

    // --- NEW FEATURE ADDED HERE ---
    // 2. Check if the user's account is 'active' before proceeding
    if (user.status !== 'active') {
      return res.status(403).json({ message: 'Your account is disabled. Please contact an administrator.' });
    }
    // --- END OF NEW FEATURE ---

    // 3. Compare the password (this was step 2)
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    // 4. If everything is OK, create and send the token (this was step 3)
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.status(200).json({
      message: 'Login successful!',
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role ,
        setupComplete: user.setupComplete  // <-- ADD THIS LINE

      }
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error during login.', error: err.message });
  }
};