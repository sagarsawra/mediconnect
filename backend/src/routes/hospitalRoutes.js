const express = require("express");
const router = express.Router();

const {
  createHospital,
  getHospitals,
  searchHospitals,
  getHospitalById,
  getHospitalDoctors,
  updateHospital,
  deleteHospital,
  getHospitalStats,
} = require("../controllers/hospitalController");

const { protect } = require("../middlewares/authMiddleware");
const { authorize, verifyHospitalOwnership } = require("../middlewares/roleMiddleware");

// ─── Route ordering note ──────────────────────────────────────────────────────
// Static segments (/search, /search, /:id/doctors, /:id/stats) MUST be declared
// before the dynamic /:id route to prevent Express matching literal strings as
// MongoDB ObjectIds, which causes CastErrors on every request.

// ─── Read routes — any authenticated user ─────────────────────────────────────
router.get("/search", protect, searchHospitals);
router.get("/", protect, getHospitals);
router.get("/:id/doctors", protect, getHospitalDoctors);
router.get("/:id/stats", protect, authorize("HOSPITAL_ADMIN"), verifyHospitalOwnership("id"), getHospitalStats);
router.get("/:id", protect, getHospitalById);

// ─── Write routes — HOSPITAL_ADMIN only ───────────────────────────────────────
router.post("/", protect, authorize("HOSPITAL_ADMIN"), createHospital);
router.put("/:id", protect, authorize("HOSPITAL_ADMIN"), verifyHospitalOwnership("id"), updateHospital);
router.delete("/:id", protect, authorize("HOSPITAL_ADMIN"), deleteHospital);

module.exports = router;
