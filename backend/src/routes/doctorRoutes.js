const express = require("express");
const router = express.Router();

const {
  createDoctor,
  getDoctors,
  getDoctorById,
  getDoctorsByHospital,
  updateDoctor,
  deleteDoctor,
} = require("../controllers/doctorController");

const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

// ─── Route ordering note ──────────────────────────────────────────────────────
// /hospital/:hospitalId MUST be declared before /:id to prevent Express from
// matching the literal string "hospital" as a MongoDB ObjectId parameter.

// ─── Read routes — any authenticated user ─────────────────────────────────────
router.get("/", protect, getDoctors);
router.get("/hospital/:hospitalId", protect, getDoctorsByHospital);
router.get("/:id", protect, getDoctorById);

// ─── Write routes — HOSPITAL_ADMIN only ───────────────────────────────────────
router.post("/", protect, authorize("HOSPITAL_ADMIN"), createDoctor);
router.put("/:id", protect, authorize("HOSPITAL_ADMIN"), updateDoctor);
router.delete("/:id", protect, authorize("HOSPITAL_ADMIN"), deleteDoctor);

module.exports = router;
