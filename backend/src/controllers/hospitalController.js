const Hospital = require("../models/Hospital");
const Doctor = require("../models/Doctor");
const BedCategory = require("../models/BedCategory");
const Admission = require("../models/Admission");

/**
 * @desc   Get all hospitals with filtering, search, and pagination
 * @route  GET /api/hospitals
 * @access Public
 */
const getHospitals = async (req, res) => {
  const {
    search,
    city,
    state,
    specialization,
    tier,
    minRating,
    hasIcu,
    sortBy = "rating",
    sortOrder = "desc",
    page = 1,
    limit = 20,
  } = req.query;

  const query = { isActive: true };

  // Full-text search
  if (search) {
    query.$text = { $search: search };
  }

  // Filters
  if (city) query.city = new RegExp(city, "i");
  if (state) query.state = new RegExp(state, "i");
  if (specialization) query.specializations = { $in: [new RegExp(specialization, "i")] };
  if (tier) query.tier = tier;
  if (minRating) query.rating = { $gte: parseFloat(minRating) };
  if (hasIcu === "true") query.availableIcuBeds = { $gt: 0 };

  // Sort mapping
  const sortMapping = {
    rating: { rating: -1 },
    beds: { availableBeds: -1 },
    name: { name: 1 },
    distance: { name: 1 }, // geo sort requires $near; placeholder
    newest: { createdAt: -1 },
  };
  const sort = sortMapping[sortBy] || { rating: sortOrder === "asc" ? 1 : -1 };

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [hospitals, total] = await Promise.all([
    Hospital.find(query).sort(sort).skip(skip).limit(parseInt(limit)).select("-adminId"),
    Hospital.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      hospitals,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    },
  });
};

/**
 * @desc   Get single hospital details
 * @route  GET /api/hospitals/:id
 * @access Public
 */
const getHospitalById = async (req, res) => {
  const hospital = await Hospital.findById(req.params.id).select("-adminId");

  if (!hospital) {
    return res.status(404).json({ success: false, message: "Hospital not found." });
  }

  res.status(200).json({ success: true, data: { hospital } });
};

/**
 * @desc   Get hospital bed categories
 * @route  GET /api/hospitals/:id/beds
 * @access Public
 */
const getHospitalBeds = async (req, res) => {
  const hospital = await Hospital.findById(req.params.id).select("name");
  if (!hospital) {
    return res.status(404).json({ success: false, message: "Hospital not found." });
  }

  const beds = await BedCategory.find({ hospitalId: req.params.id });

  res.status(200).json({ success: true, data: { beds } });
};

/**
 * @desc   Get hospital doctors
 * @route  GET /api/hospitals/:id/doctors
 * @access Public
 */
const getHospitalDoctors = async (req, res) => {
  const { specialization, available } = req.query;
  const query = { hospitalId: req.params.id, isActive: true };

  if (specialization) query.specialization = new RegExp(specialization, "i");
  if (available !== undefined) query.available = available === "true";

  const doctors = await Doctor.find(query).sort({ name: 1 });

  res.status(200).json({ success: true, data: { doctors } });
};

/**
 * @desc   Update hospital profile (admin only)
 * @route  PUT /api/hospitals/:id
 * @access Private (HOSPITAL_ADMIN)
 */
const updateHospital = async (req, res) => {
  const allowedUpdates = [
    "name", "address", "city", "state", "phone", "email", "website",
    "logo", "coverImage", "description", "specializations", "facilities",
    "accreditations", "established", "tier", "nurseCount",
  ];

  const updates = {};
  allowedUpdates.forEach((field) => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  const hospital = await Hospital.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  });

  if (!hospital) {
    return res.status(404).json({ success: false, message: "Hospital not found." });
  }

  res.status(200).json({
    success: true,
    message: "Hospital updated successfully.",
    data: { hospital },
  });
};

/**
 * @desc   Get hospital stats summary for admin
 * @route  GET /api/hospitals/:id/stats
 * @access Private (HOSPITAL_ADMIN)
 */
const getHospitalStats = async (req, res) => {
  const hospitalId = req.params.id;

  const [totalAdmissions, pendingAdmissions, approvedAdmissions, beds] = await Promise.all([
    Admission.countDocuments({ hospitalId }),
    Admission.countDocuments({ hospitalId, status: { $in: ["PENDING", "UNDER_REVIEW"] } }),
    Admission.countDocuments({ hospitalId, status: { $in: ["APPROVED", "ADMITTED"] } }),
    BedCategory.find({ hospitalId }),
  ]);

  const totalBeds = beds.reduce((s, b) => s + b.total, 0);
  const availableBeds = beds.reduce((s, b) => s + b.available, 0);
  const occupancyRate = totalBeds > 0 ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) : 0;

  res.status(200).json({
    success: true,
    data: {
      totalAdmissions,
      pendingAdmissions,
      approvedAdmissions,
      totalBeds,
      availableBeds,
      occupancyRate,
    },
  });
};

module.exports = {
  getHospitals,
  getHospitalById,
  getHospitalBeds,
  getHospitalDoctors,
  updateHospital,
  getHospitalStats,
};
