const express = require("express");
const router = express.Router();
const {
  createAdmission,
  getMyAdmissions,
  getAdmissionById,
  getAllAdmissions,
  getHospitalAdmissions,
  updateAdmissionStatus,
} = require("../controllers/admissionController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

// ─── Patient routes ────────────────────────────────────────────────────────────
// POST /api/admissions         — create admission request
// GET  /api/admissions/my      — view own admission history
//
// NOTE: /my must come before /:id so Express doesn't treat "my" as an ObjectId
router.post("/", protect, authorize("PATIENT"), createAdmission);
router.get("/my", protect, authorize("PATIENT"), getMyAdmissions);

// ─── Admin routes ─────────────────────────────────────────────────────────────
// GET /api/admissions          — all admissions (admin, filterable by status/priority/hospital)
// GET /api/admissions/hospital — alias scoped to the admin's own hospital
router.get("/", protect, authorize("HOSPITAL_ADMIN"), getAllAdmissions);
router.get("/hospital", protect, authorize("HOSPITAL_ADMIN"), getHospitalAdmissions);

// ─── Shared routes ────────────────────────────────────────────────────────────
// GET /api/admissions/:id           — single admission (patient=own, admin=their hospital)
// PUT /api/admissions/:id/status    — approve / reject / advance status (admin only)
router.get("/:id", protect, getAdmissionById);
router.put("/:id/status", protect, authorize("HOSPITAL_ADMIN"), updateAdmissionStatus);

module.exports = router;
