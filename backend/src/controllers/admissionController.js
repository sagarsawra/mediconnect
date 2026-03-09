const Admission = require("../models/Admission");
const Hospital = require("../models/Hospital");
const User = require("../models/User");
const { buildTimelineEvent, getDefaultMessage } = require("../utils/timelineBuilder");
const notificationService = require("../services/notificationService");

/**
 * @desc   Create a new admission request (Patient)
 * @route  POST /api/admissions
 * @access Private (PATIENT)
 */
const createAdmission = async (req, res) => {
  const { hospitalId, disease, symptoms, urgency, patientNotes, patientAge, patientGender, patientPhone } = req.body;

  // Validate hospital exists
  const hospital = await Hospital.findById(hospitalId).select("name adminId availableBeds");
  if (!hospital) {
    return res.status(404).json({ success: false, message: "Hospital not found." });
  }

  // Build initial timeline entry
  const initialEvent = buildTimelineEvent({
    status: "PENDING",
    message: getDefaultMessage("PENDING"),
    performedBy: req.user.name,
    performedById: req.user._id,
  });

  const admission = await Admission.create({
    patientId: req.user._id,
    patientName: req.user.name,
    patientAge: patientAge || 0,
    patientGender: patientGender || "Male",
    patientPhone: patientPhone || null,
    hospitalId,
    hospitalName: hospital.name,
    disease,
    symptoms: symptoms || [],
    urgency: urgency || "Medium",
    patientNotes: patientNotes || null,
    status: "PENDING",
    timeline: [initialEvent],
  });

  // Notify patient
  await notificationService.notifyAdmissionSubmitted({
    userId: req.user._id,
    hospitalName: hospital.name,
    admissionId: admission._id,
  });

  // Notify hospital admin
  if (hospital.adminId) {
    await notificationService.notifyAdminNewAdmission({
      adminUserId: hospital.adminId,
      patientName: req.user.name,
      disease,
      urgency: urgency || "Medium",
      admissionId: admission._id,
    });
  }

  res.status(201).json({
    success: true,
    message: "Admission request submitted successfully.",
    data: { admission },
  });
};

/**
 * @desc   Get logged-in patient's admission requests
 * @route  GET /api/admissions/my
 * @access Private (PATIENT)
 */
const getMyAdmissions = async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = { patientId: req.user._id };
  if (status) query.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [admissions, total] = await Promise.all([
    Admission.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("reports", "name type url size uploadedAt"),
    Admission.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      admissions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

/**
 * @desc   Get single admission details
 * @route  GET /api/admissions/:id
 * @access Private (PATIENT can see own; HOSPITAL_ADMIN can see their hospital's)
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

  res.status(200).json({ success: true, data: { admission } });
};

/**
 * @desc   Get all admissions for admin's hospital
 * @route  GET /api/admissions/hospital
 * @access Private (HOSPITAL_ADMIN)
 */
const getHospitalAdmissions = async (req, res) => {
  const { status, urgency, page = 1, limit = 20, sortBy = "createdAt", sortOrder = "desc" } = req.query;

  const query = { hospitalId: req.user.hospitalId };
  if (status) query.status = status;
  if (urgency) query.urgency = urgency;

  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [admissions, total] = await Promise.all([
    Admission.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("reports", "name type url size uploadedAt"),
    Admission.countDocuments(query),
  ]);

  res.status(200).json({
    success: true,
    data: {
      admissions,
      pagination: { total, page: parseInt(page), limit: parseInt(limit), totalPages: Math.ceil(total / parseInt(limit)) },
    },
  });
};

/**
 * @desc   Update admission status (Hospital Admin)
 * @route  PUT /api/admissions/:id/status
 * @access Private (HOSPITAL_ADMIN)
 */
const updateAdmissionStatus = async (req, res) => {
  const { status, adminNotes, assignedDoctor, assignedDoctorId, assignedWard } = req.body;

  const VALID_TRANSITIONS = {
    PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
    UNDER_REVIEW: ["APPROVED", "REJECTED"],
    APPROVED: ["ADMITTED", "REJECTED"],
    ADMITTED: ["DISCHARGED"],
    REJECTED: [],
    DISCHARGED: [],
  };

  const admission = await Admission.findById(req.params.id);

  if (!admission) {
    return res.status(404).json({ success: false, message: "Admission not found." });
  }

  // Verify hospital ownership
  if (admission.hospitalId.toString() !== req.user.hospitalId?.toString()) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  // Validate status transition
  const allowedTransitions = VALID_TRANSITIONS[admission.status];
  if (!allowedTransitions || !allowedTransitions.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `Invalid status transition from ${admission.status} to ${status}. Allowed: ${allowedTransitions?.join(", ") || "none"}.`,
    });
  }

  // Build timeline event
  const event = buildTimelineEvent({
    status,
    message: adminNotes || getDefaultMessage(status),
    performedBy: req.user.name,
    performedById: req.user._id,
  });

  // Prepare update object
  const updateFields = {
    status,
    $push: { timeline: event },
  };

  if (adminNotes) updateFields.adminNotes = adminNotes;
  if (assignedDoctor) updateFields.assignedDoctor = assignedDoctor;
  if (assignedDoctorId) updateFields.assignedDoctorId = assignedDoctorId;
  if (assignedWard) updateFields.assignedWard = assignedWard;

  // Set date fields based on transition
  if (status === "UNDER_REVIEW") updateFields.reviewDate = new Date();
  if (status === "ADMITTED") updateFields.admitDate = new Date();
  if (status === "DISCHARGED") updateFields.dischargeDate = new Date();

  const updatedAdmission = await Admission.findByIdAndUpdate(
    req.params.id,
    updateFields,
    { new: true, runValidators: true }
  ).populate("reports", "name type url size uploadedAt");

  // Send notifications based on new status
  const notifyMap = {
    APPROVED: () =>
      notificationService.notifyAdmissionApproved({
        userId: admission.patientId,
        hospitalName: admission.hospitalName,
        admissionId: admission._id,
        adminNotes,
      }),
    REJECTED: () =>
      notificationService.notifyAdmissionRejected({
        userId: admission.patientId,
        hospitalName: admission.hospitalName,
        admissionId: admission._id,
        adminNotes,
      }),
    ADMITTED: () =>
      notificationService.notifyAdmitted({
        userId: admission.patientId,
        hospitalName: admission.hospitalName,
        ward: assignedWard,
        admissionId: admission._id,
      }),
    DISCHARGED: () =>
      notificationService.notifyDischarged({
        userId: admission.patientId,
        hospitalName: admission.hospitalName,
        admissionId: admission._id,
      }),
  };

  if (notifyMap[status]) await notifyMap[status]();

  res.status(200).json({
    success: true,
    message: `Admission status updated to ${status}.`,
    data: { admission: updatedAdmission },
  });
};

module.exports = {
  createAdmission,
  getMyAdmissions,
  getAdmissionById,
  getHospitalAdmissions,
  updateAdmissionStatus,
};
