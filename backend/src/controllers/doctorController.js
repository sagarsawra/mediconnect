const mongoose = require("mongoose");
const Doctor = require("../models/Doctor");
const Hospital = require("../models/Hospital");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Check whether a string is a valid MongoDB ObjectId.
 */
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc   Create a new doctor (admin only)
 * @route  POST /api/doctors
 * @access Private (HOSPITAL_ADMIN)
 */
const createDoctor = async (req, res) => {
  try {
    const {
      name,
      specialization,
      hospitalId,
      experience,
      qualifications,
      contactNumber,
      email,
      available,
    } = req.body;

    // Determine which hospital the doctor belongs to.
    // HOSPITAL_ADMIN can only create doctors for their own hospital;
    // fall back to req.body.hospitalId for super-admins / seeding scenarios.
    const targetHospitalId = req.user.hospitalId || hospitalId;

    if (!targetHospitalId) {
      return res.status(400).json({
        success: false,
        message: "hospitalId is required.",
      });
    }

    if (!isValidObjectId(targetHospitalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospitalId format.",
      });
    }

    // Confirm hospital exists
    const hospital = await Hospital.findById(targetHospitalId).lean();
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found.",
      });
    }

    const doctor = await Doctor.create({
      hospitalId: targetHospitalId,
      name,
      specialization,
      experience: experience ?? 0,
      qualifications: qualifications || [],
      contactNumber: contactNumber || null,
      email: email || null,
      available: available !== undefined ? available : true,
    });

    // Increment hospital doctorCount (denormalized fast-read counter)
    await Hospital.findByIdAndUpdate(targetHospitalId, {
      $inc: { doctorCount: 1 },
    });

    return res.status(201).json({
      success: true,
      message: "Doctor created successfully.",
      data: { doctor },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    throw error; // express-async-errors will pass to errorHandler
  }
};

/**
 * @desc   Get all doctors with pagination
 * @route  GET /api/doctors?page=1&limit=10&specialization=&hospitalId=&available=
 * @access Private (any authenticated user)
 */
const getDoctors = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      specialization,
      hospitalId,
      available,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page, 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
    const skip = (pageNum - 1) * limitNum;

    // Build query — only return active doctors by default
    const query = { isActive: true };

    if (hospitalId) {
      if (!isValidObjectId(hospitalId)) {
        return res.status(400).json({
          success: false,
          message: "Invalid hospitalId format.",
        });
      }
      query.hospitalId = hospitalId;
    }

    if (specialization) {
      query.specialization = new RegExp(specialization, "i");
    }

    if (available !== undefined) {
      query.available = available === "true";
    }

    const [doctors, total] = await Promise.all([
      Doctor.find(query)
        .populate("hospitalId", "name city state")
        .sort({ name: 1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Doctor.countDocuments(query),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        doctors,
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
 * @desc   Get a single doctor by ID
 * @route  GET /api/doctors/:id
 * @access Private (any authenticated user)
 */
const getDoctorById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID format.",
      });
    }

    const doctor = await Doctor.findById(id)
      .populate("hospitalId", "name city state phone email")
      .lean();

    if (!doctor) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    if (!doctor.isActive) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    return res.status(200).json({
      success: true,
      data: { doctor },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Get all active doctors belonging to a specific hospital
 * @route  GET /api/doctors/hospital/:hospitalId
 * @access Private (any authenticated user)
 */
const getDoctorsByHospital = async (req, res) => {
  try {
    const { hospitalId } = req.params;
    const { specialization, available } = req.query;

    if (!isValidObjectId(hospitalId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid hospitalId format.",
      });
    }

    // Confirm hospital exists
    const hospital = await Hospital.findById(hospitalId).lean();
    if (!hospital) {
      return res.status(404).json({
        success: false,
        message: "Hospital not found.",
      });
    }

    const query = { hospitalId, isActive: true };

    if (specialization) {
      query.specialization = new RegExp(specialization, "i");
    }

    if (available !== undefined) {
      query.available = available === "true";
    }

    const doctors = await Doctor.find(query).sort({ name: 1 }).lean();

    return res.status(200).json({
      success: true,
      data: { doctors },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * @desc   Update doctor information (admin only)
 * @route  PUT /api/doctors/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const updateDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID format.",
      });
    }

    const doctor = await Doctor.findById(id);

    if (!doctor || !doctor.isActive) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    // HOSPITAL_ADMIN can only update doctors in their own hospital
    if (
      req.user.hospitalId &&
      doctor.hospitalId.toString() !== req.user.hospitalId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only manage doctors in your hospital.",
      });
    }

    const allowedUpdates = [
      "name",
      "specialization",
      "experience",
      "available",
      "avatar",
      "qualifications",
      "contactNumber",
      "email",
    ];

    const updates = {};
    allowedUpdates.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    const updatedDoctor = await Doctor.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });

    return res.status(200).json({
      success: true,
      message: "Doctor updated successfully.",
      data: { doctor: updatedDoctor },
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res.status(400).json({ success: false, message: error.message });
    }
    throw error;
  }
};

/**
 * @desc   Soft-delete a doctor — sets isActive=false (admin only)
 * @route  DELETE /api/doctors/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const deleteDoctor = async (req, res) => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid doctor ID format.",
      });
    }

    const doctor = await Doctor.findById(id);

    if (!doctor || !doctor.isActive) {
      return res.status(404).json({
        success: false,
        message: "Doctor not found.",
      });
    }

    // HOSPITAL_ADMIN can only delete doctors in their own hospital
    if (
      req.user.hospitalId &&
      doctor.hospitalId.toString() !== req.user.hospitalId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied. You can only manage doctors in your hospital.",
      });
    }

    // Soft delete — preserve data for Admission history references
    doctor.isActive = false;
    await doctor.save();

    // Decrement hospital doctorCount (keep count >= 0)
    await Hospital.findByIdAndUpdate(doctor.hospitalId, {
      $inc: { doctorCount: -1 },
    });

    return res.status(200).json({
      success: true,
      message: "Doctor deactivated successfully.",
    });
  } catch (error) {
    throw error;
  }
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createDoctor,
  getDoctors,
  getDoctorById,
  getDoctorsByHospital,
  updateDoctor,
  deleteDoctor,
};
