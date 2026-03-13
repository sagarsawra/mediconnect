const Admission = require("../models/Admission");
const Hospital = require("../models/Hospital");
const { buildTimelineEvent, getDefaultMessage } = require("../utils/timelineBuilder");

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Allowed status transitions (state machine).
 * Key = current status → Value = array of valid next statuses.
 */
const VALID_TRANSITIONS = {
  PENDING: ["UNDER_REVIEW", "APPROVED", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["ADMITTED", "REJECTED"],
  ADMITTED: ["DISCHARGED"],
  REJECTED: [],
  DISCHARGED: [],
};

/**
 * Normalise urgency/priority strings.
 * Accepts both task-API format ("HIGH") and model enum ("High").
 */
const PRIORITY_MAP = {
  low: "Low",
  medium: "Medium",
  high: "High",
  critical: "Critical",
};

const normaliseUrgency = (raw) => {
  if (!raw) return "Medium";
  const key = raw.toString().toLowerCase();
  return PRIORITY_MAP[key] || "Medium";
};

// ─── Validation ───────────────────────────────────────────────────────────────

/**
 * Validate admission creation payload.
 * Returns { hospital, urgency } on success; throws with statusCode on failure.
 */
const validateAdmissionPayload = async ({ hospitalId, disease, symptoms, urgency, priority, patientAge, patientGender }) => {
  const errors = [];

  if (!hospitalId) errors.push("'hospitalId' is required.");
  if (!disease && (!symptoms || symptoms.length === 0)) errors.push("'disease' (or 'symptoms') is required.");
  if (patientAge !== undefined && (isNaN(Number(patientAge)) || Number(patientAge) < 0 || Number(patientAge) > 150)) {
    errors.push("'patientAge' must be a number between 0 and 150.");
  }
  if (patientGender && !["Male", "Female", "Other"].includes(patientGender)) {
    errors.push("'patientGender' must be one of: Male, Female, Other.");
  }

  if (errors.length > 0) {
    const err = new Error("Validation failed.");
    err.validationErrors = errors;
    err.statusCode = 400;
    throw err;
  }

  const hospital = await Hospital.findById(hospitalId).select("name adminId isActive").lean();
  if (!hospital) {
    const err = new Error("Hospital not found.");
    err.statusCode = 404;
    throw err;
  }
  if (!hospital.isActive) {
    const err = new Error("This hospital is not currently accepting admissions.");
    err.statusCode = 400;
    throw err;
  }

  const resolvedUrgency = normaliseUrgency(priority || urgency);
  return { hospital, urgency: resolvedUrgency };
};

// ─── Status Transition ────────────────────────────────────────────────────────

/**
 * Validate that a status transition is permitted by the state machine.
 */
const validateStatusTransition = (currentStatus, newStatus) => {
  const allowed = VALID_TRANSITIONS[currentStatus];
  if (!allowed) {
    const err = new Error(`Unknown current status: ${currentStatus}.`);
    err.statusCode = 400;
    throw err;
  }
  if (!allowed.includes(newStatus)) {
    const err = new Error(
      `Invalid status transition from '${currentStatus}' to '${newStatus}'. Allowed: ${
        allowed.length ? allowed.join(", ") : "none (terminal state)"
      }.`
    );
    err.statusCode = 400;
    throw err;
  }
};

// ─── Timeline ─────────────────────────────────────────────────────────────────

/**
 * Format the raw embedded timeline array for clean API output.
 */
const formatTimeline = (rawTimeline = []) =>
  rawTimeline.map((event) => ({
    id: event._id,
    status: event.status,
    message: event.message,
    performedBy: event.performedBy,
    timestamp: event.timestamp,
  }));

// ─── Core Status Update ───────────────────────────────────────────────────────

/**
 * Orchestrate a status update: validate transition, build timeline event, persist.
 *
 * @returns {Document} Updated Admission document
 */
const processStatusUpdate = async ({
  admissionId,
  newStatus,
  adminNotes,
  assignedDoctor,
  assignedDoctorId,
  performedBy,
  performedById,
}) => {
  const admission = await Admission.findById(admissionId);
  if (!admission) {
    const err = new Error("Admission not found.");
    err.statusCode = 404;
    throw err;
  }

  validateStatusTransition(admission.status, newStatus);

  // Build timeline event
  const event = buildTimelineEvent({
    status: newStatus,
    message: adminNotes || getDefaultMessage(newStatus),
    performedBy,
    performedById,
  });

  // Compose update fields
  const updateFields = {
    status: newStatus,
    $push: { timeline: event },
  };

  if (adminNotes) updateFields.adminNotes = adminNotes;
  if (assignedDoctor) updateFields.assignedDoctor = assignedDoctor;
  if (assignedDoctorId) updateFields.assignedDoctorId = assignedDoctorId;

  if (newStatus === "UNDER_REVIEW") updateFields.reviewDate = new Date();
  if (newStatus === "ADMITTED") updateFields.admitDate = new Date();
  if (newStatus === "DISCHARGED") updateFields.dischargeDate = new Date();

  const updated = await Admission.findByIdAndUpdate(admissionId, updateFields, {
    new: true,
    runValidators: true,
  }).populate("reports", "name type url size uploadedAt");

  return updated;
};

// ─── Query Builder ────────────────────────────────────────────────────────────

/**
 * Build Mongoose query for listing admissions with optional filters.
 */
const buildAdmissionQuery = ({ status, priority, urgency, hospitalId } = {}) => {
  const query = {};

  if (hospitalId) query.hospitalId = hospitalId;

  if (status) {
    const upper = status.toUpperCase();
    const validStatuses = ["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED", "ADMITTED", "DISCHARGED"];
    if (validStatuses.includes(upper)) query.status = upper;
  }

  const rawUrgency = priority || urgency;
  if (rawUrgency) {
    query.urgency = normaliseUrgency(rawUrgency);
  }

  return query;
};

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  validateAdmissionPayload,
  validateStatusTransition,
  formatTimeline,
  processStatusUpdate,
  buildAdmissionQuery,
  normaliseUrgency,
  VALID_TRANSITIONS,
};
