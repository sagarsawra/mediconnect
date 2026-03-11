const User = require("../models/User");
const Hospital = require("../models/Hospital");
const { generateToken } = require("../utils/generateToken");

/**
 * @desc   Register a new user (Patient or Hospital Admin)
 * @route  POST /api/auth/register
 * @access Public
 */
const register = async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      role,
      hospitalName,
      hospitalCity,
      hospitalState,
      hospitalPhone,
      hospitalEmail,
    } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    // ── Duplicate email check ─────────────────────────────────────────────────
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    let hospitalId = null;

    // ── If registering as HOSPITAL_ADMIN, create the hospital entry ───────────
    if (role === "HOSPITAL_ADMIN") {
      if (!hospitalName) {
        return res.status(400).json({
          success: false,
          message: "Hospital name is required for admin registration.",
        });
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

    // ── Create user (password hashed via pre-save hook in User model) ─────────
    const user = await User.create({
      name,
      email,
      password,
      role: role || "PATIENT",
      hospitalId,
    });

    // ── Link hospital admin back to hospital ──────────────────────────────────
    if (hospitalId) {
      await Hospital.findByIdAndUpdate(hospitalId, { adminId: user._id });
    }

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(201).json({
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
  } catch (error) {
    console.error("[authController] register error:", error.message);

    // Mongoose duplicate key (race condition — two simultaneous registrations)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "Email already registered.",
      });
    }

    // Mongoose validation error
    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(". "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error during registration. Please try again.",
    });
  }
};

/**
 * @desc   Login user
 * @route  POST /api/auth/login
 * @access Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // ── Input validation ──────────────────────────────────────────────────────
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    // ── Fetch user — explicitly select password (excluded by default) ─────────
    const user = await User.findOne({ email }).select("+password");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: "Account is deactivated. Contact support.",
      });
    }

    // ── Update last login timestamp ───────────────────────────────────────────
    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
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
          lastLogin: user.lastLogin,
          createdAt: user.createdAt,
        },
        token,
      },
    });
  } catch (error) {
    console.error("[authController] login error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error during login. Please try again.",
    });
  }
};

/**
 * @desc   Get current logged-in user
 * @route  GET /api/auth/me
 * @access Private
 */
const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate(
      "hospitalId",
      "name city logo isVerified tier"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { user },
    });
  } catch (error) {
    console.error("[authController] getMe error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error fetching user profile.",
    });
  }
};

/**
 * @desc   Update current user profile
 * @route  PUT /api/auth/me
 * @access Private
 */
const updateMe = async (req, res) => {
  try {
    const { name, avatar } = req.body;

    const updates = {};
    if (name) updates.name = name;
    if (avatar) updates.avatar = avatar;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided to update.",
      });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      data: { user },
    });
  } catch (error) {
    console.error("[authController] updateMe error:", error.message);

    if (error.name === "ValidationError") {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({
        success: false,
        message: messages.join(". "),
      });
    }

    return res.status(500).json({
      success: false,
      message: "Server error updating profile.",
    });
  }
};

/**
 * @desc   Change password
 * @route  PUT /api/auth/change-password
 * @access Private
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Current password and new password are required.",
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: "New password must be at least 6 characters.",
      });
    }

    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    user.password = newPassword;
    await user.save(); // triggers bcrypt pre-save hook

    const token = generateToken({ id: user._id, role: user.role });

    return res.status(200).json({
      success: true,
      message: "Password changed successfully.",
      data: { token },
    });
  } catch (error) {
    console.error("[authController] changePassword error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Server error changing password.",
    });
  }
};

module.exports = { register, login, getMe, updateMe, changePassword };
