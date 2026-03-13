const mongoose = require("mongoose");
const Hospital = require("../models/Hospital");
const Doctor = require("../models/Doctor");
const Admission = require("../models/Admission");
const hospitalService = require("../services/hospitalService");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Returns true when `id` is a valid MongoDB ObjectId string. */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc   Create a new hospital (admin only)
 * @route  POST /api/hospitals
 * @access Private (HOSPITAL_ADMIN)
 */
const createHospital = async (req, res) => {
  try {
    const {
      name,
      address,
      city,
      state,
      phone,
      email,
      website,
      description,
      specializations,
      facilities,
      accreditations,
      established,
      tier,
      logo,
      coverImage,
    } = req.body;

    // Guard against duplicate hospital email
    const existing = await Hospital.findOne({ email: email?.toLowerCase() }).lean();
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A hospital with this email address already exists.",
      });
    }

    const hospital = await Hospital.create({
      name,
      address,
      city,
      state,
      phone,
      email,
      website: website || null,
      description: description || null,
      specializations: specializations || [],
      facilities: facilities || [],
      accreditations: accreditations || [],
      established: established || null,
      tier: tier || "Basic",
      logo: logo || null,
      coverImage: coverImage || null,
      // Link the creating admin to this hospital
      adminId: req.user._id,
    });

    return res.status(201).json({
      success: true,
      message: "Hospital created successfully.",
      data: { hospital },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    // Duplicate key (e.g. unique email index race condition)
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A hospital with this email address already exists.",
      });
    }
    throw error;
  }
};

/**
 * @desc   Get all hospitals with filtering, search, and pagination
 * @route  GET /api/hospitals?page=1&limit=10&city=&specialization=&tier=&minRating=&sortBy=&sortOrder=
 * @access Private (any authenticated user)
 */
const getHospitals = async (req, res) => {
  try {
    const {
      search,
      city,
      state,
      specialization,
      tier,
      minRating,
      sortBy = "rating",
      sortOrder = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    const query = { isActive: true };

    // Full-text search (uses the text index on name + description + specializations)
    if (search) {
      query.$text = { $search: search };
    }

    // Individual field filters (partial, case-insensitive)
    if (city) query.city = new RegExp(city, "i");
    if (state) query.state = new RegExp(state, "i");
    if (specialization) {
      query.specializations = { $in: [new RegExp(specialization, "i")] };
    }
    if (tier) query.tier = tier;
    if (minRating) query.rating = { $gte: parseFloat(minRating) };

    // Sort mapping
    const sortMapping = {
      rating: { rating: -1 },
      name: { name: 1 },
      newest: { createdAt: -1 },
    };
    const sort = sortMapping[sortBy] || { rating: sortOrder === "asc" ? 1 : -1 };

    const [hospitals, total] = await Promise.all([
      Hospital.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .select("-adminId")
        .lean(),
      Hospital.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        hospitals,
        pagination: {
          total,
          page: pageNum,
          limit: limitNum,
          totalPages: Math.ceil(total / limitNum),
        },
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Dedicated search with partial/case-insensitive name, city, specialization
 * @route  GET /api/hospitals/search?name=&city=&specialization=&page=1&limit=10
 * @access Private (any authenticated user)
 */
const searchHospitals = async (req, res) => {
  try {
    const { name, city, specialization, page, limit } = req.query;

    const result = await hospitalService.searchHospitals({
      name,
      city,
      specialization,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: {
        hospitals: result.hospitals,
        pagination: {
          total: result.total,
          page: result.page,
          totalPages: result.totalPages,
        },
      },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Get a single hospital by ID
 * @route  GET /api/hospitals/:id
 * @access Private (any authenticated user)
 */
const getHospitalById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospital ID format.",
      });
    }

    const hospital = await Hospital.findById(id).select("-adminId").lean();

    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found.",
      });
    }

    if (!hospital.isActive) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found.",
      });
    }

    return res.status(200).json({ success: true, data: { hospital } });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Get all active doctors belonging to a hospital
 * @route  GET /api/hospitals/:id/doctors?specialization=&available=
 * @access Private (any authenticated user)
 */
const getHospitalDoctors = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospital ID format.",
      });
    }

    const { specialization, available } = req.query;
    const query = { hospitalId: id, isActive: true };

    if (specialization) query.specialization = new RegExp(specialization, "i");
    if (available !== undefined) query.available = available === "true";

    const doctors = await Doctor.find(query).sort({ name: 1 }).lean();

    return res.status(200).json({ success: true, data: { doctors } });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Update hospital profile (admin only — own hospital)
 * @route  PUT /api/hospitals/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const updateHospital = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospital ID format.",
      });
    }

    const allowedUpdates = [
      "name",
      "address",
      "city",
      "state",
      "phone",
      "email",
      "website",
      "logo",
      "coverImage",
      "description",
      "specializations",
      "facilities",
      "accreditations",
      "established",
      "tier",
      "nurseCount",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No valid fields provided for update.",
      });
    }

    const hospital = await Hospital.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    if (!hospital || !hospital.isActive) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Hospital updated successfully.",
      data: { hospital },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "A hospital with this email address already exists.",
      });
    }
    throw error;
  }
};

/**
 * @desc   Soft-delete a hospital — sets isActive=false (admin only)
 * @route  DELETE /api/hospitals/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const deleteHospital = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospital ID format.",
      });
    }

    const hospital = await Hospital.findById(id);

    if (!hospital || !hospital.isActive) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found.",
      });
    }

    // HOSPITAL_ADMIN may only delete their own hospital
    if (
      req.user.hospitalId &&
      hospital._id.toString() !== req.user.hospitalId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only manage your own hospital.",
      });
    }

    // Soft delete — preserve data for Admission records and Doctor references
    hospital.isActive = false;
    await hospital.save();

    return res.status(200).json({
      success: true,
      message: "Hospital deactivated successfully.",
    });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Get hospital stats summary (admissions breakdown)
 * @route  GET /api/hospitals/:id/stats
 * @access Private (HOSPITAL_ADMIN)
 */
const getHospitalStats = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospital ID format.",
      });
    }

    const hospitalId = id;

    const [
      totalAdmissions,
      pendingAdmissions,
      approvedAdmissions,
      activeDoctors,
    ] = await Promise.all([
      Admission.countDocuments({ hospitalId }),
      Admission.countDocuments({
        hospitalId,
        status: { $in: ["PENDING", "UNDER_REVIEW"] },
      }),
      Admission.countDocuments({
        hospitalId,
        status: { $in: ["APPROVED", "ADMITTED"] },
      }),
      Doctor.countDocuments({ hospitalId, isActive: true }),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalAdmissions,
        pendingAdmissions,
        approvedAdmissions,
        activeDoctors,
      },
    });
  } catch (error) {
    throw error;
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createHospital,
  getHospitals,
  searchHospitals,
  getHospitalById,
  getHospitalDoctors,
  updateHospital,
  deleteHospital,
  getHospitalStats,
};
