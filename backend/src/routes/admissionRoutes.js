const express = require("express");
const router = express.Router();
const {
  createAdmission,
  getMyAdmissions,
  getAdmissionById,
  getHospitalAdmissions,
  updateAdmissionStatus,
} = require("../controllers/admissionController");
const { protect } = require("../middlewares/authMiddleware");
const { authorize } = require("../middlewares/roleMiddleware");

router.post("/", protect, authorize("PATIENT"), createAdmission);
router.get("/my", protect, authorize("PATIENT"), getMyAdmissions);
router.get("/hospital", protect, authorize("HOSPITAL_ADMIN"), getHospitalAdmissions);
router.get("/:id", protect, getAdmissionById);
router.put("/:id/status", protect, authorize("HOSPITAL_ADMIN"), updateAdmissionStatus);

module.exports = router;
