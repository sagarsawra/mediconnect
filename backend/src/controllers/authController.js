const User = require("../models/User");
const Hospital = require("../models/Hospital");
const { generateToken } = require("../utils/generateToken");

/**
 * @desc   Register a new user (Patient or Hospital Admin)
 * @route  POST /api/auth/register
 * @access Public
 */
const register = async (req, res) => {
  const { name, email, password, role, hospitalName, hospitalCity, hospitalState, hospitalPhone, hospitalEmail } = req.body;

  // Check if user already exists
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    return res.status(409).json({ success: false, message: "Email already registered." });
  }

  let hospitalId = null;

  // If registering as HOSPITAL_ADMIN, create the hospital entry
  if (role === "HOSPITAL_ADMIN") {
    if (!hospitalName) {
      return res.status(400).json({ success: false, message: "Hospital name is required for admin registration." });
    }

    const hospital = await Hospital.create({
      name: hospitalName,
      city: hospitalCity || "Unknown",
      state: hospitalState || "Unknown",
      phone: hospitalPhone || "N/A",
      email: hospitalEmail || email,
      address: "To be updated",
    });

    hospitalId = hospital._id;
  }

  // Create user
  const user = await User.create({
    name,
    email,
    password,
    role: role || "PATIENT",
    hospitalId,
  });

  // If admin created, update hospital with adminId
  if (hospitalId) {
    await Hospital.findByIdAndUpdate(hospitalId, { adminId: user._id });
  }

  const token = generateToken({ id: user._id, role: user.role });

  res.status(201).json({
    success: true,
    message: "Registration successful.",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    },
  });
};

/**
 * @desc   Login user
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, message: "Email and password are required." });
  }

  // Explicitly select password field
  const user = await User.findOne({ email }).select("+password");

  if (!user || !(await user.comparePassword(password))) {
    return res.status(401).json({ success: false, message: "Invalid email or password." });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, message: "Account is deactivated." });
  }

  // Update last login timestamp
  user.lastLogin = new Date();
  await user.save({ validateBeforeSave: false });

  const token = generateToken({ id: user._id, role: user.role });

  res.status(200).json({
    success: true,
    message: "Login successful.",
    data: {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        hospitalId: user.hospitalId,
        avatar: user.avatar,
        createdAt: user.createdAt,
      },
      token,
    },
  });
};

/**
 * @desc   Get current logged-in user
 * @route  GET /api/auth/me
 * @access Private
 */
const getMe = async (req, res) => {
  const user = await User.findById(req.user._id).populate("hospitalId", "name city logo isVerified tier");

  res.status(200).json({
    success: true,
    data: { user },
  });
};

/**
 * @desc   Update current user profile
 * @route  PUT /api/auth/me
 * @access Private
 */
const updateMe = async (req, res) => {
  const { name, avatar } = req.body;

  const updates = {};
  if (name) updates.name = name;
  if (avatar) updates.avatar = avatar;

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({
    success: true,
    message: "Profile updated successfully.",
    data: { user },
  });
};

/**
 * @desc   Change password
 * @route  PUT /api/auth/change-password
 * @access Private
 */
const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select("+password");

  if (!(await user.comparePassword(currentPassword))) {
    return res.status(401).json({ success: false, message: "Current password is incorrect." });
  }

  user.password = newPassword;
  await user.save();

  const token = generateToken({ id: user._id, role: user.role });

  res.status(200).json({
    success: true,
    message: "Password changed successfully.",
    data: { token },
  });
};

module.exports = { register, login, getMe, updateMe, changePassword };
