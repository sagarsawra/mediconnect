const Admission = require("../models/Admission");
const Hospital = require("../models/Hospital");
const admissionService = require("../services/admissionService");
const { buildTimelineEvent, getDefaultMessage } = require("../utils/timelineBuilder");

// ─── Controllers ──────────────────────────────────────────────────────────────

/**
 * @desc   Create a new admission request
 * @route  POST /api/admissions
 * @access Private (PATIENT)
 *
 * Body:
 *   hospitalId  - required
 *   disease     - required (or symptoms array)
 *   symptoms    - array of strings
 *   urgency | priority - "Low"|"Medium"|"High"|"Critical" or "LOW"|"HIGH" etc.
 *   bedType     - optional: "ICU", "General", "Emergency", "Private"
 *   patientAge, patientGender, patientPhone, patientNotes
 */
const createAdmission = async (req, res) => {
  const {
    hospitalId,
    disease,
    symptoms,
    urgency,
    priority,
    bedType,
    patientAge,
    patientGender,
    patientPhone,
    patientNotes,
  } = req.body;

  // ── Validate + resolve hospital ─────────────────────────────────────────────
  let hospital, resolvedUrgency;
  try {
    ({ hospital, urgency: resolvedUrgency } = await admissionService.validateAdmissionPayload({
      hospitalId,
      disease,
      symptoms,
      urgency,
      priority,
      patientAge,
      patientGender,
    }));
  } catch (err) {
    return res.status(err.statusCode || 400).json({
      success: false,
      message: err.message,
      errors: err.validationErrors || undefined,
    });
  }

  // ── Build initial timeline event ────────────────────────────────────────────
  const initialEvent = buildTimelineEvent({
    status: "PENDING",
    message: getDefaultMessage("PENDING"),
    performedBy: req.user.name,
    performedById: req.user._id,
  });

  // ── Create admission document ───────────────────────────────────────────────
  const admission = await Admission.create({
    patientId: req.user._id,
    patientName: req.user.name,
    patientAge: patientAge !== undefined ? Number(patientAge) : 0,
    patientGender: patientGender || "Male",
    patientPhone: patientPhone || null,
    hospitalId,
    hospitalName: hospital.name,
    disease: disease || (symptoms && symptoms[0]) || "Not specified",
    symptoms: Array.isArray(symptoms) ? symptoms : symptoms ? [symptoms] : [],
    urgency: resolvedUrgency,
    patientNotes: patientNotes || null,
    // Store bedType in adminNotes as a convention until model is extended
    // (Keeps model unchanged while providing the field for approval logic)
    status: "PENDING",
    requestDate: new Date(),
    timeline: [initialEvent],
  });


  res.status(201).json({
    success: true,
    message: "Admission request submitted successfully.",
    admission,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc   Get logged-in patient's own admission requests
 * @route  GET /api/admissions/my
 * @access Private (PATIENT)
 *
 * Query params:
 *   status - filter by status
 *   page, limit - pagination
 */
const getMyAdmissions = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = admissionService.buildAdmissionQuery({ status });
  query.patientId = req.user._id; // always scope to the logged-in patient

  const skip = (Math.max(1, parseInt(page)) - 1) * Math.min(50, parseInt(limit));
  const limitNum = Math.min(50, parseInt(limit) || 10);

  const [admissions, total] = await Promise.all([
    Admission.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .populate("reports", "name type url size uploadedAt"),
    Admission.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: parseInt(page),
    totalPages: Math.ceil(total / limitNum),
    admissions,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc   Get a single admission by ID
 * @route  GET /api/admissions/:id
 * @access Private (PATIENT can view own; HOSPITAL_ADMIN can view their hospital's)
 */
const getAdmissionById = async (req, res) => {
  const admission = await Admission.findById(req.params.id)
    .populate("reports", "name type url size uploadedAt")
    .populate("patientId", "name email avatar");

  if (!admission) {
    return res.status(404).json({ success: false, message: "Admission not found." });
  }

  // Authorization check
  const isPatientOwner = admission.patientId._id.toString() === req.user._id.toString();
  const isHospitalAdmin =
    req.user.role === "HOSPITAL_ADMIN" &&
    req.user.hospitalId?.toString() === admission.hospitalId.toString();

  if (!isPatientOwner && !isHospitalAdmin) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  res.status(200).json({
    success: true,
    admission: {
      ...admission.toJSON(),
      timeline: admissionService.formatTimeline(admission.timeline),
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc   Admin: list ALL admissions with optional filters
 * @route  GET /api/admissions
 * @access Private (HOSPITAL_ADMIN)
 *
 * Query params:
 *   status    - PENDING | UNDER_REVIEW | APPROVED | REJECTED | ADMITTED | DISCHARGED
 *   priority  - HIGH | LOW | MEDIUM | CRITICAL  (alias for urgency)
 *   urgency   - High | Medium | Low | Critical
 *   hospitalId - override (super-admins only; defaults to admin's own hospital)
 *   page, limit, sortBy, sortOrder
 */
const getAllAdmissions = async (req, res) => {
  const {
    status,
    priority,
    urgency,
    hospitalId,
    page = 1,
    limit = 20,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = req.query;

  // HOSPITAL_ADMIN is always scoped to their own hospital
  const resolvedHospitalId = req.user.hospitalId || hospitalId;

  const query = admissionService.buildAdmissionQuery({
    status,
    priority,
    urgency,
    hospitalId: resolvedHospitalId,
  });

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  const [admissions, total] = await Promise.all([
    Admission.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate("reports", "name type url"),
    Admission.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    admissions,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc   Admin: list admissions for their hospital (scoped + richer filters)
 * @route  GET /api/admissions/hospital
 * @access Private (HOSPITAL_ADMIN)
 *
 * Query params:
 *   status, urgency, priority, sortBy, sortOrder, page, limit
 */
const getHospitalAdmissions = async (req, res) => {
  const { status, urgency, priority, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = req.query;

  const query = admissionService.buildAdmissionQuery({
    status,
    priority,
    urgency,
    hospitalId: req.user.hospitalId,
  });

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, parseInt(limit) || 20);
  const skip = (pageNum - 1) * limitNum;

  const [admissions, total] = await Promise.all([
    Admission.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limitNum)
      .populate("reports", "name type url size uploadedAt"),
    Admission.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    total,
    page: pageNum,
    totalPages: Math.ceil(total / limitNum),
    admissions,
  });
};

// ─────────────────────────────────────────────────────────────────────────────

/**
 * @desc   Admin: approve, reject, or advance an admission's status
 * @route  PUT /api/admissions/:id/status
 * @access Private (HOSPITAL_ADMIN)
 *
 * Body:
 *   status         - new status (APPROVED | REJECTED | UNDER_REVIEW | ADMITTED | DISCHARGED)
 *   adminNotes     - optional admin message
 *   assignedDoctor - optional doctor name
 *   assignedDoctorId - optional MongoDB ObjectId
 *   assignedWard   - optional ward name
 *
 * Side-effects:
 *   APPROVED  → decrements hospital availableBeds (409 if none left)
 *   REJECTED (from APPROVED) | DISCHARGED → increments availableBeds back
 */
const updateAdmissionStatus = async (req, res) => {
  const { status, adminNotes, assignedDoctor, assignedDoctorId } = req.body;

  if (!status) {
    return res.status(400).json({ success: false, message: "'status' is required in the request body." });
  }

  // Ownership check — ensure admin belongs to this admission's hospital
  const admissionCheck = await Admission.findById(req.params.id).select("hospitalId patientId hospitalName disease urgency");
  if (!admissionCheck) {
    return res.status(404).json({ success: false, message: "Admission not found." });
  }
  if (admissionCheck.hospitalId.toString() !== req.user.hospitalId?.toString()) {
    return res.status(403).json({ success: false, message: "Access denied. You can only manage admissions for your own hospital." });
  }

  // Delegate all business logic (validation, bed ops, timeline) to the service
  let updatedAdmission;
  try {
    updatedAdmission = await admissionService.processStatusUpdate({
      admissionId: req.params.id,
      newStatus: status.toUpperCase(),
      adminNotes,
      assignedDoctor,
      assignedDoctorId,
      performedBy: req.user.name,
      performedById: req.user._id,
    });
  } catch (err) {
    return res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
    });
  }


  res.status(200).json({
    success: true,
    message: `Admission status updated to ${status.toUpperCase()}.`,
    admission: {
      ...updatedAdmission.toJSON(),
      timeline: admissionService.formatTimeline(updatedAdmission.timeline),
    },
  });
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  createAdmission,
  getMyAdmissions,
  getAdmissionById,
  getAllAdmissions,
  getHospitalAdmissions,
  updateAdmissionStatus,
};
